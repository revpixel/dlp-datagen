// The extension's generation layer: it must produce exactly what the web app
// and API produce, from the same registry, with its own limits and copy formats.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { handleApi } from "../../src/api.ts";
import { abaValid, ibanValid, luhnValid, npiValid } from "../../src/lib/checksums.ts";
import * as lib from "../../src/lib/fields.ts";
import { generate, render } from "../../src/lib/generate.ts";
import { CATEGORIES, FIELDS, PRESETS, fieldGroups, matchingPreset, presetList, searchFields } from "../src/catalog.ts";
import {
	DISPLAY_RECORDS,
	EXTENSION_FORMATS,
	MAX_EXTENSION_ROWS,
	UserError,
	checkRows,
	formatRow,
	friendlyError,
	generateOutput,
	quickValue,
	supportsNearMiss,
} from "../src/output.ts";

const ext = resolve(import.meta.dirname, "..");

test("catalog is the canonical registry, not a copy", () => {
	assert.equal(FIELDS, lib.FIELDS);
	assert.equal(PRESETS, lib.PRESETS);
	assert.equal(CATEGORIES, lib.CATEGORIES);
});

test("every field and preset is discoverable, grouped by category in registry order", () => {
	const groups = fieldGroups();
	assert.deepEqual(
		groups.map((g) => g.category),
		[...lib.CATEGORIES],
	);
	const flat = groups.flatMap((g) => g.fields.map((f) => f.id));
	assert.equal(flat.length, lib.FIELDS.length);
	assert.deepEqual(new Set(flat), new Set(lib.FIELDS.map((f) => f.id)));
	for (const g of groups) {
		const registryOrder = lib.FIELDS.filter((f) => f.category === g.category);
		assert.deepEqual(g.fields, registryOrder, `${g.category} keeps registry order`);
	}
	assert.deepEqual(
		presetList().map((p) => p.id),
		Object.keys(lib.PRESETS),
	);
	for (const p of presetList()) assert.equal(matchingPreset([...p.fields].reverse()), p.id);
	assert.equal(matchingPreset(["ssn"]), null);
	// Secrets v2 fields are present.
	for (const id of ["entra_client_secret", "azure_devops_pat", "azure_sas", "gcp_api_key", "jwt", "bearer_token"]) {
		assert.ok(flat.includes(id), id);
	}
});

test("no extension source keeps its own field list or generator", () => {
	const src = join(ext, "src");
	for (const name of readdirSync(src)) {
		const text = readFileSync(join(src, name), "utf8");
		assert.ok(!/\bgen:\s*\(/.test(text), `${name} defines a field generator`);
		assert.ok(!/new Rng\(/.test(text), `${name} seeds its own RNG`);
		assert.ok(!/["']aws_access_key_id["']/.test(text), `${name} hard-codes a field list`);
	}
});

test("field search matches label, id, category and description", () => {
	assert.ok(searchFields("ssn").some((f) => f.id === "ssn"));
	assert.ok(searchFields("government id").some((f) => f.id === "ssn"), "category match");
	assert.ok(searchFields("luhn").some((f) => f.id === "cc_number"), "description match");
	assert.ok(searchFields("SECRETS").every((f) => f.category === "Secrets" || /secret/i.test(f.label + f.id + f.description)));
	assert.equal(searchFields("").length, FIELDS.length);
	assert.equal(searchFields("zzzz-no-such-field").length, 0);
});

// ASCII seeds: the API echoes the seed in a response header.
const SEEDS = ["ext-1", "docs", "seed with spaces", "42"];

test("text output is byte-identical to the API for the same request", async () => {
	const fieldSets = [lib.PRESETS.pii.fields, lib.PRESETS.cloud_secrets.fields, lib.FIELDS.map((f) => f.id)];
	for (const fields of fieldSets) {
		const ordered = lib.inRegistryOrder(fields);
		for (const seed of SEEDS) {
			for (const valid of [true, false]) {
				for (const format of ["txt", "csv", "json", "ndjson"]) {
					const out = await generateOutput({ fields: ordered, rows: 7, valid, seed, format });
					const qs = new URLSearchParams({ fields: ordered.join(","), rows: "7", format, seed, valid: String(valid) });
					const api = await (await handleApi(new Request(`https://dlp.test/api/generate?${qs}`))).text();
					assert.equal(out.data, api, `${format} ${seed} valid=${valid}`);
				}
			}
		}
	}
});

test("document output matches the shared serializers byte for byte", async () => {
	for (const format of ["xlsx", "docx", "pdf"] as const) {
		const fields = lib.inRegistryOrder(lib.PRESETS.pci.fields);
		const out = await generateOutput({ fields, rows: 5, valid: true, seed: "doc", format });
		const direct = await render(generate({ fields, rows: 5, valid: true, seed: "doc" }), format);
		assert.ok(out.data instanceof Uint8Array);
		assert.deepEqual(out.data, direct);
		assert.equal(out.filename, `dlp-test-data.${format}`);
		assert.equal(out.bytes, (out.data as Uint8Array).length);
	}
});

test("selection order never changes output (registry order wins)", async () => {
	const a = await generateOutput({ fields: ["ssn", "full_name", "email"], rows: 3, valid: true, seed: "s", format: "csv" });
	const b = await generateOutput({ fields: ["email", "ssn", "full_name", "ssn"], rows: 3, valid: true, seed: "s", format: "csv" });
	assert.equal(a.data, b.data);
	assert.match(a.data as string, /^full_name,email,ssn\r\n/);
});

test("seeded output is deterministic; unseeded output reports its seed", async () => {
	const req = { fields: lib.FIELDS.map((f) => f.id), rows: 20, valid: false, seed: "fixed", format: "json" };
	assert.equal((await generateOutput(req)).data, (await generateOutput(req)).data);
	const random = await generateOutput({ ...req, seed: "" });
	assert.ok(random.dataset.seed.length > 0);
	assert.equal((await generateOutput({ ...req, seed: random.dataset.seed })).data, random.data);
});

test("valid and near-miss values pass and fail their checksums", () => {
	const checks: [string, (v: string) => boolean][] = [
		["cc_number", luhnValid],
		["aba_routing", abaValid],
		["iban", ibanValid],
		["npi", npiValid],
	];
	for (const [id, check] of checks) {
		assert.ok(supportsNearMiss(id));
		for (let i = 0; i < 40; i++) {
			assert.ok(check(quickValue(id, true, `q${i}`).value), `${id} valid #${i}`);
			assert.ok(!check(quickValue(id, false, `q${i}`).value), `${id} near-miss #${i}`);
		}
	}
	assert.equal(supportsNearMiss("full_name"), false);
	assert.equal(supportsNearMiss("no_such_field"), false);
});

test("Quick Copy uses the same generator as a one-row dataset", () => {
	for (const f of lib.FIELDS) {
		for (const valid of [true, false]) {
			const q = quickValue(f.id, valid, "quick");
			assert.equal(q.value, generate({ fields: [f.id], rows: 1, valid, seed: "quick" }).records[0][0], f.id);
			assert.equal(q.field, f);
			assert.equal(q.seed, "quick");
			assert.ok(q.value.length > 0, `${f.id} not blank`);
		}
	}
	const unseeded = quickValue("ssn", true);
	assert.ok(unseeded.seed);
	assert.throws(() => quickValue("removed_field", true), UserError);
});

test("row count validation", () => {
	assert.deepEqual(checkRows("1"), { ok: true, rows: 1 });
	assert.deepEqual(checkRows(" 25 "), { ok: true, rows: 25 });
	assert.deepEqual(checkRows(MAX_EXTENSION_ROWS), { ok: true, rows: MAX_EXTENSION_ROWS });
	for (const bad of ["", "0", "-3", "2.5", "1e3", "abc", "NaN", String(MAX_EXTENSION_ROWS + 1), "99999999999999999999"]) {
		const r = checkRows(bad);
		assert.equal(r.ok, false, JSON.stringify(bad));
		if (!r.ok) assert.equal(r.message, `Rows must be a whole number from 1 to ${MAX_EXTENSION_ROWS}.`);
	}
	assert.ok(DISPLAY_RECORDS <= MAX_EXTENSION_ROWS);
});

test("bad requests fail with messages safe to show", async () => {
	const base = { fields: ["ssn"], rows: 5, valid: true, format: "csv" };
	const cases: [object, RegExp][] = [
		[{ fields: [] }, /^Choose at least one field\.$/],
		[{ fields: ["deleted_field"] }, /^Choose at least one field\.$/],
		[{ rows: "0" }, /whole number from 1 to 500/],
		[{ rows: "lots" }, /whole number from 1 to 500/],
		[{ format: "html" }, /isn't available here/],
	];
	for (const [patch, msg] of cases) {
		await assert.rejects(generateOutput({ ...base, ...patch }), (e: unknown) => {
			assert.ok(e instanceof UserError);
			assert.match(friendlyError(e), msg);
			return true;
		});
	}
	// Unexpected failures never leak internals.
	const internal = friendlyError(new TypeError("Cannot read properties of undefined (reading 'gen')"));
	assert.doesNotMatch(internal, /undefined|TypeError|reading/);
	assert.match(friendlyError("weird"), /Something went wrong/);
});

test("copy formats for one record", async () => {
	const out = await generateOutput({ fields: ["full_name", "ssn", "street"], rows: 3, valid: true, seed: "row", format: "csv" });
	const ds = out.dataset;
	assert.deepEqual(ds.fields.map((f) => f.id), ["full_name", "street", "ssn"], "registry order");
	const [name, street, ssn] = ds.records[1];
	assert.equal(formatRow(ds, 1, "txt"), ds.fields.map((f, i) => `${f.label}: ${ds.records[1][i]}`).join("\n"));
	assert.equal(formatRow(ds, 1, "txt"), `Full name: ${name}\nStreet address: ${street}\nSSN: ${ssn}`.replace("Street address", ds.fields[1].label));
	assert.equal(formatRow(ds, 1, "csv"), (out.data as string).split("\r\n")[2]);
	assert.deepEqual(JSON.parse(formatRow(ds, 1, "json")), { full_name: name, ssn, street });
	assert.equal(formatRow(ds, 1, "ndjson"), JSON.stringify({ full_name: name, street, ssn }));
	assert.equal(formatRow(ds, 1, "pdf"), formatRow(ds, 1, "txt"));
	// CSV quoting survives for values with commas or quotes.
	const tricky = { ...ds, records: [["Ann \"A\" Lee", "1 Main St, Apt 2", "123-45-6789"]] };
	assert.equal(formatRow(tricky, 0, "csv"), '"Ann ""A"" Lee","1 Main St, Apt 2",123-45-6789');
});

test("formats offered: text formats copy, documents download only", () => {
	const ids = EXTENSION_FORMATS.map((f) => f.id);
	assert.deepEqual(ids, ["txt", "csv", "json", "ndjson", "xlsx", "docx", "pdf"]);
	for (const f of EXTENSION_FORMATS) assert.equal(f.copyable, ["txt", "csv", "json", "ndjson"].includes(f.id), f.id);
});
