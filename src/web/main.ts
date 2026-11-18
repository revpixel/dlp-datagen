import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import { CATEGORIES, FIELDS, PRESETS, type Category } from "../lib/fields.ts";
import { EXTENSION, MIME, generate, isBinary, render, type Dataset, type Format } from "../lib/generate.ts";
import { randomSeed } from "../lib/rng.ts";

const MAX_BROWSER_ROWS = 100_000;
/** Word and PDF output runs to ~10 lines per record; keep files openable. */
const MAX_BROWSER_DOCUMENT_ROWS = 10_000;
const MAX_API_ROWS = 10_000;
const MAX_API_DOCUMENT_ROWS = 2_000;
const PREVIEW_ROWS = 50;
const STORAGE_KEY = "dlp-datagen:settings";
const THEME_KEY = "dlp-datagen:theme";

const CATEGORY_ICONS: Record<Category, string> = {
	Identity: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
	Contact: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
	"Government ID": '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.5 1.7-2.2 3-2.2s2.4.7 3 2.2M15 10h3M15 13.5h3"/>',
	Financial: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
	Health: '<path d="M12 20s-8-4.6-8-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.8C20 15.4 12 20 12 20z"/><path d="M8 12h2.2l1.3-2.5 2 5 1.3-2.5H16"/>',
	Secrets: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16.5 6.5l2.5 2.5M14.5 8.5l2 2"/>',
	Network: '<rect x="9" y="3" width="6" height="5" rx="1.2"/><rect x="3" y="16" width="6" height="5" rx="1.2"/><rect x="15" y="16" width="6" height="5" rx="1.2"/><path d="M12 8v4M6 16v-2.5h12V16"/>',
};

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const groupsEl = $("field-groups");
const presetsEl = $("presets");
const rowsEl = $<HTMLInputElement>("rows");
const seedEl = $<HTMLInputElement>("seed");
const headerEl = $<HTMLInputElement>("header");
const statusEl = $("status");
const previewEl = $("preview");
const previewMeta = $("preview-meta");
const legendEl = $("legend");
const downloadBtn = $<HTMLButtonElement>("download");
const copyBtn = $<HTMLButtonElement>("copy");
const generateBtn = $<HTMLButtonElement>("generate");
const apiCmd = $("api-cmd");
const rowsHint = $("rows-hint");
const fieldCount = $("field-count");
const modeHint = $("mode-hint");

let output: { data: string | Uint8Array; format: Format } | null = null;

$("stat-fields").textContent = String(FIELDS.length);
$("stat-rules").textContent = String(FIELDS.filter((f) => f.checksum).length);

// ---------- theme ----------
function currentTheme(): "light" | "dark" {
	const set = document.documentElement.dataset.theme;
	if (set === "light" || set === "dark") return set;
	return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
$("theme-toggle").addEventListener("click", () => {
	const next = currentTheme() === "dark" ? "light" : "dark";
	document.documentElement.dataset.theme = next;
	try {
		localStorage.setItem(THEME_KEY, next);
	} catch {
		/* storage unavailable */
	}
});

// ---------- field tiles ----------
for (const cat of CATEGORIES) {
	const group = document.createElement("div");
	group.className = "group";
	group.dataset.cat = cat;
	const head = document.createElement("h3");
	head.className = "group-head";
	const icon = document.createElement("span");
	icon.className = "group-icon";
	icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${CATEGORY_ICONS[cat]}</svg>`;
	head.append(icon, document.createTextNode(cat));
	const tiles = document.createElement("div");
	tiles.className = "tiles";
	for (const f of FIELDS.filter((x) => x.category === cat)) {
		const label = document.createElement("label");
		label.className = "tile";
		label.title = f.description;
		const box = document.createElement("input");
		box.type = "checkbox";
		box.value = f.id;
		box.name = "field";
		const name = document.createElement("span");
		name.className = "tile-name";
		name.textContent = f.label;
		label.append(box, name);
		if (f.checksum) {
			const b = document.createElement("span");
			b.className = "badge";
			b.textContent = "checksum";
			b.title = "Has a checksum or structure rule; near-miss mode breaks it";
			label.append(b);
		}
		tiles.append(label);
	}
	group.append(head, tiles);
	groupsEl.append(group);
}

for (const [key, p] of Object.entries(PRESETS)) {
	const chip = document.createElement("button");
	chip.type = "button";
	chip.className = "chip";
	chip.textContent = p.label;
	chip.dataset.preset = key;
	chip.addEventListener("click", () => setFields(p.fields));
	presetsEl.append(chip);
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

function radioValue(name: string): string {
	return document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? "";
}
function setRadio(name: string, value: string) {
	const el = document.querySelector<HTMLInputElement>(`input[name="${name}"][value="${CSS.escape(value)}"]`);
	if (el) el.checked = true;
}
const format = (): Format => (radioValue("format") || "csv") as Format;
const isValidMode = (): boolean => radioValue("mode") !== "invalid";

function maxRows(f: Format): number {
	return f === "docx" || f === "pdf" ? MAX_BROWSER_DOCUMENT_ROWS : MAX_BROWSER_ROWS;
}

// ---------- quick controls ----------
document.querySelectorAll<HTMLButtonElement>("[data-rows]").forEach((b) =>
	b.addEventListener("click", () => {
		rowsEl.value = String(Math.min(Number(b.dataset.rows), maxRows(format())));
		onChange();
	}),
);
$("seed-dice").addEventListener("click", () => {
	seedEl.value = randomSeed().slice(0, 8);
	onChange();
});

// ---------- settings persistence (per-browser convenience only) ----------
function save() {
	try {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ fields: selectedFields(), rows: rowsEl.value, format: format(), valid: isValidMode(), header: headerEl.checked }),
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
	for (const b of boxes()) b.checked = (s?.fields?.length ? s.fields : PRESETS.pii.fields).includes(b.value);
	if (s?.rows) rowsEl.value = s.rows;
	if (s?.format) setRadio("format", s.format);
	if (s?.header === false) headerEl.checked = false;
	if (s?.valid === false) setRadio("mode", "invalid");
}

// ---------- API command ----------
function apiCommand(): { text: string; url: string; out: string } {
	const f = format();
	const params = new URLSearchParams();
	params.set("fields", selectedFields().join(","));
	params.set("rows", String(Math.min(Number(rowsEl.value) || 10, isBinary(f) ? MAX_API_DOCUMENT_ROWS : MAX_API_ROWS)));
	params.set("format", f);
	if (!isValidMode()) params.set("valid", "false");
	if (seedEl.value.trim()) params.set("seed", seedEl.value.trim());
	if ((f === "csv" || f === "xlsx") && !headerEl.checked) params.set("header", "false");
	const url = `${location.origin}/api/generate?${params.toString().replace(/%2C/g, ",")}`;
	const out = isBinary(f) ? `-o dlp-test-data.${EXTENSION[f]}` : "";
	return { text: `curl "${url}"${out ? " " + out : ""}`, url, out };
}

function renderApiCmd() {
	const { url, out } = apiCommand();
	const span = (cls: string, text: string) => {
		const s = document.createElement("span");
		s.className = cls;
		s.textContent = text;
		return s;
	};
	const parts: (Node | string)[] = [span("tok-cmd", "curl"), " ", span("tok-url", `"${url}"`)];
	if (out) parts.push(" ", span("tok-flag", out));
	apiCmd.replaceChildren(...parts);
}

$("copy-api").addEventListener("click", async (e) => {
	const btn = e.currentTarget as HTMLButtonElement;
	try {
		await navigator.clipboard.writeText(apiCommand().text);
		btn.textContent = "Copied";
	} catch {
		btn.textContent = "Blocked";
	}
	setTimeout(() => (btn.textContent = "Copy"), 1500);
});

// ---------- API docs disclosure ----------
// One button shows/hides all detailed API docs. State lives on <html data-api-docs>
// (set before first paint in index.html) and is remembered for the browser session.
const DOCS_KEY = "dlp-datagen:api-docs";
const docsToggle = $<HTMLButtonElement>("docs-toggle");
const docsBody = $("api-docs-body");
const docsLabel = docsToggle.querySelector(".docs-toggle-label")!;

function setDocsOpen(open: boolean, remember = true) {
	document.documentElement.dataset.apiDocs = open ? "open" : "closed";
	docsToggle.setAttribute("aria-expanded", String(open));
	docsLabel.textContent = open ? "Collapse" : "Expand";
	docsBody.inert = !open;
	if (remember) {
		try {
			sessionStorage.setItem(DOCS_KEY, open ? "open" : "closed");
		} catch {
			/* storage unavailable */
		}
	}
}
setDocsOpen(document.documentElement.dataset.apiDocs === "open", false);
docsToggle.addEventListener("click", () => setDocsOpen(docsToggle.getAttribute("aria-expanded") !== "true"));

/** Links into the docs (e.g. the endpoint names above) open them first, then scroll. */
function revealDocTarget(hash: string): boolean {
	const target = hash.length > 1 ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
	if (!target || !docsBody.contains(target)) return false;
	if (docsToggle.getAttribute("aria-expanded") !== "true") setDocsOpen(true);
	// Wait for the expand transition before scrolling so the position is final.
	setTimeout(() => target.scrollIntoView({ block: "start" }), 320);
	return true;
}
document.addEventListener("click", (e) => {
	const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
	if (a && revealDocTarget(a.hash)) {
		e.preventDefault();
		history.replaceState(null, "", a.hash);
	}
});
if (location.hash) revealDocTarget(location.hash);

// Copy buttons on the static API examples: copy the whole command in the same block.
document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((btn) =>
	btn.addEventListener("click", async () => {
		const text = btn.closest(".example")?.querySelector("pre code")?.textContent ?? "";
		try {
			await navigator.clipboard.writeText(text);
			btn.textContent = "Copied";
		} catch {
			btn.textContent = "Blocked";
		}
		setTimeout(() => (btn.textContent = "Copy"), 1500);
	}),
);

// ---------- change handling ----------
function onChange() {
	const f = format();
	const ids = selectedFields();
	headerEl.disabled = f !== "csv" && f !== "xlsx";
	rowsEl.max = String(maxRows(f));
	rowsHint.textContent = `max ${maxRows(f).toLocaleString()}`;
	fieldCount.textContent = `${ids.length} selected`;
	modeHint.textContent = isValidMode()
		? "Values pass their checksums. Your DLP rules should flag them."
		: "Values look right but fail their checksums. Your DLP rules should ignore them.";
	for (const chip of presetsEl.querySelectorAll<HTMLButtonElement>(".chip")) {
		const p = PRESETS[chip.dataset.preset!].fields;
		chip.classList.toggle("active", p.length === ids.length && p.every((id) => ids.includes(id)));
	}
	if (output && output.format !== f) {
		output = null;
		downloadBtn.disabled = copyBtn.disabled = true;
		setStatus("Format changed. Press Generate again.");
	}
	renderApiCmd();
	save();
}

for (const el of [rowsEl, seedEl, headerEl]) el.addEventListener("input", onChange);
groupsEl.addEventListener("change", onChange);
document.querySelectorAll('input[name="mode"], input[name="format"]').forEach((el) => el.addEventListener("change", onChange));

// ---------- generate ----------
function setStatus(msg: string, kind: "" | "ok" | "error" = "") {
	statusEl.textContent = msg;
	statusEl.className = `status ${kind}`;
}

function renderPreview(ds: Dataset, valid: boolean) {
	const table = document.createElement("table");
	const headRow = table.createTHead().insertRow();
	const corner = document.createElement("th");
	corner.textContent = "#";
	corner.className = "rownum";
	headRow.append(corner);
	for (const f of ds.fields) {
		const th = document.createElement("th");
		const dot = document.createElement("span");
		dot.className = "cat-dot";
		dot.style.background = `var(--c-${catVar(f.category)})`;
		th.append(dot, document.createTextNode(f.label));
		th.title = f.id;
		headRow.append(th);
	}
	const body = table.createTBody();
	ds.records.slice(0, PREVIEW_ROWS).forEach((rec, n) => {
		const tr = body.insertRow();
		const num = tr.insertCell();
		num.className = "rownum";
		num.textContent = String(n + 1);
		rec.forEach((v, i) => {
			const td = tr.insertCell();
			if (v.includes("\n")) td.className = "multiline";
			if (ds.fields[i].checksum) {
				const mark = document.createElement("span");
				mark.className = valid ? "hit" : "miss";
				mark.textContent = v;
				td.append(mark);
			} else {
				td.textContent = v;
			}
		});
	});
	previewEl.replaceChildren(table);
	legendEl.hidden = !ds.fields.some((f) => f.checksum);
	const shown = Math.min(PREVIEW_ROWS, ds.records.length);
	previewMeta.textContent = `${shown} of ${ds.records.length.toLocaleString()} rows · seed ${ds.seed}`;
}

function catVar(c: Category): string {
	return { Identity: "identity", Contact: "contact", "Government ID": "gov", Financial: "financial", Health: "health", Secrets: "secrets", Network: "network" }[c];
}

function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

generateBtn.addEventListener("click", async () => {
	const fields = selectedFields();
	const rows = Number(rowsEl.value);
	const f = format();
	const max = maxRows(f);
	if (!fields.length) return setStatus("Choose at least one field.", "error");
	if (!Number.isInteger(rows) || rows < 1 || rows > max) {
		return setStatus(`Rows must be a whole number from 1 to ${max.toLocaleString()} for ${f.toUpperCase()}.`, "error");
	}
	generateBtn.disabled = true;
	setStatus("Generating…");
	try {
		const t0 = performance.now();
		const valid = isValidMode();
		const ds = generate({ fields, rows, valid, seed: seedEl.value });
		const data = await render(ds, f, headerEl.checked);
		output = { data, format: f };
		renderPreview(ds, valid);
		downloadBtn.disabled = false;
		copyBtn.disabled = typeof data !== "string";
		copyBtn.title = typeof data === "string" ? "" : "Binary formats can't be copied as text";
		const size = typeof data === "string" ? new Blob([data]).size : data.length;
		setStatus(`${rows.toLocaleString()} rows · ${formatBytes(size)} ${f.toUpperCase()} · ${Math.round(performance.now() - t0)} ms`, "ok");
	} catch (e) {
		setStatus(`Couldn't generate: ${e instanceof Error ? e.message : e}`, "error");
	} finally {
		generateBtn.disabled = false;
	}
});

downloadBtn.addEventListener("click", () => {
	if (!output) return;
	const url = URL.createObjectURL(new Blob([output.data as BlobPart], { type: MIME[output.format] }));
	const a = document.createElement("a");
	a.href = url;
	a.download = `dlp-test-data.${EXTENSION[output.format]}`;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
});

copyBtn.addEventListener("click", async () => {
	if (!output || typeof output.data !== "string") return;
	try {
		await navigator.clipboard.writeText(output.data);
		setStatus("Copied to clipboard.", "ok");
	} catch {
		setStatus("Couldn't copy: clipboard access was blocked.", "error");
	}
});

restore();
onChange();
