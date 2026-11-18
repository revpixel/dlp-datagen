// Generation and output formatting for the extension. All generation goes
// through the canonical generator and serializers in src/lib; this module only
// adds the extension's limits and its copy formats.
import {
	EXTENSION,
	MIME,
	OptionsError,
	generate,
	isBinary,
	render,
	serialize,
	type Dataset,
	type Format,
} from "../../src/lib/generate.ts";
import { FIELD_MAP, inRegistryOrder, type Field } from "./catalog.ts";

export type { Dataset, Format };

/**
 * Most rows one side-panel generation produces. Generation itself is fast,
 * but the panel is for quick copy-and-paste: anything bigger belongs in the
 * full web generator (100,000 rows) or the API (10,000 per request).
 */
export const MAX_EXTENSION_ROWS = 500;
/** Records rendered as copyable cards; Copy all and Download include every row. */
export const DISPLAY_RECORDS = 20;
export const DEFAULT_ROWS = 10;

export interface FormatInfo {
	id: Format;
	label: string;
	/** Text formats can be copied; document formats are download-only. */
	copyable: boolean;
}

export const EXTENSION_FORMATS: readonly FormatInfo[] = [
	{ id: "txt", label: "Labeled text", copyable: true },
	{ id: "csv", label: "CSV", copyable: true },
	{ id: "json", label: "JSON", copyable: true },
	{ id: "ndjson", label: "JSON Lines", copyable: true },
	{ id: "xlsx", label: "Excel (.xlsx), download only", copyable: false },
	{ id: "docx", label: "Word (.docx), download only", copyable: false },
	{ id: "pdf", label: "PDF, download only", copyable: false },
];

export function formatInfo(id: string): FormatInfo | undefined {
	return EXTENSION_FORMATS.find((f) => f.id === id);
}

/** A problem the user can fix; its message is safe to show as-is. */
export class UserError extends Error {}

export type RowsCheck = { ok: true; rows: number } | { ok: false; message: string };

export function checkRows(input: string | number): RowsCheck {
	const text = String(input).trim();
	const message = `Rows must be a whole number from 1 to ${MAX_EXTENSION_ROWS}.`;
	if (!/^\d+$/.test(text)) return { ok: false, message };
	const rows = Number(text);
	if (!Number.isSafeInteger(rows) || rows < 1 || rows > MAX_EXTENSION_ROWS) return { ok: false, message };
	return { ok: true, rows };
}

export interface GenerateRequest {
	fields: readonly string[];
	rows: string | number;
	valid: boolean;
	seed?: string;
	format: string;
	header?: boolean;
}

export interface GeneratedOutput {
	dataset: Dataset;
	valid: boolean;
	format: Format;
	/** The complete file: text for text formats, bytes for documents. */
	data: string | Uint8Array;
	filename: string;
	mime: string;
	bytes: number;
}

export async function generateOutput(req: GenerateRequest): Promise<GeneratedOutput> {
	const fields = inRegistryOrder(req.fields);
	if (!fields.length) throw new UserError("Choose at least one field.");
	const rows = checkRows(req.rows);
	if (!rows.ok) throw new UserError(rows.message);
	const info = formatInfo(req.format);
	if (!info) throw new UserError("That output format isn't available here. Choose another format.");
	const dataset = generate({ fields, rows: rows.rows, valid: req.valid, seed: req.seed });
	const data = await render(dataset, info.id, req.header ?? true);
	return {
		dataset,
		valid: req.valid,
		format: info.id,
		data,
		filename: `dlp-test-data.${EXTENSION[info.id]}`,
		mime: MIME[info.id],
		bytes: typeof data === "string" ? new TextEncoder().encode(data).length : data.length,
	};
}

function recordObject(ds: Dataset, index: number): Record<string, string> {
	return Object.fromEntries(ds.fields.map((f, i) => [f.id, ds.records[index][i]]));
}

/**
 * One record as text for the clipboard, in the chosen text format.
 * Document formats copy as labeled text.
 */
export function formatRow(ds: Dataset, index: number, format: Format): string {
	const one: Dataset = { ...ds, records: [ds.records[index]] };
	switch (format) {
		case "csv":
			return serialize(one, "csv", false).replace(/\r\n$/, "");
		case "json":
			return JSON.stringify(recordObject(ds, index), null, 2);
		case "ndjson":
			return JSON.stringify(recordObject(ds, index));
		default:
			return ds.fields.map((f, i) => `${f.label}: ${ds.records[index][i]}`).join("\n");
	}
}

export interface QuickValue {
	field: Field;
	value: string;
	valid: boolean;
	seed: string;
}

/** One value for one field, from the same generator as full datasets. */
export function quickValue(fieldId: string, valid: boolean, seed?: string): QuickValue {
	const field = FIELD_MAP.get(fieldId);
	if (!field) throw new UserError("That field isn't available. Choose another field.");
	const ds = generate({ fields: [field.id], rows: 1, valid, seed });
	return { field, value: ds.records[0][0], valid, seed: ds.seed };
}

/** Near-miss only changes fields that have a checksum or structure rule. */
export function supportsNearMiss(fieldId: string): boolean {
	return FIELD_MAP.get(fieldId)?.checksum ?? false;
}

/** A message safe to show: user errors verbatim, anything else generic. */
export function friendlyError(e: unknown, fallback = "Something went wrong while generating. Try again, or choose fewer rows or another format."): string {
	if (e instanceof UserError || e instanceof OptionsError) return e.message;
	return fallback;
}

export function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export { isBinary };
