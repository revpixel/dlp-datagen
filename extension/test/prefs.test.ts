import assert from "node:assert/strict";
import { test } from "node:test";
import { FIELDS, PRESETS } from "../src/catalog.ts";
import { MAX_EXTENSION_ROWS } from "../src/output.ts";
import {
	DEFAULT_PREFS,
	PREFS_KEY,
	STARTER_FAVORITES,
	loadPrefs,
	memoryStore,
	resetPrefs,
	sanitizePrefs,
	savePrefs,
	type PrefsStore,
} from "../src/prefs.ts";

test("defaults are complete and valid", () => {
	const p = sanitizePrefs(undefined);
	assert.deepEqual(p, { ...DEFAULT_PREFS });
	assert.deepEqual(p.fields, [...PRESETS.pii.fields]);
	assert.deepEqual(p.favorites, [], "no favorites are imposed");
	for (const id of STARTER_FAVORITES) assert.ok(FIELDS.some((f) => f.id === id), `starter ${id} exists`);
});

test("corrupted values fall back field by field", () => {
	for (const raw of [null, "prefs", 42, [], true, () => 1]) assert.deepEqual(sanitizePrefs(raw), { ...DEFAULT_PREFS });
	const p = sanitizePrefs({
		tab: "history",
		fields: "ssn",
		valid: "yes",
		format: "exe",
		rows: Number.NaN,
		header: 1,
		expanded: ["Secrets", "Nope", 3],
		quickField: 99,
		favorites: [null, "jwt", "jwt", "ssn", {}],
		favoritesValid: false,
	});
	assert.equal(p.tab, "generate");
	assert.deepEqual(p.fields, DEFAULT_PREFS.fields);
	assert.equal(p.valid, true);
	assert.equal(p.format, "txt");
	assert.equal(p.rows, DEFAULT_PREFS.rows);
	assert.equal(p.header, true);
	assert.deepEqual(p.expanded, ["Secrets"]);
	assert.equal(p.quickField, "ssn");
	assert.deepEqual(p.favorites, ["jwt", "ssn"], "deduped, user order kept");
	assert.equal(p.favoritesValid, false);
});

test("rows are clamped to the extension limit", () => {
	assert.equal(sanitizePrefs({ rows: 0 }).rows, 1);
	assert.equal(sanitizePrefs({ rows: 10_000 }).rows, MAX_EXTENSION_ROWS);
	assert.equal(sanitizePrefs({ rows: 2.5 }).rows, DEFAULT_PREFS.rows);
});

test("removed and renamed fields are handled", () => {
	const renames = { social_security: "ssn", old_jwt: "jwt" };
	const p = sanitizePrefs(
		{ fields: ["email", "gone_field", "social_security"], favorites: ["old_jwt", "gone_field", "ssn"], quickField: "social_security" },
		renames,
	);
	assert.deepEqual(p.fields, ["email", "ssn"], "renamed mapped, removed dropped, registry order");
	assert.deepEqual(p.favorites, ["jwt", "ssn"]);
	assert.equal(p.quickField, "ssn");
	// A selection whose fields were all removed falls back to the default…
	assert.deepEqual(sanitizePrefs({ fields: ["gone_a", "gone_b"] }).fields, DEFAULT_PREFS.fields);
	// …but a deliberately empty selection stays empty.
	assert.deepEqual(sanitizePrefs({ fields: [] }).fields, []);
	assert.equal(sanitizePrefs({ quickField: "gone_field" }).quickField, "ssn");
});

test("an older or newer saved version keeps whatever is still valid", () => {
	const p = sanitizePrefs({ version: 0, favorites: ["ssn"], format: "csv", extra: "ignored" });
	assert.equal(p.version, 1);
	assert.deepEqual(p.favorites, ["ssn"]);
	assert.equal(p.format, "csv");
	assert.ok(!("extra" in p));
	assert.deepEqual(sanitizePrefs({ version: 99, rows: 25 }).rows, 25);
});

test("favorites and preferences persist and reload", async () => {
	const store = memoryStore();
	const first = await loadPrefs(store);
	assert.equal(first.repaired, false);
	const prefs = { ...first.prefs, favorites: ["jwt", "ssn", "azure_devops_pat"], tab: "favorites" as const, valid: false, rows: 25, format: "json" as const, expanded: ["Secrets" as const] };
	assert.equal(await savePrefs(store, prefs), true);
	const again = await loadPrefs(store);
	assert.equal(again.repaired, false);
	assert.deepEqual(again.prefs, prefs);
});

test("saved preferences never contain generated values", async () => {
	const store = memoryStore();
	const prefs = sanitizePrefs({ favorites: ["ssn", "jwt"] });
	// Even if a caller attaches extra data, only known preference keys are written.
	await savePrefs(store, { ...prefs, lastValue: "123-45-6789", output: "full_name,ssn" } as never);
	const saved = (await store.get(PREFS_KEY)) as Record<string, unknown>;
	assert.deepEqual(Object.keys(saved).sort(), Object.keys(DEFAULT_PREFS).sort());
	assert.doesNotMatch(JSON.stringify(saved), /123-45-6789|full_name,ssn/);
});

test("corrupted storage is repaired and reported", async () => {
	const store = memoryStore();
	await store.set(PREFS_KEY, { favorites: ["gone_field", "ssn"], rows: "ten" });
	const { prefs, repaired } = await loadPrefs(store);
	assert.equal(repaired, true);
	assert.deepEqual(prefs.favorites, ["ssn"]);
	assert.equal(prefs.rows, DEFAULT_PREFS.rows);
});

test("storage failures never break the panel", async () => {
	const broken: PrefsStore = {
		persistent: true,
		get: async () => {
			throw new Error("quota");
		},
		set: async () => {
			throw new Error("quota");
		},
		remove: async () => {
			throw new Error("quota");
		},
	};
	const loaded = await loadPrefs(broken);
	assert.deepEqual(loaded.prefs, { ...DEFAULT_PREFS });
	assert.equal(loaded.repaired, true);
	assert.equal(await savePrefs(broken, loaded.prefs), false);
	assert.deepEqual(await resetPrefs(broken), { ...DEFAULT_PREFS });
});

test("reset removes saved preferences", async () => {
	const store = memoryStore();
	await savePrefs(store, sanitizePrefs({ favorites: ["ssn"] }));
	const p = await resetPrefs(store);
	assert.deepEqual(p, { ...DEFAULT_PREFS });
	assert.equal(await store.get(PREFS_KEY), undefined);
});
