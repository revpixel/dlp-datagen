import assert from "node:assert/strict";
import { test } from "node:test";
import { abaValid, deaValid, ibanValid, luhnValid, npiValid } from "../src/lib/checksums.ts";
import { FIELDS } from "../src/lib/fields.ts";
import { generate, serialize } from "../src/lib/generate.ts";
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
	const ok = handleApi(new Request("https://x/api/generate?preset=pci&rows=3&format=csv&seed=s"));
	assert.equal(ok.status, 200);
	assert.equal(ok.headers.get("X-DLP-Seed"), "s");
	const text = await ok.text();
	assert.equal(text.trim().split("\r\n").length, 4);

	assert.equal(handleApi(new Request("https://x/api/generate?rows=0")).status, 400);
	assert.equal(handleApi(new Request("https://x/api/generate?rows=10001")).status, 400);
	assert.equal(handleApi(new Request("https://x/api/generate?fields=nope")).status, 400);
	assert.equal(handleApi(new Request("https://x/api/generate?format=xml")).status, 400);
	assert.equal(handleApi(new Request("https://x/api/generate?preset=__proto__")).status, 400);
	assert.equal(handleApi(new Request("https://x/api/nothing")).status, 404);
	assert.equal(handleApi(new Request("https://x/api/generate", { method: "POST" })).status, 405);

	const fields = await handleApi(new Request("https://x/api/fields")).json();
	assert.equal(fields.fields.length, FIELDS.length);
});
