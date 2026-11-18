// End-to-end tests against the real unpacked extension, loaded into headless
// Chrome (or another Chromium browser) over the DevTools pipe. The panel page
// runs as chrome-extension://<id>/sidepanel.html with real chrome.storage and
// the packaged CSP. Skipped when there is no build or no browser.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, before, describe, test } from "node:test";
import { generate, render, serialize } from "../../src/lib/generate.ts";
import { PRESETS, inRegistryOrder } from "../../src/lib/fields.ts";
import { Browser, findChrome, type Page } from "../scripts/cdp.ts";

const dist = resolve(import.meta.dirname, "../dist");
const chromePath = findChrome();
const skip = !existsSync(join(dist, "manifest.json")) ? "extension not built (run npm run ext:build)" : !chromePath ? "no Chrome/Chromium found (set CHROME_PATH)" : false;

let browser: Browser;
let page: Page;
let extId: string;
let downloads: string;
const problems: string[] = [];
const requests: string[] = [];

const panelUrl = () => `chrome-extension://${extId}/sidepanel.html`;

async function openPanel(width = 320) {
	await page.setViewport(width, 760);
	await page.goto(panelUrl());
	await page.waitFor("document.documentElement.dataset.ready === 'true'");
}

const js = (code: string) => page.eval(code);
const click = (id: string) => js(`document.getElementById(${JSON.stringify(id)}).click()`);
const text = (id: string) => js(`document.getElementById(${JSON.stringify(id)}).textContent`) as Promise<string>;
const activeId = () => js("document.activeElement?.id || document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName") as Promise<string>;
const settle = () => new Promise((r) => setTimeout(r, 120));
/** Let the panel's debounced (150 ms) preference save finish. */
const saved = () => new Promise((r) => setTimeout(r, 400));

/** Wait until a live region shows a message (matching `re` when given, since an older message may still be showing). */
async function statusOf(id: string, re?: RegExp): Promise<string> {
	const sel = `document.getElementById(${JSON.stringify(id)}).textContent`;
	await page.waitFor(re ? `new RegExp(${JSON.stringify(re.source)}).test(${sel})` : `${sel}.trim().length > 0`);
	return text(id);
}

async function setValue(id: string, value: string, event = "input") {
	await js(`(() => { const el = document.getElementById(${JSON.stringify(id)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event(${JSON.stringify(event)}, { bubbles: true })); })()`);
}

async function chooseFields(ids: readonly string[]) {
	await js(`(() => {
		const want = new Set(${JSON.stringify(ids)});
		for (const b of document.querySelectorAll('input[name="field"]')) b.checked = want.has(b.value);
		document.getElementById('field-groups').dispatchEvent(new Event('change', { bubbles: true }));
	})()`);
}

/** Clipboard text with line endings normalised (Windows converts LF to CRLF on the clipboard). */
async function clipboard(): Promise<string> {
	return lf(await js("navigator.clipboard.readText()"));
}
const lf = (s: string) => s.replace(/\r\n/g, "\n");

/** Elements wider than the viewport, or a page that scrolls sideways. */
async function overflow(): Promise<string[]> {
	return js(`(() => {
		const w = document.documentElement.clientWidth;
		const bad = [];
		if (document.documentElement.scrollWidth > w) bad.push('page scrollWidth ' + document.documentElement.scrollWidth + ' > ' + w);
		for (const el of document.body.querySelectorAll('*')) {
			if (el.closest('[hidden], .sr-only, .clip-buffer, pre')) continue;
			const r = el.getBoundingClientRect();
			if (r.width && r.right > w + 0.5) bad.push((el.id || el.className || el.tagName) + ' right=' + Math.round(r.right));
		}
		return bad.slice(0, 10);
	})()`);
}

describe("extension end to end", { skip }, () => {
	before(async () => {
		downloads = mkdtempSync(join(tmpdir(), "dlp-ext-dl-"));
		browser = await Browser.launch(chromePath!);
		({ id: extId } = await browser.send("Extensions.loadUnpacked", { path: dist }));
		await browser.send("Browser.setDownloadBehavior", { behavior: "allowAndName", downloadPath: downloads, eventsEnabled: true });
		await browser.send("Browser.grantPermissions", { origin: `chrome-extension://${extId}`, permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"] });
		page = await browser.newPage();
		await page.send("Emulation.setFocusEmulationEnabled", { enabled: true });
		await page.send("Network.enable");
		await page.send("Log.enable");
		page.on("Network.requestWillBeSent", (p) => requests.push(p.request.url));
		page.on("Runtime.exceptionThrown", (p) => problems.push(`exception: ${p.exceptionDetails.exception?.description ?? p.exceptionDetails.text}`));
		page.on("Runtime.consoleAPICalled", (p) => {
			if (p.type === "error" || p.type === "warning") problems.push(`console.${p.type}: ${p.args.map((a: { value?: unknown }) => a.value).join(" ")}`);
		});
		page.on("Log.entryAdded", (p) => {
			if (p.entry.level === "error") problems.push(`log: ${p.entry.text}`);
		});
		await openPanel();
	});

	after(async () => {
		await browser?.close();
		rmSync(downloads, { recursive: true, force: true });
	});

	test("service worker makes the toolbar button open the side panel", async () => {
		const { targetInfos } = await browser.send("Target.getTargets");
		assert.ok(
			targetInfos.some((t: { type: string; url: string }) => t.type === "service_worker" && t.url === `chrome-extension://${extId}/background.js`),
			"background service worker registered",
		);
		await page.waitFor("chrome.sidePanel.getPanelBehavior().then((b) => b.openPanelOnActionClick)");
		const m = await js("chrome.runtime.getManifest()");
		assert.deepEqual(m.permissions, ["sidePanel", "storage"]);
		assert.equal(await text("version"), `v${m.version}`);
	});

	test("every registry field and preset is in the panel", async () => {
		const fields = await js("[...document.querySelectorAll('input[name=field]')].map((b) => b.value)");
		const { FIELDS } = await import("../../src/lib/fields.ts");
		assert.deepEqual(fields, FIELDS.map((f) => f.id));
		const presets = await js("[...document.getElementById('preset').options].map((o) => o.value)");
		assert.deepEqual(presets, ["", ...Object.keys(PRESETS), "__all"]);
		const quick = await js("[...document.getElementById('quick-field').options].map((o) => o.value)");
		assert.deepEqual(new Set(quick), new Set(FIELDS.map((f) => f.id)));
		const groups = await js("[...document.querySelectorAll('details.group')].map((d) => [d.dataset.cat, d.open])");
		assert.equal(groups.length, 7);
		assert.ok(groups.every(([, open]: [string, boolean]) => !open), "categories start collapsed");
	});

	test("narrow widths never scroll sideways", async () => {
		for (const width of [280, 320, 360, 420]) {
			await openPanel(width);
			for (const tab of ["generate", "quick", "favorites"]) {
				await click(`tab-${tab}`);
				assert.deepEqual(await overflow(), [], `${tab} at ${width}px`);
			}
			// Worst case: every field open, long secrets, JSON output.
			await click("tab-generate");
			await js("document.querySelectorAll('details.group').forEach((d) => (d.open = true))");
			await setValue("preset", "__all", "change");
			await setValue("rows", "3");
			await setValue("format", "json", "change");
			await setValue("seed", "narrow");
			await click("generate");
			await statusOf("gen-status");
			await js("document.getElementById('raw-wrap').open = true");
			assert.deepEqual(await overflow(), [], `all fields generated at ${width}px`);
			await click("tab-favorites");
			await click("fav-starter");
			await js("document.querySelectorAll('#fav-list button[data-action=generate]').forEach((b) => b.click())");
			assert.deepEqual(await overflow(), [], `favorites with values at ${width}px`);
			await click("reset-prefs");
			await settle();
		}
		await openPanel();
	});

	test("the whole flow works from the keyboard with visible focus", async () => {
		await click("reset-prefs");
		await openPanel();
		await js("document.activeElement?.blur(); window.focus()");
		const visited: string[] = [];
		const noRing: string[] = [];
		const ringCheck = `(() => { const s = getComputedStyle(document.activeElement); const sib = document.activeElement.nextElementSibling; const ss = sib ? getComputedStyle(sib) : null;
			return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2 || (ss && ss.outlineStyle !== 'none' && parseFloat(ss.outlineWidth) >= 2); })()`;
		// Tab from the top until the tab list.
		for (let i = 0; i < 6 && (await activeId()) !== "tab-generate"; i++) await page.key("Tab");
		assert.equal(await activeId(), "tab-generate");
		await page.key("ArrowRight");
		assert.equal(await activeId(), "tab-quick");
		assert.equal(await js("document.getElementById('tab-quick').getAttribute('aria-selected')"), "true");
		assert.equal(await js("document.getElementById('view-quick').hidden"), false);
		await page.key("End");
		assert.equal(await activeId(), "tab-favorites");
		await page.key("Home");
		assert.equal(await activeId(), "tab-generate");
		assert.equal(await js("document.getElementById('view-generate').hidden"), false);

		// Walk the Generate view: open a category, toggle a field, reach Generate, run it.
		let openedCategory = false;
		let toggled = false;
		for (let i = 0; i < 60; i++) {
			await page.key("Tab");
			const id = await activeId();
			visited.push(id);
			if (!(await js(ringCheck))) noRing.push(id);
			if (!openedCategory && (await js("document.activeElement.tagName === 'SUMMARY'"))) {
				await page.key("Enter");
				assert.equal(await js("document.activeElement.parentElement.open"), true, "Enter opens a category");
				openedCategory = true;
			} else if (openedCategory && !toggled && (await js("document.activeElement.name === 'field'"))) {
				const before = await js("document.activeElement.checked");
				await page.key(" ");
				assert.equal(await js("document.activeElement.checked"), !before, "Space toggles a field");
				toggled = true;
			}
			if (id === "generate") break;
		}
		assert.ok(openedCategory && toggled, `reached category and field: ${visited.join(" > ")}`);
		assert.equal(visited.at(-1), "generate", `Generate reachable by Tab: ${visited.join(" > ")}`);
		assert.deepEqual(noRing, [], "every tab stop shows a focus ring");
		await page.key("Enter");
		assert.match(await statusOf("gen-status"), /^Generated \d+ records?/);
		// Copy all is the next stop after the status and results heading.
		for (let i = 0; i < 4 && (await activeId()) !== "copy-all"; i++) await page.key("Tab");
		assert.equal(await activeId(), "copy-all");
		await page.key("Enter");
		assert.match(await statusOf("gen-status", /^Copied all/), /^Copied all/);
	});

	test("live regions announce generate, copy and errors", async () => {
		await openPanel();
		const roles = await js("[...document.querySelectorAll('.status')].map((s) => s.getAttribute('role'))");
		assert.ok(roles.every((r: string) => r === "status"));
		await chooseFields([]);
		await click("generate");
		assert.equal(await statusOf("gen-status"), "Choose at least one field.");
		assert.match(await js("document.getElementById('gen-status').className"), /error/);
		assert.equal(await js("document.getElementById('results').hidden"), true);
	});

	test("row count is validated in the panel", async () => {
		await openPanel();
		await chooseFields(["ssn"]);
		for (const bad of ["0", "abc", "501", "2.5", ""]) {
			await setValue("rows", bad);
			assert.equal(await js("document.getElementById('rows').getAttribute('aria-invalid')"), "true", bad);
			assert.match(await text("rows-hint"), /whole number from 1 to 500/);
			await click("generate");
			assert.match(await statusOf("gen-status"), /^Rows must be a whole number from 1 to 500\.$/);
		}
		await setValue("rows", "500");
		assert.equal(await js("document.getElementById('rows').getAttribute('aria-invalid')"), "false");
		await click("generate");
		assert.match(await statusOf("gen-status"), /^Generated 500 records/);
		assert.equal(await js("document.querySelectorAll('#records > li').length"), 20, "only 20 cards rendered");
		assert.match(await text("records-more"), /Showing 20 of 500/);
	});

	test("generated output and copies match the shared generator exactly", async () => {
		await openPanel();
		const fields = inRegistryOrder(PRESETS.cloud_secrets.fields);
		await chooseFields(fields);
		await setValue("rows", "4");
		await setValue("seed", "e2e-seed");
		await js("document.querySelector('input[name=mode][value=invalid]').click()");
		for (const format of ["txt", "csv", "json", "ndjson"] as const) {
			await setValue("format", format, "change");
			await click("generate");
			await statusOf("gen-status", /^Generated 4 records/);
			const ds = generate({ fields, rows: 4, valid: false, seed: "e2e-seed" });
			await click("copy-all");
			assert.match(await statusOf("gen-status", /^Copied all 4 records/), /as /);
			assert.equal(await clipboard(), lf(serialize(ds, format)), `Copy all ${format}`);
		}
		const ds = generate({ fields, rows: 4, valid: false, seed: "e2e-seed" });
		// One value, then one row (in the selected format: ndjson).
		await js("document.querySelector('#records button[data-row=\"2\"][data-col=\"5\"]').click()");
		assert.match(await statusOf("gen-status", /from record 3/), new RegExp(`^Copied ${ds.fields[5].label} from record 3\\.$`));
		assert.equal(await clipboard(), ds.records[2][5]);
		await js("document.querySelector('#records .rec-head button[data-row=\"1\"]').click()");
		assert.equal(await clipboard(), JSON.stringify(Object.fromEntries(ds.fields.map((f, i) => [f.id, ds.records[1][i]]))));
		// Displayed values carry the near-miss marker.
		assert.ok(await js("document.querySelectorAll('#records .val.miss').length > 0"));
		assert.match(await text("results-meta"), /Near-miss · seed e2e-seed/);
	});

	test("downloads match the shared serializers", async () => {
		await openPanel();
		const fields = inRegistryOrder(PRESETS.pci.fields);
		await chooseFields(fields);
		await setValue("rows", "6");
		await setValue("seed", "dl");
		await js("document.querySelector('input[name=mode][value=valid]').click()");
		for (const format of ["csv", "xlsx", "pdf"] as const) {
			await setValue("format", format, "change");
			await click("generate");
			await statusOf("gen-status");
			const done = new Promise<string>((resolveDone, reject) => {
				const off = browser.on("Browser.downloadProgress", (p) => {
					if (p.state === "completed") {
						off();
						resolveDone(p.guid);
					} else if (p.state === "canceled") reject(new Error("download canceled"));
				});
			});
			await click("download");
			const guid = await done;
			assert.match(await statusOf("gen-status"), new RegExp(`^Download started: dlp-test-data\\.${format}\\.$`));
			const got = new Uint8Array(readFileSync(join(downloads, guid)));
			const expected = await render(generate({ fields, rows: 6, valid: true, seed: "dl" }), format);
			if (typeof expected === "string") assert.equal(new TextDecoder().decode(got), expected, format);
			else assert.deepEqual(got, expected, format);
			const copyDisabled = await js("document.getElementById('copy-all').disabled");
			assert.equal(copyDisabled, format !== "csv", `Copy all ${format === "csv" ? "enabled" : "disabled"} for ${format}`);
		}
	});

	test("Quick Copy generates one value from the chosen field and mode", async () => {
		await openPanel();
		await click("tab-quick");
		await setValue("quick-field", "cc_number", "change");
		await js("document.querySelector('input[name=quick-mode][value=invalid]').click()");
		assert.equal(await js("document.getElementById('quick-result').hidden"), true, "nothing generated until asked");
		await click("quick-generate");
		assert.match(await statusOf("quick-status"), /^Generated near-miss Credit card number/);
		const meta = await text("quick-meta");
		const seed = meta.split("seed ")[1];
		assert.match(meta, /^Credit card number · Near-miss · seed /);
		const { quickValue } = await import("../src/output.ts");
		const { luhnValid } = await import("../../src/lib/checksums.ts");
		const value = await text("quick-value");
		assert.equal(value, quickValue("cc_number", false, seed).value);
		assert.equal(luhnValid(value), false);
		await js("navigator.clipboard.writeText('untouched')");
		assert.equal(await clipboard(), "untouched", "generating does not copy");
		await click("quick-copy");
		assert.equal(await clipboard(), value);
		assert.match(await statusOf("quick-status"), /^Copied Credit card number \(near-miss\)\.$/);
		// A field without a checksum rule has no near-miss option.
		await setValue("quick-field", "full_name", "change");
		assert.equal(await js("document.querySelector('input[name=quick-mode][value=invalid]').disabled"), true);
		assert.match(await text("quick-mode-note"), /no near-miss form/);
	});

	test("favorites are editable, persist, and never store values", async () => {
		await click("reset-prefs");
		await openPanel();
		await click("tab-favorites");
		assert.equal(await js("document.getElementById('fav-empty').hidden"), false, "starts empty");
		await click("fav-starter");
		const order = () => js("[...document.querySelectorAll('#fav-list li')].map((li) => li.dataset.id)");
		assert.deepEqual(await order(), ["ssn", "cc_number", "email", "github_pat", "jwt"]);
		await setValue("fav-add-field", "entra_client_secret", "change");
		await click("fav-add");
		await js("document.querySelector('#fav-list li[data-id=jwt] button[data-action=up]').click()");
		await js("document.querySelector('#fav-list li[data-id=email] button[data-action=remove]').click()");
		assert.deepEqual(await order(), ["ssn", "cc_number", "jwt", "github_pat", "entra_client_secret"]);
		await js("document.querySelector('#fav-list li[data-id=jwt] button[data-action=generate]').click()");
		const jwt = await js("document.querySelector('#fav-list li[data-id=jwt] .val').textContent");
		assert.match(jwt, /^eyJ/);
		await js("document.querySelector('#fav-list li[data-id=jwt] button[data-action=copy]').click()");
		assert.equal(await clipboard(), jwt);
		// Pinning from Quick copy shows up too.
		await click("tab-quick");
		await setValue("quick-field", "azure_devops_pat", "change");
		await click("quick-pin");
		assert.equal(await js("document.getElementById('quick-pin').getAttribute('aria-pressed')"), "true");
		await saved();

		const stored = await js("chrome.storage.local.get(null)");
		assert.deepEqual(Object.keys(stored), ["prefs"]);
		assert.ok(!JSON.stringify(stored).includes(jwt), "generated value not stored");
		await openPanel();
		assert.equal(await js("document.getElementById('tab-quick').getAttribute('aria-selected')"), "true", "last tab restored");
		await click("tab-favorites");
		assert.deepEqual(await order(), ["ssn", "cc_number", "jwt", "github_pat", "entra_client_secret", "azure_devops_pat"]);
		assert.equal(await js("document.querySelector('#fav-list li[data-id=jwt] .val').textContent"), "No value yet", "values are not restored");
	});

	test("corrupted or outdated preferences are repaired", async () => {
		await saved();
		await js(`chrome.storage.local.set({ prefs: { version: 0, fields: ["removed_field", "ssn"], rows: "many", format: "html", favorites: ["gone", "jwt"], tab: 7 } })`);
		await openPanel();
		assert.match(await statusOf("foot-status"), /out of date and have been reset/);
		assert.deepEqual(await js("[...document.querySelectorAll('input[name=field]:checked')].map((b) => b.value)"), ["ssn"]);
		assert.equal(await js("document.getElementById('rows').value"), "10");
		assert.equal(await js("document.getElementById('format').value"), "txt");
		await click("generate");
		assert.match(await statusOf("gen-status"), /^Generated 10 records/);
		await saved();
		await js(`chrome.storage.local.set({ prefs: "not an object" })`);
		await openPanel();
		assert.equal(await js("document.querySelectorAll('input[name=field]:checked').length"), PRESETS.pii.fields.length);
		await click("reset-prefs");
		assert.match(await statusOf("foot-status"), /reset to the defaults/);
		await saved();
		const after = await js("chrome.storage.local.get(null)");
		assert.deepEqual(Object.keys(after), ["prefs"]);
		assert.deepEqual(after.prefs.fields, [...PRESETS.pii.fields], "defaults after reset");
		assert.deepEqual(after.prefs.favorites, []);
	});

	test("works offline and leaves other pages alone", async () => {
		const other = await browser.newPage("data:text/html,<form><input name=card value=keep></form><p id=p>original</p>");
		const before = await other.eval("document.documentElement.outerHTML");
		await page.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
		await openPanel();
		await chooseFields(PRESETS.secrets.fields);
		await click("generate");
		assert.match(await statusOf("gen-status"), /^Generated/);
		await page.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
		assert.equal(await other.eval("document.documentElement.outerHTML"), before, "other page unchanged");
		const { targetInfos } = await browser.send("Target.getTargets");
		const extTargets = targetInfos.filter((t: { url: string }) => t.url.startsWith(`chrome-extension://${extId}`)).map((t: { type: string }) => t.type);
		assert.ok(!extTargets.includes("iframe"), "no frames injected into pages");
	});

	test("no network requests, CSP violations or errors during the run", () => {
		const remote = requests.filter((u) => !u.startsWith(`chrome-extension://${extId}/`) && !u.startsWith("blob:") && !u.startsWith("data:"));
		assert.deepEqual(remote, [], "every request stays inside the extension package");
		assert.deepEqual(problems, []);
	});
});
