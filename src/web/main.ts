import { CATEGORIES, FIELDS, PRESETS } from "../lib/fields.ts";
import { MIME, generate, serialize, type Dataset, type Format } from "../lib/generate.ts";

const MAX_BROWSER_ROWS = 100_000;
const PREVIEW_ROWS = 50;
const STORAGE_KEY = "dlp-datagen:settings";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const groupsEl = $("field-groups");
const presetsEl = $("presets");
const rowsEl = $<HTMLInputElement>("rows");
const formatEl = $<HTMLSelectElement>("format");
const seedEl = $<HTMLInputElement>("seed");
const headerEl = $<HTMLInputElement>("header");
const statusEl = $("status");
const previewEl = $("preview");
const previewMeta = $("preview-meta");
const downloadBtn = $<HTMLButtonElement>("download");
const copyBtn = $<HTMLButtonElement>("copy");
const apiCmd = $("api-cmd");

let output: { text: string; format: Format } | null = null;

// ---------- build field checkboxes ----------
for (const cat of CATEGORIES) {
	const group = document.createElement("div");
	group.className = "group";
	const h = document.createElement("h3");
	h.textContent = cat;
	group.append(h);
	for (const f of FIELDS.filter((x) => x.category === cat)) {
		const label = document.createElement("label");
		label.title = f.description;
		const box = document.createElement("input");
		box.type = "checkbox";
		box.value = f.id;
		box.name = "field";
		label.append(box, document.createTextNode(f.label));
		if (f.checksum) {
			const b = document.createElement("span");
			b.className = "badge";
			b.textContent = "validated";
			b.title = "Has a checksum or structure rule; Invalid mode breaks it";
			label.append(b);
		}
		group.append(label);
	}
	groupsEl.append(group);
}

for (const [key, p] of Object.entries(PRESETS)) {
	const chip = document.createElement("button");
	chip.type = "button";
	chip.className = "chip";
	chip.textContent = p.label;
	chip.addEventListener("click", () => setFields(p.fields));
	presetsEl.append(chip);
	chip.dataset.preset = key;
}

function boxes(): HTMLInputElement[] {
	return [...groupsEl.querySelectorAll<HTMLInputElement>('input[name="field"]')];
}

/** Selected fields, in registry order. */
function selectedFields(): string[] {
	return boxes().filter((b) => b.checked).map((b) => b.value);
}

function setFields(ids: readonly string[]) {
	for (const b of boxes()) b.checked = ids.includes(b.value);
	onChange();
}

$("select-all").addEventListener("click", () => setFields(FIELDS.map((f) => f.id)));
$("select-none").addEventListener("click", () => setFields([]));

function mode(): boolean {
	return (document.querySelector<HTMLInputElement>('input[name="mode"]:checked')?.value ?? "valid") === "valid";
}

// ---------- settings persistence (per-browser convenience only) ----------
function save() {
	try {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ fields: selectedFields(), rows: rowsEl.value, format: formatEl.value, valid: mode(), header: headerEl.checked }),
		);
	} catch {
		/* storage unavailable */
	}
}

function restore() {
	let s: { fields?: string[]; rows?: string; format?: string; valid?: boolean; header?: boolean } | null = null;
	try {
		s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
	} catch {
		s = null;
	}
	setFields(s?.fields?.length ? s.fields : PRESETS.pii.fields);
	if (s?.rows) rowsEl.value = s.rows;
	if (s?.format) formatEl.value = s.format;
	if (s?.header === false) headerEl.checked = false;
	if (s?.valid === false) document.querySelector<HTMLInputElement>('input[name="mode"][value="invalid"]')!.checked = true;
}

// ---------- API command ----------
function updateApiCmd() {
	const params = new URLSearchParams();
	const fields = selectedFields();
	params.set("fields", fields.join(","));
	params.set("rows", String(Math.min(Number(rowsEl.value) || 10, 10_000)));
	params.set("format", formatEl.value);
	if (!mode()) params.set("valid", "false");
	if (seedEl.value.trim()) params.set("seed", seedEl.value.trim());
	if (formatEl.value === "csv" && !headerEl.checked) params.set("header", "false");
	const qs = params.toString().replace(/%2C/g, ",");
	apiCmd.textContent = `curl "${location.origin}/api/generate?${qs}"`;
}

function onChange() {
	headerEl.disabled = formatEl.value !== "csv";
	updateApiCmd();
	save();
}

for (const el of [rowsEl, formatEl, seedEl, headerEl]) el.addEventListener("input", onChange);
groupsEl.addEventListener("change", onChange);
document.querySelectorAll('input[name="mode"]').forEach((el) => el.addEventListener("change", onChange));

// ---------- generate ----------
function setStatus(msg: string, error = false) {
	statusEl.textContent = msg;
	statusEl.classList.toggle("error", error);
}

function renderPreview(ds: Dataset) {
	const table = document.createElement("table");
	const thead = table.createTHead().insertRow();
	for (const f of ds.fields) {
		const th = document.createElement("th");
		th.textContent = f.label;
		th.title = f.id;
		thead.append(th);
	}
	const body = table.createTBody();
	for (const rec of ds.records.slice(0, PREVIEW_ROWS)) {
		const tr = body.insertRow();
		rec.forEach((v) => {
			const td = tr.insertCell();
			td.textContent = v;
			td.className = v.includes("\n") ? "mono multiline" : "mono";
		});
	}
	previewEl.replaceChildren(table);
	const shown = Math.min(PREVIEW_ROWS, ds.records.length);
	previewMeta.textContent = `Showing ${shown} of ${ds.records.length.toLocaleString()} rows · seed ${ds.seed}`;
}

$("generate").addEventListener("click", () => {
	const fields = selectedFields();
	const rows = Number(rowsEl.value);
	if (!fields.length) return setStatus("Choose at least one field.", true);
	if (!Number.isInteger(rows) || rows < 1 || rows > MAX_BROWSER_ROWS) {
		return setStatus(`Rows must be a whole number from 1 to ${MAX_BROWSER_ROWS.toLocaleString()}.`, true);
	}
	const t0 = performance.now();
	const ds = generate({ fields, rows, valid: mode(), seed: seedEl.value });
	const format = formatEl.value as Format;
	output = { text: serialize(ds, format, headerEl.checked), format };
	renderPreview(ds);
	downloadBtn.disabled = copyBtn.disabled = false;
	setStatus(`Generated ${rows.toLocaleString()} rows in ${Math.round(performance.now() - t0)} ms.`);
});

downloadBtn.addEventListener("click", () => {
	if (!output) return;
	const ext = output.format === "ndjson" ? "jsonl" : output.format;
	const url = URL.createObjectURL(new Blob([output.text], { type: MIME[output.format] }));
	const a = document.createElement("a");
	a.href = url;
	a.download = `dlp-test-data.${ext}`;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
});

copyBtn.addEventListener("click", async () => {
	if (!output) return;
	try {
		await navigator.clipboard.writeText(output.text);
		setStatus("Copied to clipboard.");
	} catch {
		setStatus("Couldn't copy: clipboard access was blocked.", true);
	}
});

restore();
onChange();
