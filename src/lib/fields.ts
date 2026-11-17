import {
	abaCheckDigit,
	deaCheckDigit,
	ibanCheckDigits,
	luhnCheckDigit,
	npiCheckDigit,
	wrongDigit,
} from "./checksums.ts";
import {
	EMAIL_DOMAINS,
	FIRST_NAMES,
	ICD10,
	INSURERS,
	LAST_NAMES,
	MEDICATIONS,
	PLACES,
	STREET_NAMES,
	STREET_SUFFIXES,
	type Place,
} from "./data.ts";
import { CHARSETS, type Rng } from "./rng.ts";

export type Category = "Identity" | "Contact" | "Government ID" | "Financial" | "Health" | "Secrets" | "Network";

export const CATEGORIES: readonly Category[] = [
	"Identity",
	"Contact",
	"Government ID",
	"Financial",
	"Health",
	"Secrets",
	"Network",
];

/** Per-row state so related fields (name and email, card and brand) agree. */
export class Row {
	readonly rng: Rng;
	readonly valid: boolean;
	private cache = new Map<string, unknown>();

	constructor(rng: Rng, valid: boolean) {
		this.rng = rng;
		this.valid = valid;
	}

	memo<T>(key: string, make: () => T): T {
		if (!this.cache.has(key)) this.cache.set(key, make());
		return this.cache.get(key) as T;
	}

	get first(): string {
		return this.memo("first", () => this.rng.pick(FIRST_NAMES));
	}
	get last(): string {
		return this.memo("last", () => this.rng.pick(LAST_NAMES));
	}
	get place(): Place {
		return this.memo("place", () => this.rng.pick(PLACES));
	}
}

export interface Field {
	id: string;
	label: string;
	category: Category;
	/** True when the field has a checksum or structure rule that "invalid" mode breaks. */
	checksum: boolean;
	description: string;
	gen: (row: Row) => string;
}

// ---------- helpers ----------

function luhnNumber(rng: Rng, prefix: string, length: number, valid: boolean): string {
	const payload = prefix + rng.digits(length - prefix.length - 1);
	const check = luhnCheckDigit(payload);
	return payload + (valid ? check : wrongDigit(check, rng.int(0, 8)));
}

interface Card {
	brand: string;
	number: string;
}

const CARD_BRANDS: readonly { brand: string; prefix: (r: Rng) => string; length: number }[] = [
	{ brand: "Visa", prefix: () => "4", length: 16 },
	{ brand: "Mastercard", prefix: (r) => (r.chance(0.7) ? String(r.int(51, 55)) : String(r.int(2221, 2720))), length: 16 },
	{ brand: "American Express", prefix: (r) => r.pick(["34", "37"]), length: 15 },
	{ brand: "Discover", prefix: (r) => (r.chance(0.5) ? "6011" : "65"), length: 16 },
];

function card(row: Row): Card {
	return row.memo("card", () => {
		const b = row.rng.pick(CARD_BRANDS);
		return { brand: b.brand, number: luhnNumber(row.rng, b.prefix(row.rng), b.length, row.valid) };
	});
}

function ssnParts(row: Row): [string, string, string] {
	const r = row.rng;
	if (row.valid) {
		let area = r.int(1, 899);
		if (area === 666) area = 665;
		return [String(area).padStart(3, "0"), r.padded(1, 99, 2), r.padded(1, 9999, 4)];
	}
	switch (r.int(0, 4)) {
		case 0:
			return ["000", r.padded(1, 99, 2), r.padded(1, 9999, 4)];
		case 1:
			return ["666", r.padded(1, 99, 2), r.padded(1, 9999, 4)];
		case 2:
			return [String(r.int(900, 999)), r.padded(1, 99, 2), r.padded(1, 9999, 4)];
		case 3:
			return [r.padded(1, 665, 3), "00", r.padded(1, 9999, 4)];
		default:
			return [r.padded(1, 665, 3), r.padded(1, 99, 2), "0000"];
	}
}

const ITIN_GROUPS = [
	...range(50, 65),
	...range(70, 88),
	90, 91, 92,
	...range(94, 99),
];

function range(a: number, b: number): number[] {
	return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

const EIN_PREFIXES = [
	"01", "02", "03", "04", "05", "06", "10", "11", "12", "13", "14", "15", "16", "20", "21", "22", "23",
	"24", "25", "26", "27", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42",
	"43", "44", "45", "46", "47", "48", "50", "51", "52", "53", "54", "55", "56", "57", "58", "59", "60",
	"61", "62", "63", "64", "65", "66", "67", "68", "71", "72", "73", "74", "75", "76", "77", "80", "81",
	"82", "83", "84", "85", "86", "87", "88", "90", "91", "92", "93", "94", "95", "98", "99",
];

function dob(row: Row): Date {
	return row.memo("dob", () => {
		const now = new Date();
		const age = row.rng.int(18, 90);
		const d = new Date(Date.UTC(now.getUTCFullYear() - age, row.rng.int(0, 11), row.rng.int(1, 28)));
		return d;
	});
}

function iso(d: Date): string {
	return d.toISOString().slice(0, 10);
}

function driversLicense(row: Row): string {
	const r = row.rng;
	const U = CHARSETS.UPPER;
	switch (row.place.state) {
		case "CA":
			return r.chars(1, U) + r.digits(7);
		case "TX":
			return r.digits(8);
		case "NY":
			return r.digits(9);
		case "FL":
			return `${r.chars(1, U)}${r.digits(3)}-${r.digits(3)}-${r.digits(2)}-${r.digits(3)}-${r.digits(1)}`;
		case "IL":
			return `${r.chars(1, U)}${r.digits(3)}-${r.digits(4)}-${r.digits(4)}`;
		case "WA":
			return "WDL" + r.chars(9, U + CHARSETS.DIGITS);
		case "PA":
			return `${r.digits(2)} ${r.digits(3)} ${r.digits(3)}`;
		default:
			return r.chars(1, U) + r.digits(r.int(7, 8));
	}
}

const IBAN_COUNTRIES: readonly { cc: string; bban: (r: Rng) => string; group: boolean }[] = [
	{ cc: "DE", bban: (r) => r.digits(18), group: true },
	{ cc: "GB", bban: (r) => r.chars(4, CHARSETS.UPPER) + r.digits(14), group: true },
	{ cc: "NL", bban: (r) => r.chars(4, CHARSETS.UPPER) + r.digits(10), group: true },
	{ cc: "CH", bban: (r) => r.digits(17), group: true },
	{ cc: "FR", bban: (r) => r.digits(23), group: true },
];

function iban(row: Row): string {
	const r = row.rng;
	const c = r.pick(IBAN_COUNTRIES);
	const bban = c.bban(r);
	let check = ibanCheckDigits(c.cc, bban);
	if (!row.valid) {
		const n = (Number(check) + r.int(1, 90)) % 97;
		check = String(n < 2 ? n + 2 : n).padStart(2, "0");
	}
	const raw = c.cc + check + bban;
	return raw.replace(/(.{4})(?=.)/g, "$1 ");
}

function abaRouting(row: Row): string {
	const r = row.rng;
	const prefix = String(r.pick([...range(1, 12), ...range(21, 32), ...range(61, 72), 80])).padStart(2, "0");
	const payload = prefix + r.digits(6);
	const check = abaCheckDigit(payload);
	return payload + (row.valid ? check : wrongDigit(check, r.int(0, 8)));
}

const NINO_BAD_FIRST = "DFIQUV";
const NINO_BAD_SECOND = "DFIOQUV";
const NINO_BAD_PREFIX = ["BG", "GB", "KN", "NK", "NT", "TN", "ZZ"];

function nino(row: Row): string {
	const r = row.rng;
	let prefix: string;
	if (row.valid) {
		do {
			prefix =
				r.chars(1, [...CHARSETS.UPPER].filter((c) => !NINO_BAD_FIRST.includes(c)).join("")) +
				r.chars(1, [...CHARSETS.UPPER].filter((c) => !NINO_BAD_SECOND.includes(c)).join(""));
		} while (NINO_BAD_PREFIX.includes(prefix));
	} else {
		prefix = r.pick(["D", "F", "I", "Q", "U", "V"]) + r.chars(1, CHARSETS.UPPER);
	}
	return `${prefix} ${r.digits(2)} ${r.digits(2)} ${r.digits(2)} ${r.pick(["A", "B", "C", "D"])}`;
}

function sin(row: Row): string {
	const first = String(row.rng.pick([1, 2, 3, 4, 5, 6, 7, 9]));
	const n = luhnNumber(row.rng, first, 9, row.valid);
	return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
}

function npi(row: Row): string {
	const first9 = String(row.rng.int(1, 2)) + row.rng.digits(8);
	const check = npiCheckDigit(first9);
	return first9 + (row.valid ? check : wrongDigit(check, row.rng.int(0, 8)));
}

function dea(row: Row): string {
	const r = row.rng;
	const six = r.digits(6);
	const check = deaCheckDigit(six);
	const letters = r.pick(["A", "B", "F", "G", "M"]) + row.last[0].toUpperCase();
	return letters + six + (row.valid ? check : wrongDigit(check, r.int(0, 8)));
}

function icd(row: Row): readonly [string, string] {
	return row.memo("icd", () => row.rng.pick(ICD10));
}

function base64Body(r: Rng, len: number): string {
	return r.chars(len, CHARSETS.ALNUM + "+/");
}

// ---------- registry ----------

export const FIELDS: readonly Field[] = [
	// Identity
	{ id: "full_name", label: "Full name", category: "Identity", checksum: false, description: "First and last name", gen: (r) => `${r.first} ${r.last}` },
	{ id: "first_name", label: "First name", category: "Identity", checksum: false, description: "Given name", gen: (r) => r.first },
	{ id: "last_name", label: "Last name", category: "Identity", checksum: false, description: "Family name", gen: (r) => r.last },
	{ id: "dob", label: "Date of birth", category: "Identity", checksum: false, description: "YYYY-MM-DD, age 18-90", gen: (r) => iso(dob(r)) },
	{ id: "gender", label: "Gender", category: "Identity", checksum: false, description: "M / F / X", gen: (r) => r.memo("gender", () => r.rng.pick(["M", "F", "X"])) },

	// Contact
	{
		id: "email",
		label: "Email",
		category: "Contact",
		checksum: false,
		description: "Name-based address on a reserved example domain",
		gen: (r) => `${r.first}.${r.last}${r.rng.chance(0.5) ? r.rng.int(1, 99) : ""}@${r.rng.pick(EMAIL_DOMAINS)}`.toLowerCase(),
	},
	{
		id: "phone",
		label: "Phone (US)",
		category: "Contact",
		checksum: false,
		description: "(AAA) EEE-NNNN with a real area code for the row's city",
		gen: (r) => `(${r.rng.pick(r.place.areaCodes)}) ${r.rng.int(201, 999)}-${r.rng.digits(4)}`,
	},
	{
		id: "street",
		label: "Street address",
		category: "Contact",
		checksum: false,
		description: "House number, street and suffix",
		gen: (r) => `${r.rng.int(10, 9999)} ${r.rng.pick(STREET_NAMES)} ${r.rng.pick(STREET_SUFFIXES)}`,
	},
	{ id: "city", label: "City", category: "Contact", checksum: false, description: "US city", gen: (r) => r.place.city },
	{ id: "state", label: "State", category: "Contact", checksum: false, description: "Two-letter state code", gen: (r) => r.place.state },
	{ id: "zip", label: "ZIP code", category: "Contact", checksum: false, description: "5-digit ZIP matching the city", gen: (r) => r.place.zip3 + r.rng.digits(2) },

	// Government ID
	{
		id: "ssn",
		label: "SSN",
		category: "Government ID",
		checksum: true,
		description: "AAA-GG-SSSS; invalid mode uses area 000/666/9xx, group 00 or serial 0000",
		gen: (r) => ssnParts(r).join("-"),
	},
	{
		id: "itin",
		label: "ITIN",
		category: "Government ID",
		checksum: true,
		description: "9XX-YY-ZZZZ with a valid IRS group range",
		gen: (r) => {
			const g = r.valid ? r.rng.pick(ITIN_GROUPS) : r.rng.pick([...range(0, 49), 66, 89, 93]);
			return `9${r.rng.digits(2)}-${String(g).padStart(2, "0")}-${r.rng.digits(4)}`;
		},
	},
	{
		id: "ein",
		label: "EIN",
		category: "Government ID",
		checksum: true,
		description: "XX-XXXXXXX with an IRS campus prefix",
		gen: (r) => `${r.valid ? r.rng.pick(EIN_PREFIXES) : r.rng.pick(["00", "07", "08", "09", "17", "18", "19", "28", "29", "49", "69", "70", "78", "79", "89", "96", "97"])}-${r.rng.digits(7)}`,
	},
	{ id: "drivers_license", label: "Driver's license", category: "Government ID", checksum: false, description: "Format follows the row's state (CA, TX, NY, FL, IL, WA, PA)", gen: driversLicense },
	{
		id: "passport_us",
		label: "US passport",
		category: "Government ID",
		checksum: false,
		description: "9 digits, or a letter and 8 digits (Next Generation)",
		gen: (r) => (r.rng.chance(0.5) ? r.rng.digits(9) : r.rng.chars(1, CHARSETS.UPPER) + r.rng.digits(8)),
	},
	{ id: "uk_nino", label: "UK National Insurance no.", category: "Government ID", checksum: true, description: "AB 12 34 56 C with HMRC prefix rules", gen: nino },
	{ id: "ca_sin", label: "Canadian SIN", category: "Government ID", checksum: true, description: "NNN NNN NNN, Luhn-checked", gen: sin },

	// Financial
	{ id: "cc_number", label: "Credit card number", category: "Financial", checksum: true, description: "Visa, Mastercard, Amex or Discover; Luhn-checked", gen: (r) => card(r).number },
	{ id: "cc_brand", label: "Card brand", category: "Financial", checksum: false, description: "Brand matching the row's card number", gen: (r) => card(r).brand },
	{
		id: "cc_expiry",
		label: "Card expiry",
		category: "Financial",
		checksum: false,
		description: "MM/YY in the next 5 years",
		gen: (r) => `${r.rng.padded(1, 12, 2)}/${String((new Date().getUTCFullYear() + r.rng.int(1, 5)) % 100).padStart(2, "0")}`,
	},
	{ id: "cc_cvv", label: "CVV", category: "Financial", checksum: false, description: "3 digits, or 4 for Amex", gen: (r) => r.rng.digits(card(r).brand === "American Express" ? 4 : 3) },
	{ id: "iban", label: "IBAN", category: "Financial", checksum: true, description: "DE, GB, NL, CH or FR with mod-97 check digits", gen: iban },
	{ id: "aba_routing", label: "ABA routing number", category: "Financial", checksum: true, description: "9 digits with the 3-7-1 checksum", gen: abaRouting },
	{ id: "bank_account", label: "Bank account (US)", category: "Financial", checksum: false, description: "8-12 digits", gen: (r) => r.rng.digits(r.rng.int(8, 12)) },
	{ id: "swift_bic", label: "SWIFT/BIC", category: "Financial", checksum: false, description: "8 or 11 characters", gen: (r) => r.rng.chars(4, CHARSETS.UPPER) + r.rng.pick(["US", "GB", "DE", "FR", "CH", "NL"]) + r.rng.chars(2, CHARSETS.UPPER + CHARSETS.DIGITS) + (r.rng.chance(0.5) ? r.rng.chars(3, CHARSETS.UPPER + CHARSETS.DIGITS) : "") },

	// Health
	{ id: "mrn", label: "Medical record no.", category: "Health", checksum: false, description: "MRN followed by 8 digits", gen: (r) => `MRN${r.rng.digits(8)}` },
	{ id: "npi", label: "NPI", category: "Health", checksum: true, description: "10-digit provider ID, Luhn over 80840 prefix", gen: npi },
	{ id: "dea", label: "DEA number", category: "Health", checksum: true, description: "Two letters and 7 digits with DEA checksum", gen: dea },
	{ id: "icd10", label: "ICD-10 code", category: "Health", checksum: false, description: "Common diagnosis code", gen: (r) => icd(r)[0] },
	{ id: "diagnosis", label: "Diagnosis", category: "Health", checksum: false, description: "Description matching the ICD-10 code", gen: (r) => icd(r)[1] },
	{ id: "medication", label: "Medication", category: "Health", checksum: false, description: "Drug and dose", gen: (r) => r.rng.pick(MEDICATIONS) },
	{ id: "insurer", label: "Health insurer", category: "Health", checksum: false, description: "Payer name", gen: (r) => r.rng.pick(INSURERS) },
	{
		id: "member_id",
		label: "Insurance member ID",
		category: "Health",
		checksum: false,
		description: "3 letters and 9 digits",
		gen: (r) => r.rng.chars(3, CHARSETS.UPPER) + r.rng.digits(9),
	},
	{
		id: "mbi",
		label: "Medicare MBI",
		category: "Health",
		checksum: true,
		description: "11-character Medicare Beneficiary Identifier",
		gen: (r) => {
			const rng = r.rng;
			const L = "ACDEFGHJKMNPQRTUVWXY"; // excludes S, L, O, I, B, Z
			const AN = L + CHARSETS.DIGITS;
			const first = r.valid ? String(rng.int(1, 9)) : "0";
			return first + rng.chars(1, L) + rng.chars(1, AN) + rng.digits(1) + "-" + rng.chars(1, L) + rng.chars(1, AN) + rng.digits(1) + "-" + rng.chars(2, L) + rng.digits(2);
		},
	},

	// Secrets
	{ id: "aws_access_key_id", label: "AWS access key ID", category: "Secrets", checksum: false, description: "AKIA followed by 16 base32 characters", gen: (r) => "AKIA" + r.rng.chars(16, "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567") },
	{ id: "aws_secret_key", label: "AWS secret key", category: "Secrets", checksum: false, description: "40 base64 characters", gen: (r) => base64Body(r.rng, 40) },
	{ id: "github_pat", label: "GitHub token", category: "Secrets", checksum: false, description: "ghp_ followed by 36 characters", gen: (r) => "ghp_" + r.rng.chars(36, CHARSETS.ALNUM) },
	{
		id: "slack_token",
		label: "Slack bot token",
		category: "Secrets",
		checksum: false,
		description: "xoxb- token shape",
		gen: (r) => `xoxb-${r.rng.digits(12)}-${r.rng.digits(13)}-${r.rng.chars(24, CHARSETS.ALNUM)}`,
	},
	{ id: "stripe_key", label: "Stripe secret key", category: "Secrets", checksum: false, description: "sk_live_ followed by 24 characters", gen: (r) => "sk_live_" + r.rng.chars(24, CHARSETS.ALNUM) },
	{
		id: "private_key",
		label: "Private key (PEM)",
		category: "Secrets",
		checksum: false,
		description: "RSA PEM block with a random body (not a usable key)",
		gen: (r) => {
			const lines = Array.from({ length: 4 }, () => base64Body(r.rng, 64));
			return ["-----BEGIN RSA PRIVATE KEY-----", "MIIEpAIBAAKCAQEA" + base64Body(r.rng, 48), ...lines, "-----END RSA PRIVATE KEY-----"].join("\n");
		},
	},
	{
		id: "password",
		label: "Password",
		category: "Secrets",
		checksum: false,
		description: "Random 12-16 character password",
		gen: (r) => r.rng.chars(r.rng.int(12, 16), CHARSETS.ALNUM + "!@#$%^&*"),
	},

	// Network
	{ id: "ipv4", label: "IPv4 address", category: "Network", checksum: false, description: "Dotted quad", gen: (r) => [r.rng.int(1, 223), r.rng.int(0, 255), r.rng.int(0, 255), r.rng.int(1, 254)].join(".") },
	{
		id: "mac",
		label: "MAC address",
		category: "Network",
		checksum: false,
		description: "Colon-separated hex",
		gen: (r) => Array.from({ length: 6 }, () => r.rng.chars(2, "0123456789ABCDEF")).join(":"),
	},
	{ id: "username", label: "Username", category: "Network", checksum: false, description: "Initial plus last name", gen: (r) => (r.first[0] + r.last + r.rng.int(1, 99)).toLowerCase() },
];

export const FIELD_MAP: ReadonlyMap<string, Field> = new Map(FIELDS.map((f) => [f.id, f]));

export const PRESETS: Readonly<Record<string, { label: string; fields: readonly string[] }>> = {
	pii: { label: "PII basics", fields: ["full_name", "dob", "email", "phone", "street", "city", "state", "zip", "ssn"] },
	pci: { label: "PCI (cards)", fields: ["full_name", "cc_number", "cc_brand", "cc_expiry", "cc_cvv", "zip"] },
	phi: { label: "HIPAA / PHI", fields: ["full_name", "dob", "ssn", "mrn", "icd10", "diagnosis", "medication", "insurer", "member_id", "npi"] },
	banking: { label: "Banking", fields: ["full_name", "aba_routing", "bank_account", "iban", "swift_bic"] },
	gov: { label: "Government IDs", fields: ["full_name", "ssn", "itin", "drivers_license", "passport_us", "uk_nino", "ca_sin"] },
	secrets: { label: "Secrets & keys", fields: ["username", "password", "aws_access_key_id", "aws_secret_key", "github_pat", "slack_token", "stripe_key"] },
};
