// Lightweight preferences in chrome.storage.local. Only choices are stored
// (field ids, mode, format, row count, which panels are open); never a
// generated value. Everything read back is sanitized, so corrupted data or
// fields renamed or removed in a later version fall back to safe defaults.
import { CATEGORIES, FIELD_MAP, PRESETS, inRegistryOrder, type Category } from "./catalog.ts";
import { DEFAULT_ROWS, MAX_EXTENSION_ROWS, formatInfo, type Format } from "./output.ts";

export const PREFS_KEY = "prefs";
export const PREFS_VERSION = 1;

export type Tab = "generate" | "quick" | "favorites";
export const TABS: readonly Tab[] = ["generate", "quick", "favorites"];

export interface Prefs {
	version: number;
	tab: Tab;
	/** Generate view selection, in registry order. */
	fields: string[];
	valid: boolean;
	format: Format;
	rows: number;
	header: boolean;
	/** Categories whose disclosure is open in the Generate view. */
	expanded: Category[];
	quickField: string;
	quickValid: boolean;
	/** Pinned field ids, in the user's order. */
	favorites: string[];
	favoritesValid: boolean;
}

export const DEFAULT_PREFS: Readonly<Prefs> = Object.freeze({
	version: PREFS_VERSION,
	tab: "generate",
	fields: [...PRESETS.pii.fields],
	valid: true,
	format: "txt",
	rows: DEFAULT_ROWS,
	header: true,
	expanded: [],
	quickField: "ssn",
	quickValid: true,
	favorites: [],
	favoritesValid: true,
});

/** Offered from the empty Favorites view; never applied automatically. */
export const STARTER_FAVORITES: readonly string[] = ["ssn", "cc_number", "email", "github_pat", "jwt"];

/**
 * Field ids renamed in a later registry version: old id -> new id. Saved
 * selections are mapped through this before unknown ids are dropped.
 */
export const FIELD_RENAMES: Readonly<Record<string, string>> = {};

function defaults(): Prefs {
	return { ...DEFAULT_PREFS, fields: [...DEFAULT_PREFS.fields], expanded: [], favorites: [] };
}

function idList(value: unknown, renames: Readonly<Record<string, string>>): string[] | null {
	if (!Array.isArray(value)) return null;
	return value.filter((v): v is string => typeof v === "string").map((id) => renames[id] ?? id);
}

/** Turn anything read from storage into a complete, valid Prefs object. */
export function sanitizePrefs(raw: unknown, renames: Readonly<Record<string, string>> = FIELD_RENAMES): Prefs {
	const out = defaults();
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
	const r = raw as Record<string, unknown>;

	if (typeof r.tab === "string" && (TABS as readonly string[]).includes(r.tab)) out.tab = r.tab as Tab;

	const fields = idList(r.fields, renames);
	// An empty saved selection is a deliberate choice; keep it. A selection
	// whose ids were all removed falls back to the default.
	if (fields) {
		const known = inRegistryOrder(fields);
		out.fields = known.length || !fields.length ? known : out.fields;
	}

	if (typeof r.valid === "boolean") out.valid = r.valid;
	if (typeof r.format === "string" && formatInfo(r.format)) out.format = r.format as Format;
	if (typeof r.rows === "number" && Number.isSafeInteger(r.rows)) out.rows = Math.min(Math.max(r.rows, 1), MAX_EXTENSION_ROWS);
	if (typeof r.header === "boolean") out.header = r.header;

	if (Array.isArray(r.expanded)) {
		const open = new Set(r.expanded);
		out.expanded = CATEGORIES.filter((c) => open.has(c));
	}

	if (typeof r.quickField === "string") {
		const id = renames[r.quickField] ?? r.quickField;
		if (FIELD_MAP.has(id)) out.quickField = id;
	}
	if (typeof r.quickValid === "boolean") out.quickValid = r.quickValid;

	const favorites = idList(r.favorites, renames);
	if (favorites) out.favorites = [...new Set(favorites.filter((id) => FIELD_MAP.has(id)))];
	if (typeof r.favoritesValid === "boolean") out.favoritesValid = r.favoritesValid;

	return out;
}

/** The subset of chrome.storage.local the extension uses. */
export interface PrefsStore {
	get(key: string): Promise<unknown>;
	set(key: string, value: unknown): Promise<void>;
	remove(key: string): Promise<void>;
	/** False when preferences can't be saved (they then last for this session). */
	readonly persistent: boolean;
}

export function chromeStore(): PrefsStore | null {
	const area = globalThis.chrome?.storage?.local;
	if (!area) return null;
	return {
		persistent: true,
		get: async (key) => (await area.get(key))[key],
		set: (key, value) => area.set({ [key]: value }),
		remove: (key) => area.remove(key),
	};
}

/** In-memory fallback when extension storage isn't available. */
export function memoryStore(): PrefsStore {
	const data = new Map<string, unknown>();
	return {
		persistent: false,
		get: async (key) => structuredClone(data.get(key)),
		set: async (key, value) => void data.set(key, structuredClone(value)),
		remove: async (key) => void data.delete(key),
	};
}

export interface LoadedPrefs {
	prefs: Prefs;
	/** True when saved preferences were unreadable or partly invalid and were repaired. */
	repaired: boolean;
}

export async function loadPrefs(store: PrefsStore): Promise<LoadedPrefs> {
	let raw: unknown;
	try {
		raw = await store.get(PREFS_KEY);
	} catch {
		return { prefs: defaults(), repaired: true };
	}
	if (raw === undefined) return { prefs: defaults(), repaired: false };
	const prefs = sanitizePrefs(raw);
	const repaired = JSON.stringify(prefs) !== JSON.stringify(raw);
	return { prefs, repaired };
}

/** Returns false if storage refused the write. */
export async function savePrefs(store: PrefsStore, prefs: Prefs): Promise<boolean> {
	try {
		await store.set(PREFS_KEY, sanitizePrefs(prefs));
		return true;
	} catch {
		return false;
	}
}

export async function resetPrefs(store: PrefsStore): Promise<Prefs> {
	try {
		await store.remove(PREFS_KEY);
	} catch {
		/* nothing saved, or storage unavailable: defaults apply either way */
	}
	return defaults();
}
