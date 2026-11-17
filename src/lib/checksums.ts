// Check-digit algorithms that real DLP engines use to confirm a match.

/** Luhn check digit for a numeric payload (the number without its final digit). */
export function luhnCheckDigit(payload: string): number {
	let sum = 0;
	let double = true;
	for (let i = payload.length - 1; i >= 0; i--) {
		let d = payload.charCodeAt(i) - 48;
		if (double) {
			d *= 2;
			if (d > 9) d -= 9;
		}
		sum += d;
		double = !double;
	}
	return (10 - (sum % 10)) % 10;
}

export function luhnValid(value: string): boolean {
	const digits = value.replace(/\D/g, "");
	if (digits.length < 2) return false;
	return luhnCheckDigit(digits.slice(0, -1)) === Number(digits.at(-1));
}

/** ABA routing number check digit (weights 3,7,1). Payload is the first 8 digits. */
export function abaCheckDigit(payload: string): number {
	const w = [3, 7, 1, 3, 7, 1, 3, 7];
	let sum = 0;
	for (let i = 0; i < 8; i++) sum += (payload.charCodeAt(i) - 48) * w[i];
	return (10 - (sum % 10)) % 10;
}

export function abaValid(value: string): boolean {
	if (!/^\d{9}$/.test(value)) return false;
	return abaCheckDigit(value.slice(0, 8)) === Number(value[8]);
}

/** Remainder of a long numeric string mod 97, without BigInt. */
function mod97(numeric: string): number {
	let rem = 0;
	for (let i = 0; i < numeric.length; i += 7) {
		rem = Number(String(rem) + numeric.slice(i, i + 7)) % 97;
	}
	return rem;
}

function ibanNumeric(s: string): string {
	return s
		.toUpperCase()
		.split("")
		.map((c) => (c >= "A" && c <= "Z" ? String(c.charCodeAt(0) - 55) : c))
		.join("");
}

/** Two-digit IBAN check value for a country code and BBAN. */
export function ibanCheckDigits(country: string, bban: string): string {
	const rem = mod97(ibanNumeric(bban + country + "00"));
	return String(98 - rem).padStart(2, "0");
}

export function ibanValid(value: string): boolean {
	const s = value.replace(/\s/g, "").toUpperCase();
	if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s)) return false;
	return mod97(ibanNumeric(s.slice(4) + s.slice(0, 4))) === 1;
}

/** NPI check digit: Luhn over the "80840" prefix plus the first 9 digits. */
export function npiCheckDigit(first9: string): number {
	return luhnCheckDigit("80840" + first9);
}

export function npiValid(value: string): boolean {
	if (!/^[12]\d{9}$/.test(value)) return false;
	return npiCheckDigit(value.slice(0, 9)) === Number(value[9]);
}

/** DEA registration number check digit over its 6 leading digits. */
export function deaCheckDigit(six: string): number {
	const d = six.split("").map(Number);
	return (d[0] + d[2] + d[4] + 2 * (d[1] + d[3] + d[5])) % 10;
}

export function deaValid(value: string): boolean {
	if (!/^[A-Z]{2}\d{7}$/.test(value)) return false;
	return deaCheckDigit(value.slice(2, 8)) === Number(value[8]);
}

/** Returns a digit guaranteed to differ from `correct`. */
export function wrongDigit(correct: number, offset: number): number {
	return (correct + 1 + (offset % 9)) % 10;
}
