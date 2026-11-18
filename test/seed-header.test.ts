import assert from "node:assert/strict";
import { test } from "node:test";
import { handleApi } from "../src/api.ts";
import { PRESETS } from "../src/lib/fields.ts";
import { generate, serialize } from "../src/lib/generate.ts";

const pii = [...PRESETS.pii.fields];

function expectedCsv(seed: string): string {
	return serialize(generate({ fields: pii, rows: 10, seed }), "csv");
}

test("API: a non-Latin-1 seed returns data instead of throwing", async () => {
	const res = await handleApi(new Request("https://dlp.test/api/generate?seed=%CE%94-test&format=csv"));
	assert.equal(res.status, 200);
	assert.equal(await res.text(), expectedCsv("Δ-test"));
	assert.equal(res.headers.get("X-DLP-Seed"), "%CE%94-test");
	assert.equal(res.headers.get("X-DLP-Seed-Encoding"), "percent");
	assert.equal(decodeURIComponent(res.headers.get("X-DLP-Seed")!), "Δ-test");
	assert.equal(res.headers.get("Access-Control-Expose-Headers"), "X-DLP-Seed, X-DLP-Seed-Encoding");
});

test("API: Latin-1, emoji and control-character seeds are percent-encoded and round-trip", async () => {
	for (const seed of ["café", "🔑 key", "line\nbreak", "100%"]) {
		const res = await handleApi(new Request(`https://dlp.test/api/generate?format=csv&seed=${encodeURIComponent(seed)}`));
		assert.equal(res.status, 200, seed);
		assert.equal(await res.text(), expectedCsv(seed), seed);
		if (seed === "100%") {
			// Printable ASCII: sent as-is, with no companion header.
			assert.equal(res.headers.get("X-DLP-Seed"), "100%");
			assert.equal(res.headers.get("X-DLP-Seed-Encoding"), null);
		} else {
			assert.equal(res.headers.get("X-DLP-Seed-Encoding"), "percent", seed);
			assert.equal(decodeURIComponent(res.headers.get("X-DLP-Seed")!), seed);
		}
	}
});

test("API: ASCII seeds keep the exact X-DLP-Seed value and headers", async () => {
	for (const seed of ["demo", "q3-audit", "a b", "tab\there", "%CE%94", "!\"#$&'()*+,-./:;<=>?@[\\]^_`{|}~"]) {
		const res = await handleApi(new Request(`https://dlp.test/api/generate?format=csv&seed=${encodeURIComponent(seed)}`));
		assert.equal(res.status, 200, seed);
		assert.equal(res.headers.get("X-DLP-Seed"), seed);
		assert.equal(res.headers.get("X-DLP-Seed-Encoding"), null, seed);
		assert.equal(res.headers.get("Access-Control-Expose-Headers"), "X-DLP-Seed", seed);
		assert.equal(await res.text(), expectedCsv(seed), seed);
	}
	// Random seeds are lowercase ASCII, so they're never encoded.
	const random = await handleApi(new Request("https://dlp.test/api/generate"));
	assert.match(random.headers.get("X-DLP-Seed")!, /^[a-z0-9]+$/);
	assert.equal(random.headers.get("X-DLP-Seed-Encoding"), null);
});
