// Field and preset discovery for the extension, derived entirely from the
// canonical registry in src/lib/fields.ts. Nothing here lists fields by hand:
// a field added to the registry shows up in every view automatically.
import { CATEGORIES, FIELDS, FIELD_MAP, PRESETS, inRegistryOrder, type Category, type Field } from "../../src/lib/fields.ts";

export { CATEGORIES, FIELDS, FIELD_MAP, PRESETS, inRegistryOrder };
export type { Category, Field };

export interface CategoryGroup {
	category: Category;
	fields: readonly Field[];
}

/** Every category in registry order with its fields, also in registry order. */
export function fieldGroups(): CategoryGroup[] {
	return CATEGORIES.map((category) => ({ category, fields: FIELDS.filter((f) => f.category === category) }));
}

export interface PresetInfo {
	id: string;
	label: string;
	fields: readonly string[];
}

export function presetList(): PresetInfo[] {
	return Object.entries(PRESETS).map(([id, p]) => ({ id, label: p.label, fields: p.fields }));
}

/** The preset whose field set equals `ids` exactly (order ignored), or null. */
export function matchingPreset(ids: readonly string[]): string | null {
	const set = new Set(ids);
	for (const p of presetList()) {
		if (p.fields.length === set.size && p.fields.every((id) => set.has(id))) return p.id;
	}
	return null;
}

/** Case-insensitive match on label, API id, category and description. */
export function fieldMatches(field: Field, query: string): boolean {
	const q = query.trim().toLowerCase();
	if (!q) return true;
	return [field.label, field.id, field.category, field.description].some((s) => s.toLowerCase().includes(q));
}

export function searchFields(query: string): Field[] {
	return FIELDS.filter((f) => fieldMatches(f, query));
}
