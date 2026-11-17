import assert from "node:assert/strict";
import { test } from "node:test";
import { abaValid, deaValid, ibanValid, luhnValid, npiValid } from "../src/lib/checksums.ts";
import { FIELDS } from "../src/lib/fields.ts";
import { generate, serialize } from "../src/lib/generate.ts";
import { toDocx, toPdf, toXlsx } from "../src/lib/documents.ts";
import { crc32 } from "../src/lib/zip.ts";
import { handleApi } from "../src/api.ts";

const N = 500;

function column(field: string, valid: boolean, seed = "test-seed"): string[] {
	return generate({ fields: [field], rows: N, valid, seed }).records.map((r) => r[0]);
}

function ssnValid(s: string): boolean {
	const m = /^(\d{3})-(\d{2})-(\d{4})$/.exec(s);
	if (!m) return false;
	const area = Number(m[1]);
	return area !== 0 && area !== 666 && area < 900 && m[2] !== "00" && m[3] !== "0000";
}

test("known checksum vectors", () => {
	assert.ok(luhnValid("4111111111111111"));
	assert.ok(!luhnValid("4111111111111112"));
	assert.ok(abaValid("011000015"));
	assert.ok(ibanValid("GB82 WEST 1234 5698 7654 32"));
	assert.ok(ibanValid("DE89370400440532013000"));
	assert.ok(!ibanValid("GB83 WEST 1234 5698 7654 32"));
	assert.ok(npiValid("1234567893"));
	assert.ok(deaValid("AB1234563"));
});

const cases: [string, (v: string) => boolean][] = [
	["cc_number", luhnValid],
	["ssn", ssnValid],
	["aba_routing", abaValid],
	["iban", ibanValid],
	["npi", npiValid],
	["dea", deaValid],
	["ca_sin", luhnValid],
];

for (const [field, check] of cases) {
	test(`${field}: valid mode always passes`, () => {
		for (const v of column(field, true)) assert.ok(check(v), `${field} should be valid: ${v}`);
	});
	test(`${field}: invalid mode always fails`, () => {
		for (const v of column(field, false)) assert.ok(!check(v), `${field} should be invalid: ${v}`);
	});
}

test("card prefixes and lengths match their brand", () => {
	const ds = generate({ fields: ["cc_number", "cc_brand"], rows: N, seed: "cards" });
	for (const [num, brand] of ds.records) {
		if (brand === "Visa") assert.match(num, /^4\d{15}$/);
		if (brand === "Mastercard") assert.match(num, /^(5[1-5]|2[2-7])\d{14}$/);
		if (brand === "American Express") assert.match(num, /^3[47]\d{13}$/);
		if (brand === "Discover") assert.match(num, /^6(011|5)\d+$/);
		assert.equal(num.length, brand === "American Express" ? 15 : 16);
	}
});

test("same seed gives identical output; different seed differs", () => {
	const ids = FIELDS.map((f) => f.id);
	const a = generate({ fields: ids, rows: 20, seed: "abc" });
	const b = generate({ fields: ids, rows: 20, seed: "abc" });
	const c = generate({ fields: ids, rows: 20, seed: "abd" });
	assert.deepEqual(a.records, b.records);
	assert.notDeepEqual(a.records, c.records);
});

test("every field generates a non-empty string in both modes", () => {
	const ids = FIELDS.map((f) => f.id);
	for (const valid of [true, false]) {
		for (const rec of generate({ fields: ids, rows: 50, valid }).records) {
			rec.forEach((v, i) => assert.ok(typeof v === "string" && v.length > 0, `${ids[i]} empty`));
		}
	}
});

test("emails only use reserved example domains", () => {
	for (const v of column("email", true)) assert.match(v, /@example\.(com|org|net)$/);
});

test("CSV quotes multi-line and comma values", () => {
	const ds = generate({ fields: ["private_key", "diagnosis"], rows: 3, seed: "csv" });
	const csv = serialize(ds, "csv");
	assert.ok(csv.startsWith("private_key,diagnosis\r\n"));
	assert.ok(csv.includes('"-----BEGIN RSA PRIVATE KEY-----\n'));
});

test("JSON output parses with field ids as keys", () => {
	const ds = generate({ fields: ["full_name", "ssn"], rows: 5, seed: "json" });
	const parsed = JSON.parse(serialize(ds, "json"));
	assert.equal(parsed.length, 5);
	assert.deepEqual(Object.keys(parsed[0]), ["full_name", "ssn"]);
});

test("API: generate, presets, errors", async () => {
	const ok = await handleApi(new Request("https://x/api/generate?preset=pci&rows=3&format=csv&seed=s"));
	assert.equal(ok.status, 200);
	assert.equal(ok.headers.get("X-DLP-Seed"), "s");
	const text = await ok.text();
	assert.equal(text.trim().split("\r\n").length, 4);

	assert.equal((await handleApi(new Request("https://x/api/generate?rows=0"))).status, 400);
	assert.equal((await handleApi(new Request("https://x/api/generate?rows=10001"))).status, 400);
	assert.equal((await handleApi(new Request("https://x/api/generate?fields=nope"))).status, 400);
	assert.equal((await handleApi(new Request("https://x/api/generate?format=xml"))).status, 400);
	assert.equal((await handleApi(new Request("https://x/api/generate?preset=__proto__"))).status, 400);
	assert.equal((await handleApi(new Request("https://x/api/nothing"))).status, 404);
	assert.equal((await handleApi(new Request("https://x/api/generate", { method: "POST" }))).status, 405);

	const fields = await (await handleApi(new Request("https://x/api/fields"))).json();
	assert.equal(fields.fields.length, FIELDS.length);
});

// ---------- documents ----------

/** Read entries from a ZIP produced by our writer (deflate only). */
async function unzip(bytes: Uint8Array): Promise<Map<string, string>> {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const eocd = bytes.length - 22;
	assert.equal(view.getUint32(eocd, true), 0x06054b50);
	const count = view.getUint16(eocd + 10, true);
	let p = view.getUint32(eocd + 16, true);
	const out = new Map<string, string>();
	for (let i = 0; i < count; i++) {
		assert.equal(view.getUint32(p, true), 0x02014b50);
		const crc = view.getUint32(p + 16, true);
		const compSize = view.getUint32(p + 20, true);
		const nameLen = view.getUint16(p + 28, true);
		const local = view.getUint32(p + 42, true);
		const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
		const localNameLen = view.getUint16(local + 26, true);
		const data = bytes.subarray(local + 30 + localNameLen, local + 30 + localNameLen + compSize);
		const raw = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
		assert.equal(crc32(raw), crc, `crc mismatch for ${name}`);
		out.set(name, new TextDecoder().decode(raw));
		p += 46 + nameLen;
	}
	return out;
}

test("XLSX: valid package with header and every value", async () => {
	const ds = generate({ fields: ["full_name", "ssn", "private_key"], rows: 30, seed: "xlsx" });
	const files = await unzip(await toXlsx(ds));
	for (const part of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml"]) {
		assert.ok(files.has(part), part);
	}
	const sheet = files.get("xl/worksheets/sheet1.xml")!;
	assert.ok(sheet.includes('<c r="A1" t="inlineStr" s="1"><is><t xml:space="preserve">Full name</t>'));
	assert.ok(sheet.includes(`<c r="B31"`));
	for (const rec of ds.records) assert.ok(sheet.includes(rec[1]));
});

test("DOCX: labelled records with escaped text", async () => {
	const ds = generate({ fields: ["full_name", "cc_number", "diagnosis"], rows: 5, seed: "docx" });
	const files = await unzip(await toDocx(ds));
	const doc = files.get("word/document.xml")!;
	assert.ok(doc.includes("Record 5"));
	for (const rec of ds.records) assert.ok(doc.includes(`<w:t xml:space="preserve">${rec[1]}</w:t>`));
	assert.ok(!/<w:t[^>]*>[^<]*&(?!amp;|lt;|gt;|quot;)/.test(doc), "unescaped ampersand");
});

test("PDF: well-formed xref and every value present", () => {
	const ds = generate({ fields: ["full_name", "ssn", "private_key"], rows: 120, seed: "pdf" });
	const pdf = new TextDecoder().decode(toPdf(ds));
	assert.ok(pdf.startsWith("%PDF-1.4"));
	const startxref = Number(/startxref\n(\d+)/.exec(pdf)![1]);
	assert.ok(pdf.slice(startxref).startsWith("xref"));
	const offsets = [...pdf.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
	offsets.forEach((o, i) => assert.ok(pdf.slice(o).startsWith(`${i + 1} 0 obj`), `object ${i + 1} offset`));
	const pages = Number(/\/Count (\d+)/.exec(pdf)![1]);
	assert.ok(pages > 1);
	for (const rec of ds.records) assert.ok(pdf.includes(`(SSN: ${rec[1]})`));
});

test("same seed gives byte-identical documents", async () => {
	const a = generate({ fields: ["full_name", "ssn"], rows: 10, seed: "same" });
	const b = generate({ fields: ["full_name", "ssn"], rows: 10, seed: "same" });
	assert.deepEqual(await toXlsx(a), await toXlsx(b));
	assert.deepEqual(toPdf(a), toPdf(b));
});

test("API: document formats and their row cap", async () => {
	for (const [format, magic] of [["xlsx", "PK"], ["docx", "PK"], ["pdf", "%PDF"]] as const) {
		const res = await handleApi(new Request(`https://x/api/generate?preset=pii&rows=5&format=${format}`));
		assert.equal(res.status, 200);
		assert.match(res.headers.get("Content-Disposition") ?? "", new RegExp(`\.${format}"$`));
		const head = new TextDecoder().decode(new Uint8Array(await res.arrayBuffer()).subarray(0, magic.length));
		assert.equal(head, magic);
	}
	assert.equal((await handleApi(new Request("https://x/api/generate?rows=2001&format=pdf"))).status, 400);
	assert.equal((await handleApi(new Request("https://x/api/generate?rows=2000&format=csv"))).status, 200);
});
