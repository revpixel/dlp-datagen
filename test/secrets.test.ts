// Secrets v2: format, near-miss, determinism, preset, API and output-format tests,
// plus a byte-level check that every pre-v2 field and preset is unchanged.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { handleApi } from "../src/api.ts";
import { WRAP_FOR_TESTS, toDocx, toPdf, toXlsx, wrapValue } from "../src/lib/documents.ts";
import { FIELDS, FIELD_MAP, PRESETS } from "../src/lib/fields.ts";
import { FORMATS, generate, render, serialize } from "../src/lib/generate.ts";
import {
	SEED_DEFAULT0,
	SEED_MANAGE00,
	base64,
	caskChecksumValid,
	fromBase64,
	identifiableChecksumValid,
	marvin,
	toBase62,
} from "../src/lib/secrets.ts";
import { inflateParts } from "./zip-helper.ts";

const N = 400;
const NEW_IDS = [
	"entra_client_secret",
	"azure_devops_pat",
	"azure_storage_key",
	"azure_storage_connection_string",
	"azure_service_bus_connection_string",
	"azure_sas",
	"gcp_api_key",
	"jwt",
	"bearer_token",
];

function column(field: string, valid: boolean, seed = "secrets-v2"): string[] {
	return generate({ fields: [field], rows: N, valid, seed }).records.map((r) => r[0]);
}

const URL_UNRESERVED = /^[A-Za-z0-9._~-]+$/;
const B64URL = /^[A-Za-z0-9_-]+$/;
const json = (segment: string) => JSON.parse(new TextDecoder().decode(fromBase64(segment)));

// ---------- primitives ----------

test("Marvin32 matches Microsoft's published test vectors", () => {
	// From microsoft/security-utilities src/security_utilities_rust/src/marvin_tests.rs
	const h64 = (bytes: number[], seed: bigint) => {
		const [p0, p1] = marvin(new Uint8Array(bytes), [Number(seed & 0xffffffffn), Number(seed >> 32n)]);
		return (BigInt(p1 >>> 0) << 32n) | BigInt(p0 >>> 0);
	};
	const seed0 = 0x004fb61a001bdbccn;
	assert.equal(h64([], seed0), 0x30ed35c100cd3c7dn);
	assert.equal(h64([175], seed0), 0x48e73fc77d75ddc1n);
	assert.equal(h64([231, 15], seed0), 0xb5f6e1fc485dbff8n);
	assert.equal(h64([55, 244, 149], seed0), 0xf0b07c789b8cf7e8n);
	assert.equal(h64([134, 66, 220, 89], seed0), 0x7008f2e87e9cf556n);
	assert.equal(h64([21, 63, 183, 152, 38], seed0), 0xe6c08c6da2afa997n);
	assert.equal(h64([9, 50, 230, 36, 108, 71], seed0), 0x6f04bf1a5ea24060n);
	assert.equal(h64([171, 66, 126, 168, 209, 15, 199], seed0), 0xe11847e4f0678c41n);
	assert.equal(h64([..."abc"].map((c) => c.charCodeAt(0)), 0xd53cd9cecd0893b7n), 0x22c74339492769bfn);
	assert.equal(h64([..."abcdefghijklmnopqrstuvwxyz"].map((c) => c.charCodeAt(0)), 0xddddeeeeffff000n), 0xa128eb7e7260aca2n);
});

test("base64 and base62 helpers round-trip", () => {
	for (let n = 0; n < 40; n++) {
		const bytes = new Uint8Array(n).map((_, i) => (i * 37 + n) & 0xff);
		assert.deepEqual(fromBase64(base64(bytes)), bytes);
		assert.deepEqual(fromBase64(base64(bytes, true)), bytes);
	}
	assert.equal(base64(new TextEncoder().encode('{"alg":"HS256","typ":"JWT"}'), true), "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
	assert.equal(toBase62(new Uint8Array([0, 0, 1])), "001");
	assert.equal(toBase62(new Uint8Array([0xff, 0xff, 0xff, 0xff])), "4gfFC3");
});

// ---------- per-field shape, valid mode and near-miss ----------

test("entra_client_secret: 40 chars with 8Q~ at 4-6; near-miss is 39", () => {
	for (const v of column("entra_client_secret", true)) {
		assert.equal(v.length, 40);
		assert.equal(v.slice(3, 6), "8Q~");
		assert.match(v, URL_UNRESERVED);
	}
	for (const v of column("entra_client_secret", false)) {
		assert.equal(v.length, 39, "near-miss keeps the 8Q~ shape but is one character short");
		assert.equal(v.slice(3, 6), "8Q~");
		assert.match(v, URL_UNRESERVED);
	}
});

const CASK = /^[0-9A-Za-z]{52}JQQJ99[A-C][A-L][0-9A-Za-z]{12}AAAAAZDO[0-9A-Za-z]{4}$/;

test("azure_devops_pat: 84-char CASK key; checksum passes, near-miss fails it", () => {
	for (const v of column("azure_devops_pat", true)) {
		assert.match(v, CASK);
		assert.ok(caskChecksumValid(v), v);
	}
	for (const v of column("azure_devops_pat", false)) {
		assert.match(v, CASK, "near-miss keeps every fixed part");
		assert.ok(!caskChecksumValid(v), v);
	}
});

const STORAGE_KEY = /^[A-Za-z0-9+/]{76}\+ASt[A-Za-z0-9+/]{5}[AQgw]==$/;
const SB_KEY = /^[A-Za-z0-9+/]{33}\+ASb[A-P][A-Za-z0-9+/]{5}=$/;

test("azure_storage_key: 88-char identifiable key; Marvin checksum passes, near-miss fails it", () => {
	for (const v of column("azure_storage_key", true)) {
		assert.match(v, STORAGE_KEY);
		assert.equal(fromBase64(v).length, 64);
		assert.ok(identifiableChecksumValid(v, SEED_DEFAULT0), v);
	}
	for (const v of column("azure_storage_key", false)) {
		assert.match(v, STORAGE_KEY);
		assert.ok(!identifiableChecksumValid(v, SEED_DEFAULT0), v);
	}
});

test("azure_storage_connection_string: storage format, fictional account, checksummed key", () => {
	const re = /^DefaultEndpointsProtocol=https;AccountName=(example[a-z]+\d{4});AccountKey=([^;]+);EndpointSuffix=core\.windows\.net$/;
	for (const valid of [true, false]) {
		for (const v of column("azure_storage_connection_string", valid)) {
			const m = re.exec(v);
			assert.ok(m, v);
			assert.ok(m[1].length >= 3 && m[1].length <= 24);
			assert.match(m[2], STORAGE_KEY);
			assert.equal(identifiableChecksumValid(m[2], SEED_DEFAULT0), valid);
		}
	}
});

test("azure_service_bus_connection_string: RootManage key with +ASb and Manage00 checksum", () => {
	const re = /^Endpoint=sb:\/\/(example-[a-z]+-\d{4})\.servicebus\.windows\.net\/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=(.+)$/;
	for (const valid of [true, false]) {
		for (const v of column("azure_service_bus_connection_string", valid)) {
			const m = re.exec(v);
			assert.ok(m, v);
			assert.match(m[2], SB_KEY);
			assert.equal(fromBase64(m[2]).length, 32);
			assert.equal(identifiableChecksumValid(m[2], SEED_MANAGE00), valid);
		}
	}
});

test("azure_sas: service SAS URL; sig is 32 bytes valid, 24 bytes near-miss", () => {
	for (const valid of [true, false]) {
		for (const v of column("azure_sas", valid)) {
			const url = new URL(v);
			assert.equal(url.protocol, "https:");
			assert.match(url.hostname, /^example[a-z]+\d{4}\.blob\.core\.windows\.net$/);
			const q = url.searchParams;
			assert.deepEqual([...q.keys()], ["sp", "st", "se", "spr", "sv", "sr", "sig"]);
			assert.equal(q.get("sv"), "2022-11-02");
			assert.equal(q.get("sr"), "b");
			assert.equal(q.get("spr"), "https");
			assert.match(q.get("sp")!, /^r?a?c?w?d?$/);
			const st = Date.parse(q.get("st")!);
			const se = Date.parse(q.get("se")!);
			assert.ok(st >= Date.UTC(2025, 0, 1) && st < Date.UTC(2026, 0, 1), "start is in the fixed 2025 window");
			assert.ok(se > st);
			assert.ok(!/[+/=]/.test(v.split("sig=")[1]), "signature is percent-encoded");
			assert.equal(fromBase64(q.get("sig")!).length, valid ? 32 : 24);
		}
	}
});

test("gcp_api_key: AIza + 35 characters, same rule in both modes", () => {
	for (const valid of [true, false]) {
		for (const v of column("gcp_api_key", valid)) assert.match(v, /^AIzaSy[A-Za-z0-9_-]{33}$/);
	}
	assert.equal(FIELD_MAP.get("gcp_api_key")!.checksum, false);
});

test("jwt: decodable HS256 header and synthetic claims; near-miss has two segments", () => {
	for (const v of column("jwt", true)) {
		const parts = v.split(".");
		assert.equal(parts.length, 3);
		parts.forEach((p) => assert.match(p, B64URL));
		assert.deepEqual(json(parts[0]), { alg: "HS256", typ: "JWT" });
		const claims = json(parts[1]);
		assert.deepEqual(Object.keys(claims), ["iss", "sub", "aud", "iat", "exp", "jti"]);
		assert.equal(claims.iss, "https://auth.example.com");
		assert.equal(claims.aud, "api.example.org");
		assert.match(claims.sub, /^user-\d{6}$/);
		assert.ok(claims.iat >= Date.UTC(2025, 0, 1) / 1000 && claims.iat < Date.UTC(2026, 0, 1) / 1000);
		assert.equal(claims.exp, claims.iat + 3600);
		assert.equal(fromBase64(parts[2]).length, 32);
	}
	for (const v of column("jwt", false)) {
		const parts = v.split(".");
		assert.equal(parts.length, 2, "near-miss is missing the signature segment");
		assert.ok(v.startsWith("eyJ"));
		json(parts[0]);
		json(parts[1]);
	}
});

test("bearer_token: full Authorization header with an RFC 6750 token, same in both modes", () => {
	for (const valid of [true, false]) {
		for (const v of column("bearer_token", valid)) {
			const m = /^Authorization: Bearer ([A-Za-z0-9][A-Za-z0-9._~-]{31,47})$/.exec(v);
			assert.ok(m, v);
			assert.ok(!m[1].startsWith("eyJ"), "opaque token, not a JWT");
		}
	}
	assert.equal(FIELD_MAP.get("bearer_token")!.checksum, false);
});

test("storage fields in one row share the account and key", () => {
	const ds = generate({ fields: ["azure_storage_key", "azure_storage_connection_string", "azure_sas"], rows: 50, seed: "row" });
	for (const [key, conn, sas] of ds.records) {
		assert.ok(conn.includes(`AccountKey=${key};`));
		const account = /AccountName=([^;]+)/.exec(conn)![1];
		assert.equal(new URL(sas).hostname, `${account}.blob.core.windows.net`);
	}
});

// ---------- metadata, determinism, presets ----------

test("new fields are in the Secrets category with labels and descriptions", () => {
	for (const id of NEW_IDS) {
		const f = FIELD_MAP.get(id);
		assert.ok(f, id);
		assert.equal(f.category, "Secrets");
		assert.ok(f.label && f.description);
	}
	const checksummed = NEW_IDS.filter((id) => FIELD_MAP.get(id)!.checksum);
	assert.deepEqual(checksummed, ["entra_client_secret", "azure_devops_pat", "azure_storage_key", "azure_storage_connection_string", "azure_service_bus_connection_string", "azure_sas", "jwt"]);
	assert.equal(FIELDS.length, 54);
});

test("new fields are deterministic per seed and independent of the clock", () => {
	const a = generate({ fields: NEW_IDS, rows: 25, seed: "det" });
	const RealDate = Date;
	// Move "now" forward ten years: nothing in the new fields may change.
	globalThis.Date = class extends RealDate {
		constructor(...args: []) {
			super(...((args.length ? args : [RealDate.UTC(2036, 5, 1)]) as []));
		}
		static now() {
			return RealDate.UTC(2036, 5, 1);
		}
	} as DateConstructor;
	try {
		const b = generate({ fields: NEW_IDS, rows: 25, seed: "det" });
		assert.deepEqual(a.records, b.records);
	} finally {
		globalThis.Date = RealDate;
	}
	assert.notDeepEqual(a.records, generate({ fields: NEW_IDS, rows: 25, seed: "det2" }).records);
});

test("presets: cloud_secrets added, every existing preset unchanged", () => {
	const fixture = JSON.parse(readFileSync(new URL("./fixtures/v1-compat.json", import.meta.url), "utf8"));
	for (const [name, fields] of Object.entries(fixture.presets)) assert.deepEqual(PRESETS[name].fields, fields, name);
	assert.deepEqual(PRESETS.cloud_secrets.fields, [
		"aws_access_key_id",
		"aws_secret_key",
		"github_pat",
		"entra_client_secret",
		"azure_devops_pat",
		"azure_storage_key",
		"azure_storage_connection_string",
		"azure_service_bus_connection_string",
		"azure_sas",
		"gcp_api_key",
		"jwt",
		"bearer_token",
	]);
	for (const id of PRESETS.cloud_secrets.fields) assert.ok(FIELD_MAP.has(id));
});

test("v1 compatibility: old fields and presets produce byte-identical output in every format", async () => {
	const fixture = JSON.parse(readFileSync(new URL("./fixtures/v1-compat.json", import.meta.url), "utf8"));
	for (const id of fixture.fields) assert.ok(FIELD_MAP.has(id), `field ${id} still exists`);
	// dob and cc_expiry follow the current year; pin it to when the fixture was made.
	const RealDate = Date;
	globalThis.Date = class extends RealDate {
		constructor(...args: []) {
			super(...((args.length ? args : [RealDate.UTC(2026, 10, 18)]) as []));
		}
	} as DateConstructor;
	try {
		const sets: Record<string, string[]> = { all: fixture.fields, ...fixture.presets };
		for (const [key, expected] of Object.entries(fixture.sha256_16) as [string, string][]) {
			const [set, mode, format] = key.split("/");
			const ds = generate({ fields: sets[set], rows: 40, seed: "compat", valid: mode === "valid" });
			const body = await render(ds, format as never, true);
			const hash = createHash("sha256").update(typeof body === "string" ? body : Buffer.from(body)).digest("hex").slice(0, 16);
			assert.equal(hash, expected, key);
		}
	} finally {
		globalThis.Date = RealDate;
	}
});

// ---------- API ----------

test("API: /api/fields exposes the new fields and preset", async () => {
	const body = await (await handleApi(new Request("https://x/api/fields"))).json();
	assert.equal(body.fields.length, 54);
	for (const id of NEW_IDS) {
		const f = body.fields.find((x: { id: string }) => x.id === id);
		assert.ok(f, id);
		assert.deepEqual(Object.keys(f), ["id", "label", "category", "checksum", "description"]);
	}
	assert.deepEqual(body.presets.cloud_secrets.fields, PRESETS.cloud_secrets.fields);
	assert.equal(body.presets.cloud_secrets.label, "Cloud secrets & tokens");
});

test("API: cloud_secrets preset and fields= work in every format", async () => {
	for (const format of FORMATS) {
		const res = await handleApi(new Request(`https://x/api/generate?preset=cloud_secrets&rows=5&format=${format}&seed=api`));
		assert.equal(res.status, 200, format);
		assert.equal(res.headers.get("X-DLP-Seed"), "api");
		assert.ok((await res.arrayBuffer()).byteLength > 0);
	}
	const res = await handleApi(new Request(`https://x/api/generate?fields=${NEW_IDS.join(",")}&rows=3&seed=api&valid=false&format=ndjson`));
	const rows = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
	assert.equal(rows.length, 3);
	assert.deepEqual(Object.keys(rows[0]), NEW_IDS);
	assert.equal(rows[0].jwt.split(".").length, 2);
});

// ---------- output formats ----------

const ds = generate({ fields: ["full_name", ...NEW_IDS], rows: 30, seed: "formats" });

test("CSV and JSON round-trip connection strings, SAS URLs, JWTs and headers exactly", () => {
	const parsed = JSON.parse(serialize(ds, "json"));
	ds.records.forEach((rec, r) => rec.forEach((v, i) => assert.equal(parsed[r][ds.fields[i].id], v)));
	const nd = serialize(ds, "ndjson").trim().split("\n").map((l) => JSON.parse(l));
	ds.records.forEach((rec, r) => rec.forEach((v, i) => assert.equal(nd[r][ds.fields[i].id], v)));
	// None of the new values needs CSV quoting (no comma, quote or newline), so each line is the values joined.
	const lines = serialize(ds, "csv").trimEnd().split("\r\n");
	assert.equal(lines[0], ["full_name", ...NEW_IDS].join(","));
	ds.records.forEach((rec, r) => assert.equal(lines[r + 1], rec.join(",")));
});

test("TXT puts each label next to its value for keyword context", () => {
	const txt = serialize(ds, "txt");
	for (const rec of ds.records) {
		ds.fields.forEach((f, i) => assert.ok(txt.includes(`\n${f.label}: ${rec[i]}\n`), f.id));
	}
	assert.ok(txt.includes("Entra client secret: "));
	assert.ok(txt.includes("Azure DevOps PAT: "));
	assert.ok(txt.includes("Bearer token (HTTP header): Authorization: Bearer "));
});

test("XLSX and DOCX escape & and keep every value intact", async () => {
	const esc = (s: string) => s.replace(/&/g, "&amp;");
	const sheet = (await inflateParts(await toXlsx(ds))).get("xl/worksheets/sheet1.xml")!;
	const doc = (await inflateParts(await toDocx(ds))).get("word/document.xml")!;
	for (const rec of ds.records) {
		for (const v of rec) {
			assert.ok(sheet.includes(`<t xml:space="preserve">${esc(v)}</t>`), v);
			assert.ok(doc.includes(`<w:t xml:space="preserve">${esc(v)}</w:t>`), v);
		}
	}
	for (const xml of [sheet, doc]) assert.ok(!/>[^<]*&(?!amp;|lt;|gt;|quot;)/.test(xml), "unescaped ampersand");
});

test("PDF wraps long values at delimiters and keeps keys and signatures on one line", () => {
	const pdf = new TextDecoder().decode(toPdf(ds));
	const shown = [...pdf.matchAll(/\((.*)\) Tj/g)].map((m) => m[1].replace(/\\([\\()])/g, "$1"));
	for (const line of shown) if (!line.startsWith("Synthetic records")) assert.ok(line.length <= WRAP_FOR_TESTS, line);
	for (const rec of ds.records) {
		const key = rec[NEW_IDS.indexOf("azure_storage_key") + 1];
		assert.ok(shown.includes(key), "storage key has its own line inside the connection string");
		const sbKey = /SharedAccessKey=(.+)$/.exec(rec[NEW_IDS.indexOf("azure_service_bus_connection_string") + 1])![1];
		assert.ok(shown.some((l) => l.includes(sbKey)));
		const sig = /sig=(.+)$/.exec(rec[NEW_IDS.indexOf("azure_sas") + 1])![1];
		assert.ok(shown.some((l) => l.includes(sig)), "SAS signature stays on one line");
		assert.ok(shown.includes(`Entra client secret: ${rec[NEW_IDS.indexOf("entra_client_secret") + 1]}`));
	}
	assert.ok(shown.includes("Azure Storage connection string:"));
	const startxref = Number(/startxref\n(\d+)/.exec(pdf)![1]);
	const offsets = [...pdf.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
	offsets.forEach((o, i) => assert.ok(pdf.slice(o).startsWith(`${i + 1} 0 obj`)));
});

test("wrapValue: rejoins exactly, respects the width, splits after = and before ;", () => {
	for (const rec of ds.records) {
		for (const v of rec) {
			const parts = wrapValue(v);
			assert.equal(parts.join(""), v);
			for (const p of parts) assert.ok(p.length <= WRAP_FOR_TESTS);
		}
	}
	assert.deepEqual(wrapValue("a=b;c=d"), ["a=b;c=d"]);
	assert.deepEqual(wrapValue("x".repeat(WRAP_FOR_TESTS * 2 + 3)).map((p) => p.length), [WRAP_FOR_TESTS, WRAP_FOR_TESTS, 3]);
});

test("same seed gives byte-identical documents with the new fields", async () => {
	const again = generate({ fields: ["full_name", ...NEW_IDS], rows: 30, seed: "formats" });
	assert.deepEqual(await toXlsx(ds), await toXlsx(again));
	assert.deepEqual(await toDocx(ds), await toDocx(again));
	assert.deepEqual(toPdf(ds), toPdf(again));
});
