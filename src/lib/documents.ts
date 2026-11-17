// XLSX, DOCX and PDF writers. Hand-rolled so they run unchanged in the
// browser and in the Worker with no dependencies.
import type { Dataset } from "./generate.ts";
import { zip } from "./zip.ts";

// ---------- shared ----------

// Strip characters XML 1.0 can't carry, then escape.
function xml(s: string): string {
	return s
		.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F￾￿]/g, "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const OFFICE_DOC_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument";

// ---------- XLSX ----------

function colName(i: number): string {
	let s = "";
	for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
	return s;
}

export async function toXlsx(ds: Dataset, header = true): Promise<Uint8Array> {
	const rows: string[] = [];
	let r = 1;
	const cell = (c: number, v: string, style = 0) =>
		`<c r="${colName(c)}${r}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t xml:space="preserve">${xml(v)}</t></is></c>`;

	if (header) {
		rows.push(`<row r="${r}">${ds.fields.map((f, i) => cell(i, f.label, 1)).join("")}</row>`);
		r++;
	}
	for (const rec of ds.records) {
		rows.push(`<row r="${r}">${rec.map((v, i) => cell(i, v)).join("")}</row>`);
		r++;
	}

	const widths = ds.fields
		.map((f, i) => {
			const longest = Math.max(f.label.length, ...ds.records.slice(0, 200).map((rec) => Math.min(rec[i].split("\n")[0].length, 60)));
			return `<col min="${i + 1}" max="${i + 1}" width="${longest + 3}" customWidth="1"/>`;
		})
		.join("");

	const pane = header
		? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
		: "";

	const sheet =
		XML_DECL +
		'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
		`${pane}<cols>${widths}</cols><sheetData>${rows.join("")}</sheetData></worksheet>`;

	return zip([
		{
			name: "[Content_Types].xml",
			data:
				XML_DECL +
				'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
				'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
				'<Default Extension="xml" ContentType="application/xml"/>' +
				'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
				'<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
				'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
				"</Types>",
		},
		{
			name: "_rels/.rels",
			data: XML_DECL + `<Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="${OFFICE_DOC_REL}" Target="xl/workbook.xml"/></Relationships>`,
		},
		{
			name: "xl/workbook.xml",
			data:
				XML_DECL +
				'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
				'<sheets><sheet name="DLP test data" sheetId="1" r:id="rId1"/></sheets></workbook>',
		},
		{
			name: "xl/_rels/workbook.xml.rels",
			data:
				XML_DECL +
				`<Relationships xmlns="${REL_NS}">` +
				'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
				'<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
				"</Relationships>",
		},
		{
			name: "xl/styles.xml",
			data:
				XML_DECL +
				'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
				'<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
				'<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
				'<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
				'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
				'<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
				'<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
				'<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
				"</styleSheet>",
		},
		{ name: "xl/worksheets/sheet1.xml", data: sheet },
	]);
}

// ---------- DOCX ----------
// Labelled records ("SSN: 123-45-6789"), since many DLP rules look for a
// keyword near the match.

function docxRun(text: string, bold = false): string {
	const parts = text.split("\n").map((t) => `<w:t xml:space="preserve">${xml(t)}</w:t>`);
	return `<w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}${parts.join("<w:br/>")}</w:r>`;
}

export async function toDocx(ds: Dataset): Promise<Uint8Array> {
	const body: string[] = [
		`<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>DLP test data</w:t></w:r></w:p>`,
		`<w:p>${docxRun("Synthetic records for data loss prevention testing. No real person's data.")}</w:p>`,
	];
	ds.records.forEach((rec, n) => {
		body.push(`<w:p><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="60"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t>Record ${n + 1}</w:t></w:r></w:p>`);
		ds.fields.forEach((f, i) => {
			body.push(`<w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${docxRun(`${f.label}: `, true)}${docxRun(rec[i])}</w:p>`);
		});
	});

	const document =
		XML_DECL +
		'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
		body.join("") +
		'<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>' +
		"</w:body></w:document>";

	return zip([
		{
			name: "[Content_Types].xml",
			data:
				XML_DECL +
				'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
				'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
				'<Default Extension="xml" ContentType="application/xml"/>' +
				'<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
				"</Types>",
		},
		{
			name: "_rels/.rels",
			data: XML_DECL + `<Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="${OFFICE_DOC_REL}" Target="word/document.xml"/></Relationships>`,
		},
		{ name: "word/document.xml", data: document },
	]);
}

// ---------- PDF ----------
// US Letter, standard fonts (no embedding). Text is kept as real text, not
// images, so DLP engines can extract it.

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const SIZE = 9.5;
const LEADING = 13;
const MONO_WIDTH = 0.6 * SIZE; // Courier glyphs are 600/1000 em
const WRAP = Math.floor((PAGE_W - 2 * MARGIN) / MONO_WIDTH);

function pdfText(s: string): string {
	// Standard fonts use WinAnsi; keep printable ASCII only and escape.
	return s.replace(/[^\x20-\x7e]/g, "?").replace(/[\\()]/g, (c) => "\\" + c);
}

interface Line {
	text: string;
	font: "F1" | "F2" | "F3"; // F1 Courier, F2 Helvetica-Bold, F3 Helvetica
	gap?: number;
}

export function toPdf(ds: Dataset): Uint8Array {
	const lines: Line[] = [];
	ds.records.forEach((rec, n) => {
		lines.push({ text: `Record ${n + 1}`, font: "F2", gap: n === 0 ? 0 : 8 });
		ds.fields.forEach((f, i) => {
			const valueLines = rec[i].split("\n");
			const out = [`${f.label}: ${valueLines[0]}`, ...valueLines.slice(1).map((v) => "  " + v)];
			for (const text of out) {
				for (let p = 0; p < text.length || p === 0; p += WRAP) lines.push({ text: text.slice(p, p + WRAP), font: "F1" });
			}
		});
	});

	const top = PAGE_H - MARGIN - 20;
	const bottom = MARGIN + 18;
	const pages: Line[][] = [[]];
	let y = top;
	for (const l of lines) {
		const need = LEADING + (l.gap ?? 0);
		// Keep a record title with at least its first line.
		const reserve = l.font === "F2" ? LEADING : 0;
		if (y - need - reserve < bottom && pages.at(-1)!.length) {
			pages.push([]);
			y = top;
			l.gap = 0;
		}
		pages.at(-1)!.push(l);
		y -= LEADING + (l.gap ?? 0);
	}

	const objects: string[] = [];
	const add = (body: string) => objects.push(body);
	add("<< /Type /Catalog /Pages 2 0 R >>"); // 1
	add(""); // 2: pages, filled in below
	add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>"); // 3
	add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"); // 4
	add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"); // 5
	const fonts = "<< /F1 3 0 R /F2 4 0 R /F3 5 0 R >>";

	const kids: number[] = [];
	pages.forEach((page, p) => {
		const ops: string[] = ["BT"];
		ops.push(`/F2 12 Tf 1 0 0 1 ${MARGIN} ${PAGE_H - MARGIN} Tm (DLP test data) Tj`);
		ops.push(`/F3 8 Tf 1 0 0 1 ${MARGIN} ${MARGIN - 4} Tm (Synthetic records for DLP testing. No real person's data.  Page ${p + 1} of ${pages.length}) Tj`);
		let yy = top;
		for (const l of page) {
			yy -= l.gap ?? 0;
			const size = l.font === "F2" ? 11 : SIZE;
			ops.push(`/${l.font} ${size} Tf 1 0 0 1 ${MARGIN} ${yy.toFixed(2)} Tm (${pdfText(l.text)}) Tj`);
			yy -= LEADING;
		}
		ops.push("ET");
		const stream = ops.join("\n");
		add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
		const contentId = objects.length;
		add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font ${fonts} >> /Contents ${contentId} 0 R >>`);
		kids.push(objects.length);
	});
	objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
	add("<< /Title (DLP test data) /Producer (dlp-datagen) >>");
	const infoId = objects.length;

	// Everything is ASCII, so string length equals byte length for offsets.
	let out = "%PDF-1.4\n";
	const offsets: number[] = [];
	objects.forEach((body, i) => {
		offsets.push(out.length);
		out += `${i + 1} 0 obj\n${body}\nendobj\n`;
	});
	const xrefAt = out.length;
	out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
	out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
	return new TextEncoder().encode(out);
}
