import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "./sidepanel.css";
import { CATEGORY_ICONS, CATEGORY_TOKEN } from "../../src/lib/categories.ts";
import { randomSeed } from "../../src/lib/rng.ts";
import { FIELDS, FIELD_MAP, PRESETS, fieldGroups, fieldMatches, inRegistryOrder, matchingPreset, presetList, type Category, type Field } from "./catalog.ts";
import { copyText } from "./clipboard.ts";
import {
	DISPLAY_RECORDS,
	EXTENSION_FORMATS,
	MAX_EXTENSION_ROWS,
	checkRows,
	formatBytes,
	formatInfo,
	formatRow,
	friendlyError,
	generateOutput,
	quickValue,
	supportsNearMiss,
	type GeneratedOutput,
	type QuickValue,
} from "./output.ts";
import { STARTER_FAVORITES, TABS, chromeStore, loadPrefs, memoryStore, resetPrefs, savePrefs, type Prefs, type Tab } from "./prefs.ts";

declare const __APP_VERSION__: string;

/** Longest formatted output shown inline; Copy all and Download are never truncated. */
const RAW_PREVIEW_CHARS = 40_000;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const store = chromeStore() ?? memoryStore();
let prefs: Prefs;
let output: GeneratedOutput | null = null;
let quick: QuickValue | null = null;
/** Latest favorite values, in memory only: cleared when the panel closes. */
const favValues = new Map<string, QuickValue>();

// ---------- small helpers ----------

type Props = { [key: string]: string | boolean | undefined };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
	const node: HTMLElementTagNameMap[K] = document.createElement(tag);
	Object.assign(node, props);
	node.append(...children);
	return node;
}

function icon(paths: string): SVGSVGElement {
	const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("aria-hidden", "true");
	svg.innerHTML = paths; // constant markup from this bundle only
	return svg;
}

const ICON_COPY = '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/>';
const ICON_UP = '<path d="M12 19V5M6 11l6-6 6 6"/>';
const ICON_DOWN = '<path d="M12 5v14M6 13l6 6 6-6"/>';
const ICON_REMOVE = '<path d="M6 6l12 12M18 6L6 18"/>';
const ICON_REFRESH = '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>';

type StatusKind = "" | "ok" | "error";
const statusTimers = new WeakMap<HTMLElement, number>();

/** Update a live region. Clearing first makes a repeated message announce again. */
function setStatus(target: HTMLElement, message: string, kind: StatusKind = "") {
	clearTimeout(statusTimers.get(target));
	target.textContent = "";
	target.className = `status ${kind}`.trim();
	statusTimers.set(
		target,
		window.setTimeout(() => (target.textContent = message), 30),
	);
}

let saveTimer = 0;
let warnedSave = false;
function persist() {
	clearTimeout(saveTimer);
	saveTimer = window.setTimeout(async () => {
		const ok = await savePrefs(store, prefs);
		if (!ok && !warnedSave) {
			warnedSave = true;
			setStatus($("foot-status"), "Preferences couldn't be saved. Your choices last until the panel closes.", "error");
		}
	}, 150);
}

function modeLabel(valid: boolean, field?: Field): string {
	if (field && !field.checksum) return "Valid format";
	return valid ? "Valid" : "Near-miss";
}

// ---------- tabs ----------

const tabButtons = TABS.map((t) => $<HTMLButtonElement>(`tab-${t}`));

function showTab(tab: Tab, focus = false) {
	for (const [i, t] of TABS.entries()) {
		const selected = t === tab;
		tabButtons[i].setAttribute("aria-selected", String(selected));
		tabButtons[i].tabIndex = selected ? 0 : -1;
		$(`view-${t}`).hidden = !selected;
	}
	if (focus) tabButtons[TABS.indexOf(tab)].focus();
	if (prefs.tab !== tab) {
		prefs.tab = tab;
		persist();
	}
}

for (const [i, btn] of tabButtons.entries()) {
	btn.addEventListener("click", () => showTab(TABS[i]));
	btn.addEventListener("keydown", (e) => {
		const keys: Record<string, number> = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 };
		if (!(e.key in keys)) return;
		e.preventDefault();
		showTab(TABS[(keys[e.key] + TABS.length) % TABS.length], true);
	});
}

// ---------- Generate: field selection ----------

const groupsEl = $("field-groups");
const searchEl = $<HTMLInputElement>("field-search");
const presetEl = $<HTMLSelectElement>("preset");
let searching = false;

const ALL_FIELDS = "__all";
presetEl.append(el("option", { value: "", textContent: "Custom selection" }));
for (const p of presetList()) presetEl.append(el("option", { value: p.id, textContent: `${p.label} (${p.fields.length})` }));
presetEl.append(el("option", { value: ALL_FIELDS, textContent: `All fields (${FIELDS.length})` }));

for (const { category, fields } of fieldGroups()) {
	const details = el("details", { className: "group" });
	details.dataset.cat = category;
	details.style.setProperty("--cat", `var(--c-${CATEGORY_TOKEN[category]})`);
	const summary = el("summary");
	const glyph = el("span", { className: "group-icon" });
	glyph.append(icon(CATEGORY_ICONS[category]));
	summary.append(glyph, el("span", { className: "group-name", textContent: category }), el("span", { className: "group-count" }));
	const list = el("div", { className: "field-list" });
	for (const f of fields) {
		const box = el("input", { type: "checkbox", name: "field", value: f.id });
		const label = el("label", { className: "field", title: f.description });
		label.dataset.id = f.id;
		const text = el("span", { className: "field-text" }, el("span", { className: "field-name", textContent: f.label }), el("span", { className: "field-id", textContent: f.id }));
		label.append(box, text);
		if (f.checksum) label.append(el("span", { className: "badge", textContent: "checksum", title: "Has a checksum or structure rule; near-miss mode breaks it" }));
		list.append(label);
	}
	details.append(summary, list);
	details.addEventListener("toggle", () => {
		if (searching) return;
		const open = new Set(prefs.expanded);
		if (details.open) open.add(category);
		else open.delete(category);
		prefs.expanded = [...open] as Category[];
		persist();
	});
	groupsEl.append(details);
}

const groups = () => [...groupsEl.querySelectorAll<HTMLDetailsElement>("details.group")];
const boxes = () => [...groupsEl.querySelectorAll<HTMLInputElement>('input[name="field"]')];

function selectedFields(): string[] {
	return inRegistryOrder(boxes().filter((b) => b.checked).map((b) => b.value));
}

function setFields(ids: readonly string[]) {
	const set = new Set(ids);
	for (const b of boxes()) b.checked = set.has(b.value);
	onFieldsChanged();
}

function onFieldsChanged() {
	const ids = selectedFields();
	prefs.fields = ids;
	$("field-count").textContent = `${ids.length} selected`;
	const preset = matchingPreset(ids);
	presetEl.value = preset ?? (ids.length === FIELDS.length ? ALL_FIELDS : "");
	for (const g of groups()) {
		const inGroup = [...g.querySelectorAll<HTMLInputElement>('input[name="field"]')];
		const n = inGroup.filter((b) => b.checked).length;
		const count = g.querySelector(".group-count")!;
		count.textContent = `${n}/${inGroup.length}`;
		count.classList.toggle("some", n > 0);
	}
	persist();
}

groupsEl.addEventListener("change", onFieldsChanged);
presetEl.addEventListener("change", () => {
	const v = presetEl.value;
	if (v === ALL_FIELDS) setFields(FIELDS.map((f) => f.id));
	else if (v && PRESETS[v]) setFields(PRESETS[v].fields);
});
$("fields-clear").addEventListener("click", () => {
	setFields([]);
	setStatus($("gen-status"), "Selection cleared.");
});

function applyFilter() {
	const q = searchEl.value;
	searching = true;
	let any = false;
	for (const g of groups()) {
		let matches = 0;
		for (const label of g.querySelectorAll<HTMLLabelElement>("label.field")) {
			const hit = fieldMatches(FIELD_MAP.get(label.dataset.id!)!, q);
			label.hidden = !hit;
			if (hit) matches++;
		}
		g.hidden = matches === 0;
		g.open = q.trim() ? matches > 0 : prefs.expanded.includes(g.dataset.cat as Category);
		any ||= matches > 0;
	}
	$("search-empty").hidden = any;
	// toggle events fire asynchronously; ignore the ones caused by filtering.
	setTimeout(() => (searching = false), 0);
}
searchEl.addEventListener("input", applyFilter);
searchEl.addEventListener("keydown", (e) => {
	if (e.key === "Escape" && searchEl.value) {
		e.preventDefault();
		searchEl.value = "";
		applyFilter();
	}
});

// ---------- Generate: options ----------

const rowsEl = $<HTMLInputElement>("rows");
const seedEl = $<HTMLInputElement>("seed");
const formatEl = $<HTMLSelectElement>("format");
const headerEl = $<HTMLInputElement>("header");
const rowsHint = $("rows-hint");

for (const f of EXTENSION_FORMATS) formatEl.append(el("option", { value: f.id, textContent: f.label }));

function radio(name: string): string {
	return document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? "valid";
}
function setRadio(name: string, valid: boolean) {
	const input = document.querySelector<HTMLInputElement>(`input[name="${name}"][value="${valid ? "valid" : "invalid"}"]`);
	if (input) input.checked = true;
}

function updateModeHint() {
	$("mode-hint").textContent = prefs.valid
		? "Values pass their checksums. Your DLP rules should flag them."
		: "Values look right but fail their checksums. Your DLP rules should ignore them.";
}

function updateRowsState(): boolean {
	const check = checkRows(rowsEl.value);
	rowsEl.setAttribute("aria-invalid", String(!check.ok));
	rowsHint.textContent = check.ok ? `1 to ${MAX_EXTENSION_ROWS}` : check.message;
	rowsHint.classList.toggle("error", !check.ok);
	if (check.ok) prefs.rows = check.rows;
	return check.ok;
}

function updateFormatState() {
	const info = formatInfo(formatEl.value)!;
	$("header-wrap").hidden = !(info.id === "csv" || info.id === "xlsx");
}

document.querySelectorAll<HTMLInputElement>('input[name="mode"]').forEach((r) =>
	r.addEventListener("change", () => {
		prefs.valid = radio("mode") === "valid";
		updateModeHint();
		persist();
	}),
);
rowsEl.addEventListener("input", () => {
	updateRowsState();
	persist();
});
formatEl.addEventListener("change", () => {
	prefs.format = formatInfo(formatEl.value)!.id;
	updateFormatState();
	if (output && output.format !== prefs.format) {
		clearResults();
		setStatus($("gen-status"), "Format changed. Press Generate for new output.");
	}
	persist();
});
headerEl.addEventListener("change", () => {
	prefs.header = headerEl.checked;
	persist();
});
$("seed-dice").addEventListener("click", () => {
	seedEl.value = randomSeed().slice(0, 8);
	setStatus($("gen-status"), `Seed set to ${seedEl.value}.`);
});

// ---------- Generate: run and results ----------

const generateBtn = $<HTMLButtonElement>("generate");
const resultsEl = $("results");
const recordsEl = $("records");

function clearResults() {
	output = null;
	resultsEl.hidden = true;
	recordsEl.replaceChildren();
}

generateBtn.addEventListener("click", async () => {
	const status = $("gen-status");
	updateRowsState();
	generateBtn.disabled = true;
	try {
		const result = await generateOutput({
			fields: selectedFields(),
			rows: rowsEl.value,
			valid: prefs.valid,
			seed: seedEl.value,
			format: formatEl.value,
			header: headerEl.checked,
		});
		output = result;
		renderResults(result);
		const n = result.dataset.records.length;
		setStatus(status, `Generated ${n} ${n === 1 ? "record" : "records"}, ${formatBytes(result.bytes)} ${result.format.toUpperCase()}.`, "ok");
	} catch (e) {
		setStatus(status, friendlyError(e), "error");
		if (!selectedFields().length) searchEl.focus();
		else if (rowsEl.getAttribute("aria-invalid") === "true") rowsEl.focus();
	} finally {
		generateBtn.disabled = false;
	}
});

function renderResults(out: GeneratedOutput) {
	const { dataset: ds } = out;
	const info = formatInfo(out.format)!;
	$("results-meta").textContent = `${ds.records.length} × ${ds.fields.length} · ${modeLabel(out.valid)} · seed ${ds.seed}`;
	const copyAll = $<HTMLButtonElement>("copy-all");
	copyAll.disabled = !info.copyable;
	copyAll.title = info.copyable ? "" : "Document formats download only. Copy rows or values below.";
	$("download").textContent = `Download .${out.filename.split(".").pop()}`;

	const legend = $("legend");
	legend.hidden = !ds.fields.some((f) => f.checksum);
	legend.replaceChildren(
		"Checksum fields are marked ",
		el("span", { className: out.valid ? "val hit" : "val miss", textContent: out.valid ? "passes" : "near-miss" }),
		out.valid ? ": DLP rules should flag them." : ": they look right but fail their rule.",
	);

	const items: HTMLLIElement[] = [];
	ds.records.slice(0, DISPLAY_RECORDS).forEach((rec, r) => {
		const head = el(
			"div",
			{ className: "rec-head" },
			el("h3", { textContent: `Record ${r + 1}` }),
			el("button", { type: "button", className: "btn sm", textContent: "Copy row", ariaLabel: `Copy record ${r + 1}` }),
		);
		(head.lastChild as HTMLElement).dataset.row = String(r);
		const dl = el("dl", { className: "kv" });
		rec.forEach((v, c) => {
			const f = ds.fields[c];
			const btn = el("button", { type: "button", className: "icon-btn copy", ariaLabel: `Copy ${f.label} from record ${r + 1}`, title: "Copy value" });
			btn.dataset.row = String(r);
			btn.dataset.col = String(c);
			btn.append(icon(ICON_COPY));
			const value = el("code", { className: f.checksum ? `val ${out.valid ? "hit" : "miss"}` : "val", textContent: v });
			dl.append(el("div", { className: "kv-row" }, el("dt", { textContent: f.label, title: f.id }), el("dd", {}, value, btn)));
		});
		items.push(el("li", { className: "record" }, head, dl));
	});
	recordsEl.replaceChildren(...items);

	const more = $("records-more");
	more.hidden = ds.records.length <= DISPLAY_RECORDS;
	more.textContent = `Showing ${DISPLAY_RECORDS} of ${ds.records.length} records. Copy all and Download include every record.`;

	const rawWrap = $<HTMLDetailsElement>("raw-wrap");
	rawWrap.hidden = typeof out.data !== "string";
	if (typeof out.data === "string") {
		const text = out.data;
		$("raw").textContent = text.length > RAW_PREVIEW_CHARS ? `${text.slice(0, RAW_PREVIEW_CHARS)}\n… preview truncated; Copy all includes everything.` : text;
	}
	resultsEl.hidden = false;
}

recordsEl.addEventListener("click", async (e) => {
	const btn = (e.target as Element).closest<HTMLButtonElement>("button[data-row]");
	if (!btn || !output) return;
	const r = Number(btn.dataset.row);
	const ds = output.dataset;
	let text: string;
	let what: string;
	if (btn.dataset.col !== undefined) {
		const c = Number(btn.dataset.col);
		text = ds.records[r][c];
		what = `${ds.fields[c].label} from record ${r + 1}`;
	} else {
		text = formatRow(ds, r, output.format);
		what = `record ${r + 1}`;
	}
	await copyWithStatus(text, what, $("gen-status"), btn);
});

$("copy-all").addEventListener("click", async (e) => {
	if (!output || typeof output.data !== "string") return;
	const n = output.dataset.records.length;
	await copyWithStatus(output.data, `all ${n} ${n === 1 ? "record" : "records"} as ${output.format.toUpperCase()}`, $("gen-status"), e.currentTarget as HTMLElement);
});

$("download").addEventListener("click", () => {
	if (!output) return;
	const status = $("gen-status");
	try {
		const url = URL.createObjectURL(new Blob([output.data as BlobPart], { type: output.mime }));
		const a = el("a", { href: url, download: output.filename });
		document.body.append(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(url), 10_000);
		setStatus(status, `Download started: ${output.filename}.`, "ok");
	} catch {
		setStatus(status, "Couldn't start the download. Try Copy all, or use the full generator.", "error");
	}
});

async function copyWithStatus(text: string, what: string, status: HTMLElement, button?: HTMLElement) {
	const ok = await copyText(text);
	if (ok) {
		setStatus(status, `Copied ${what}.`, "ok");
		if (button) {
			button.classList.add("copied");
			setTimeout(() => button.classList.remove("copied"), 1200);
		}
	} else {
		setStatus(status, "Couldn't copy: the clipboard isn't available here. Select the text and copy it instead.", "error");
	}
}

// ---------- Quick copy ----------

const quickFieldEl = $<HTMLSelectElement>("quick-field");
const quickPin = $<HTMLButtonElement>("quick-pin");

function fieldOptions(select: HTMLSelectElement, include: (f: Field) => boolean = () => true) {
	select.replaceChildren();
	for (const { category, fields } of fieldGroups()) {
		const shown = fields.filter(include);
		if (!shown.length) continue;
		const group = el("optgroup", { label: category });
		for (const f of shown) group.append(el("option", { value: f.id, textContent: f.checksum ? `${f.label} ✓` : f.label }));
		select.append(group);
	}
}
fieldOptions(quickFieldEl);

function quickField(): Field {
	return FIELD_MAP.get(quickFieldEl.value) ?? FIELD_MAP.get("ssn")!;
}

function updateQuick() {
	const f = quickField();
	$("quick-desc").textContent = `${f.description}. API id: ${f.id}.${f.checksum ? " Has a checksum or structure rule." : ""}`;
	const nearMiss = document.querySelector<HTMLInputElement>('input[name="quick-mode"][value="invalid"]')!;
	nearMiss.disabled = !f.checksum;
	setRadio("quick-mode", f.checksum ? prefs.quickValid : true);
	$("quick-mode-note").textContent = f.checksum
		? prefs.quickValid
			? "Passes its checksum or structure rule."
			: "Looks right but fails its rule, for false-positive tests."
		: "No checksum or structure rule, so there's no near-miss form.";
	const pinned = prefs.favorites.includes(f.id);
	quickPin.setAttribute("aria-pressed", String(pinned));
	quickPin.textContent = pinned ? "★ Pinned" : "☆ Pin";
	quickPin.ariaLabel = pinned ? `Unpin ${f.label} from favorites` : `Pin ${f.label} to favorites`;
}

quickFieldEl.addEventListener("change", () => {
	prefs.quickField = quickField().id;
	updateQuick();
	persist();
});
document.querySelectorAll<HTMLInputElement>('input[name="quick-mode"]').forEach((r) =>
	r.addEventListener("change", () => {
		prefs.quickValid = radio("quick-mode") === "valid";
		updateQuick();
		persist();
	}),
);

$("quick-generate").addEventListener("click", () => {
	const f = quickField();
	const status = $("quick-status");
	try {
		quick = quickValue(f.id, supportsNearMiss(f.id) ? prefs.quickValid : true);
		$("quick-meta").textContent = `${f.label} · ${modeLabel(quick.valid, f)} · seed ${quick.seed}`;
		const value = $("quick-value");
		value.textContent = quick.value;
		value.className = f.checksum ? `value ${quick.valid ? "hit" : "miss"}` : "value";
		$("quick-result").hidden = false;
		setStatus(status, `Generated ${modeLabel(quick.valid, f).toLowerCase()} ${f.label}. Use Copy value to copy it.`, "ok");
	} catch (e) {
		setStatus(status, friendlyError(e), "error");
	}
});
$("quick-copy").addEventListener("click", async (e) => {
	if (!quick) return;
	await copyWithStatus(quick.value, `${quick.field.label} (${modeLabel(quick.valid, quick.field).toLowerCase()})`, $("quick-status"), e.currentTarget as HTMLElement);
});
quickPin.addEventListener("click", () => {
	const f = quickField();
	const pinned = prefs.favorites.includes(f.id);
	prefs.favorites = pinned ? prefs.favorites.filter((id) => id !== f.id) : [...prefs.favorites, f.id];
	updateQuick();
	renderFavorites();
	persist();
	setStatus($("quick-status"), pinned ? `Unpinned ${f.label}.` : `Pinned ${f.label} to favorites.`, "ok");
});

// ---------- Favorites ----------

const favList = $("fav-list");
const favAdd = $<HTMLSelectElement>("fav-add-field");
$("fav-starter-list").textContent = `Adds ${STARTER_FAVORITES.map((id) => FIELD_MAP.get(id)?.label).filter(Boolean).join(", ")}. You can remove any of them.`;

function renderFavorites(focus?: { id: string; action: string }) {
	const items = prefs.favorites.map((id, i) => {
		const f = FIELD_MAP.get(id)!;
		const current = favValues.get(id);
		const tool = (action: string, svg: string, label: string, disabled = false) => {
			const b = el("button", { type: "button", className: "icon-btn", ariaLabel: label, title: label, disabled });
			b.dataset.action = action;
			b.append(icon(svg));
			return b;
		};
		const name = el("span", { className: "fav-name" }, el("span", { className: "cat-dot" }), f.label);
		(name.firstChild as HTMLElement).style.setProperty("background", `var(--c-${CATEGORY_TOKEN[f.category]})`);
		if (f.checksum) name.append(el("span", { className: "badge", textContent: "checksum" }));
		const top = el(
			"div",
			{ className: "fav-top" },
			name,
			el(
				"div",
				{ className: "fav-tools" },
				tool("up", ICON_UP, `Move ${f.label} up`, i === 0),
				tool("down", ICON_DOWN, `Move ${f.label} down`, i === prefs.favorites.length - 1),
				tool("remove", ICON_REMOVE, `Remove ${f.label} from favorites`),
			),
		);
		const value = el("code", {
			className: current ? (f.checksum ? `val ${current.valid ? "hit" : "miss"}` : "val") : "val placeholder",
			textContent: current ? current.value : "No value yet",
		});
		const gen = el("button", { type: "button", className: "btn sm", ariaLabel: `Generate a new ${f.label}` }, icon(ICON_REFRESH), current ? "New" : "Generate");
		gen.dataset.action = "generate";
		const copy = el("button", { type: "button", className: "btn sm", textContent: "Copy", ariaLabel: `Copy ${f.label} value`, disabled: !current });
		copy.dataset.action = "copy";
		const row = el("div", { className: "fav-value" }, value, el("div", { className: "fav-actions" }, gen, copy));
		const meta = el("p", { className: "fav-meta", textContent: current ? `${modeLabel(current.valid, f)} · seed ${current.seed}` : f.id });
		const li = el("li", { className: "fav" }, top, row, meta);
		li.dataset.id = id;
		return li;
	});
	favList.replaceChildren(...items);
	$("fav-empty").hidden = prefs.favorites.length > 0;
	favList.hidden = prefs.favorites.length === 0;

	const pinned = new Set(prefs.favorites);
	fieldOptions(favAdd, (f) => !pinned.has(f.id));
	const addBtn = $<HTMLButtonElement>("fav-add");
	addBtn.disabled = favAdd.options.length === 0;

	if (focus) {
		const li = favList.querySelector<HTMLElement>(`li[data-id="${CSS.escape(focus.id)}"]`);
		const target = li?.querySelector<HTMLButtonElement>(`button[data-action="${focus.action}"]:not(:disabled)`) ?? li?.querySelector<HTMLButtonElement>("button:not(:disabled)");
		target?.focus();
	}
}

favList.addEventListener("click", async (e) => {
	const btn = (e.target as Element).closest<HTMLButtonElement>("button[data-action]");
	const li = btn?.closest<HTMLElement>("li.fav");
	if (!btn || !li) return;
	const id = li.dataset.id!;
	const f = FIELD_MAP.get(id)!;
	const status = $("fav-status");
	const i = prefs.favorites.indexOf(id);
	switch (btn.dataset.action) {
		case "generate":
			try {
				favValues.set(id, quickValue(id, supportsNearMiss(id) ? prefs.favoritesValid : true));
				renderFavorites({ id, action: "copy" });
				setStatus(status, `Generated ${modeLabel(favValues.get(id)!.valid, f).toLowerCase()} ${f.label}.`, "ok");
			} catch (err) {
				setStatus(status, friendlyError(err), "error");
			}
			break;
		case "copy": {
			const v = favValues.get(id);
			if (v) await copyWithStatus(v.value, `${f.label} (${modeLabel(v.valid, f).toLowerCase()})`, status, btn);
			break;
		}
		case "up":
		case "down": {
			const j = btn.dataset.action === "up" ? i - 1 : i + 1;
			if (j < 0 || j >= prefs.favorites.length) return;
			const next = [...prefs.favorites];
			[next[i], next[j]] = [next[j], next[i]];
			prefs.favorites = next;
			renderFavorites({ id, action: btn.dataset.action });
			persist();
			setStatus(status, `Moved ${f.label} to position ${j + 1} of ${next.length}.`);
			break;
		}
		case "remove": {
			const neighbour = prefs.favorites[i + 1] ?? prefs.favorites[i - 1];
			prefs.favorites = prefs.favorites.filter((x) => x !== id);
			favValues.delete(id);
			renderFavorites(neighbour ? { id: neighbour, action: "remove" } : undefined);
			if (!neighbour) $("fav-starter").focus();
			updateQuick();
			persist();
			setStatus(status, `Removed ${f.label} from favorites.`);
			break;
		}
	}
});

$("fav-add").addEventListener("click", () => {
	const id = favAdd.value;
	const f = FIELD_MAP.get(id);
	if (!f || prefs.favorites.includes(id)) return;
	prefs.favorites = [...prefs.favorites, id];
	renderFavorites();
	updateQuick();
	persist();
	setStatus($("fav-status"), `Pinned ${f.label}.`, "ok");
	favAdd.focus();
});

$("fav-starter").addEventListener("click", () => {
	prefs.favorites = [...new Set([...prefs.favorites, ...STARTER_FAVORITES.filter((id) => FIELD_MAP.has(id))])];
	renderFavorites();
	updateQuick();
	persist();
	setStatus($("fav-status"), `Pinned ${prefs.favorites.length} starter fields.`, "ok");
	favList.querySelector<HTMLButtonElement>('button[data-action="generate"]')?.focus();
});

document.querySelectorAll<HTMLInputElement>('input[name="fav-mode"]').forEach((r) =>
	r.addEventListener("change", () => {
		prefs.favoritesValid = radio("fav-mode") === "valid";
		persist();
	}),
);

// ---------- preferences ----------

function applyPrefs() {
	for (const b of boxes()) b.checked = prefs.fields.includes(b.value);
	onFieldsChanged();
	searchEl.value = "";
	applyFilter();
	setRadio("mode", prefs.valid);
	updateModeHint();
	rowsEl.value = String(prefs.rows);
	updateRowsState();
	formatEl.value = prefs.format;
	updateFormatState();
	headerEl.checked = prefs.header;
	quickFieldEl.value = prefs.quickField;
	updateQuick();
	setRadio("fav-mode", prefs.favoritesValid);
	renderFavorites();
	showTab(prefs.tab);
}

$("reset-prefs").addEventListener("click", async () => {
	prefs = await resetPrefs(store);
	favValues.clear();
	clearResults();
	seedEl.value = "";
	applyPrefs();
	setStatus($("foot-status"), "Saved preferences were reset to the defaults.", "ok");
});

$("version").textContent = `v${__APP_VERSION__}`;

const loaded = await loadPrefs(store);
prefs = loaded.prefs;
applyPrefs();
if (loaded.repaired) setStatus($("foot-status"), "Some saved preferences were out of date and have been reset.");
document.documentElement.dataset.ready = "true";
