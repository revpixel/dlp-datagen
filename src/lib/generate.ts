import { toDocx, toPdf, toXlsx } from "./documents.ts";
import { FIELD_MAP, Row, type Field } from "./fields.ts";
import { Rng, randomSeed } from "./rng.ts";

export type TextFormat = "csv" | "json" | "ndjson" | "txt";
export type BinaryFormat = "xlsx" | "docx" | "pdf";
export type Format = TextFormat | BinaryFormat;
export const FORMATS: readonly Format[] = ["csv", "json", "ndjson", "txt", "xlsx", "docx", "pdf"];
export const BINARY_FORMATS: readonly Format[] = ["xlsx", "docx", "pdf"];

export function isBinary(f: Format): f is BinaryFormat {
	return BINARY_FORMATS.includes(f);
}

export const MIME: Record<Format, string> = {
	csv: "text/csv; charset=utf-8",
	json: "application/json; charset=utf-8",
	ndjson: "application/x-ndjson; charset=utf-8",
	txt: "text/plain; charset=utf-8",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	pdf: "application/pdf",
};

export const EXTENSION: Record<Format, string> = {
	csv: "csv",
	json: "json",
	ndjson: "jsonl",
	txt: "txt",
	xlsx: "xlsx",
	docx: "docx",
	pdf: "pdf",
};

/** Produce the file for any format: a string for text formats, bytes for documents. */
export async function render(ds: Dataset, format: Format, header = true): Promise<string | Uint8Array> {
	switch (format) {
		case "xlsx":
			return toXlsx(ds, header);
		case "docx":
			return toDocx(ds);
		case "pdf":
			return toPdf(ds);
		default:
			return serialize(ds, format, header);
	}
}

export interface GenerateOptions {
	fields: readonly string[];
	rows: number;
	/** true: values pass their checksum/structure rules. false: they look right but fail. */
	valid?: boolean;
	seed?: string;
}

export interface Dataset {
	seed: string;
	fields: readonly Field[];
	records: string[][];
}

export class OptionsError extends Error {}

export function resolveFields(ids: readonly string[]): Field[] {
	const unknown = ids.filter((id) => !FIELD_MAP.has(id));
	if (unknown.length) throw new OptionsError(`Unknown field(s): ${unknown.join(", ")}`);
	if (!ids.length) throw new OptionsError("Choose at least one field.");
	return ids.map((id) => FIELD_MAP.get(id)!);
}

export function generate(opts: GenerateOptions): Dataset {
	const fields = resolveFields(opts.fields);
	if (!Number.isInteger(opts.rows) || opts.rows < 1) throw new OptionsError("rows must be a positive integer.");
	const seed = opts.seed?.trim() || randomSeed();
	const rng = new Rng(seed);
	const valid = opts.valid ?? true;
	const records: string[][] = [];
	for (let i = 0; i < opts.rows; i++) {
		const row = new Row(rng, valid);
		records.push(fields.map((f) => f.gen(row)));
	}
	return { seed, fields, records };
}

function csvCell(v: string): string {
	return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function serialize(ds: Dataset, format: TextFormat, header = true): string {
	const ids = ds.fields.map((f) => f.id);
	switch (format) {
		case "csv": {
			const lines = ds.records.map((r) => r.map(csvCell).join(","));
			if (header) lines.unshift(ids.join(","));
			return lines.join("\r\n") + "\r\n";
		}
		case "json":
			return JSON.stringify(ds.records.map((r) => Object.fromEntries(ids.map((id, i) => [id, r[i]]))), null, 2) + "\n";
		case "ndjson":
			return ds.records.map((r) => JSON.stringify(Object.fromEntries(ids.map((id, i) => [id, r[i]])))).join("\n") + "\n";
		case "txt": {
			// Labelled records: DLP rules often require a keyword ("SSN", "card")
			// near the match, so each value sits next to its label.
			return ds.records
				.map((r, n) => [`Record ${n + 1}`, ...ds.fields.map((f, i) => `${f.label}: ${r[i]}`)].join("\n"))
				.join("\n\n") + "\n";
		}
	}
}
