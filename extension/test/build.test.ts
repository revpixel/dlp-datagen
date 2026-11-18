// Audits the built extension (extension/dist) and the store ZIP. Run
// `npm run ext:build` (or `npm run ext:test`, which builds first) beforehand;
// without a build these tests are skipped.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { test } from "node:test";
import { inflateEntries } from "../../test/zip-helper.ts";

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "dist");
const built = existsSync(join(dist, "manifest.json"));
const skip = built ? false : "extension not built (run npm run ext:build)";
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string };

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
}
function files(dir: string): string[] {
	return walk(dir)
		.map((p) => relative(dir, p).replaceAll("\\", "/"))
		.sort();
}
const read = (p: string) => readFileSync(join(dist, p), "utf8");
const manifest = () => JSON.parse(read("manifest.json"));

/** The only remote URLs allowed anywhere in the package: links the user clicks. */
const ALLOWED_LINKS = [/^https:\/\/dlp\.cyberdynenetwork\.com\/?$/, /^https:\/\/github\.com\/revpixel\/dlp-datagen\//];

test("manifest is a valid Manifest V3 side-panel extension", { skip }, () => {
	const m = manifest();
	assert.equal(m.manifest_version, 3);
	assert.equal(m.name, "DLP Data Generator");
	assert.equal(m.description, "Synthetic test data for DLP and security-control validation.");
	assert.ok(m.description.length <= 132, "store description limit");
	assert.match(m.version, /^\d+\.\d+\.\d+$/);
	assert.equal(m.version, pkg.version, "manifest and package.json versions match");
	assert.equal(m.minimum_chrome_version, "116", "chrome.sidePanel.setPanelBehavior");
	assert.equal(m.side_panel.default_path, "sidepanel.html");
	assert.ok(existsSync(join(dist, m.side_panel.default_path)));
	assert.deepEqual(m.background, { service_worker: "background.js", type: "module" });
	assert.ok(existsSync(join(dist, "background.js")));
	assert.ok(m.action, "toolbar action opens the panel");
	assert.equal(m.action.default_popup, undefined, "no popup: the side panel is the UI");
	for (const icons of [m.icons, m.action.default_icon]) {
		for (const [size, path] of Object.entries(icons as Record<string, string>)) {
			const png = readFileSync(join(dist, path));
			assert.equal(png.readUInt32BE(0), 0x89504e47, `${path} is a PNG`);
			assert.equal(png.readUInt32BE(16), Number(size), `${path} width`);
			assert.equal(png.readUInt32BE(20), Number(size), `${path} height`);
		}
	}
	assert.doesNotMatch(JSON.stringify(m), /microsoft|google|chrome web|aws|github/i, "no vendor names in branding");
});

test("permissions are exactly sidePanel and storage", { skip }, () => {
	const m = manifest();
	assert.deepEqual(m.permissions, ["sidePanel", "storage"]);
	for (const key of [
		"host_permissions",
		"optional_permissions",
		"optional_host_permissions",
		"content_scripts",
		"web_accessible_resources",
		"externally_connectable",
		"devtools_page",
		"chrome_url_overrides",
		"oauth2",
		"key",
		"update_url",
	]) {
		assert.equal(m[key], undefined, `manifest has no ${key}`);
	}
});

test("content security policy blocks remote code and all network access", { skip }, () => {
	const csp: string = manifest().content_security_policy.extension_pages;
	const directives = new Map(csp.split(";").map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
	assert.deepEqual(directives.get("script-src"), ["'self'"]);
	assert.deepEqual(directives.get("connect-src"), ["'none'"]);
	assert.deepEqual(directives.get("object-src"), ["'none'"]);
	assert.deepEqual(directives.get("default-src"), ["'self'"]);
	assert.doesNotMatch(csp, /unsafe-|https?:|data:|blob:|\*/);
});

test("all executable code is bundled; nothing loads from the network", { skip }, () => {
	const all = files(dist);
	const html = read("sidepanel.html");
	for (const [, src] of html.matchAll(/<script\b([^>]*)>/g)) assert.match(src, /src="\.\/assets\/[^"]+\.js"/, "scripts are local files");
	assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, "no inline scripts");
	assert.doesNotMatch(html, /\sstyle=|\son[a-z]+=/i, "no inline styles or handlers");
	for (const [, attr, url] of html.matchAll(/\b(src|href)="([^"]+)"/g)) {
		if (/^https?:/.test(url)) {
			assert.equal(attr, "href", `${url} only as a link`);
			assert.ok(ALLOWED_LINKS.some((re) => re.test(url)), `unexpected link ${url}`);
		} else {
			assert.ok(all.includes(url.replace(/^\.\//, "")), `${url} is packaged`);
		}
	}

	const js = all.filter((f) => f.endsWith(".js"));
	assert.ok(js.length >= 2);
	for (const f of js) {
		const code = read(f);
		for (const banned of [
			/\bfetch\(/,
			/XMLHttpRequest/,
			/\bWebSocket\b/,
			/sendBeacon/,
			/EventSource/,
			/importScripts/,
			/\beval\(/,
			/new Function\(/,
			/\bimport\(/,
			/chrome\.(tabs|scripting|downloads|webRequest|cookies|history|clipboardRead|contextMenus|identity)\b/,
			/navigator\.clipboard\.read/,
		]) {
			assert.doesNotMatch(code, banned, `${f} uses ${banned}`);
		}
		// URL strings that may appear: XML namespaces (SVG, OOXML) and synthetic
		// values the generator writes into data (example domains, SAS URL templates).
		const harmless = [/^http:\/\/www\.w3\.org\//, /^http:\/\/schemas\.openxmlformats\.org\//, /^https:\/\/[\w.-]*example\.(com|org|net)\b/, /^https:\/\/\$\{/];
		const urls = [...code.matchAll(/https?:\/\/[^\s"'`)]+/g)].map((m) => m[0]);
		assert.deepEqual(
			urls.filter((u) => !harmless.some((re) => re.test(u))),
			[],
			`${f} references no other URLs`,
		);
	}
	assert.doesNotMatch(read("background.js"), /\bimport\b/, "service worker is self-contained");
	assert.doesNotMatch(read("background.js"), /onMessage|onConnect|onUpdated|onActivated|webNavigation|tabs/, "service worker watches no tabs or messages");

	for (const f of all.filter((f) => f.endsWith(".css"))) {
		assert.doesNotMatch(read(f), /url\((?!["']?\.\/)/, `${f} loads only packaged files`);
		assert.doesNotMatch(read(f), /data:|https?:/, `${f} has no data: or remote URLs`);
	}
	assert.deepEqual(all.filter((f) => f.endsWith(".map")), [], "no source maps shipped");
});

test("the generator is bundled from the shared core", { skip }, () => {
	const bundle = files(dist)
		.filter((f) => f.endsWith(".js"))
		.map(read)
		.join("\n");
	// Strings that exist only in src/lib (registry descriptions, Marvin seeds, PDF writer).
	assert.match(bundle, /AAA-GG-SSSS; invalid mode uses area 000\/666\/9xx/);
	assert.match(bundle, /Cloud secrets & tokens/);
	assert.match(bundle, /%PDF-1\.4|%PDF-/);
});

const zipPath = join(root, "release", `dlp-data-generator-${pkg.version}.zip`);
const zipSkip = skip || (!existsSync(zipPath) ? "no release ZIP (run npm run ext:package)" : statSync(zipPath).mtimeMs < statSync(join(dist, "manifest.json")).mtimeMs ? "release ZIP is older than the build (run npm run ext:package)" : false);
test("store ZIP contains exactly the built extension", { skip: zipSkip }, async () => {
	const entries = await inflateEntries(new Uint8Array(readFileSync(zipPath)));
	assert.deepEqual([...entries.keys()].sort(), files(dist));
	assert.ok(entries.has("manifest.json"), "manifest at the ZIP root");
	for (const [name, bytes] of entries) assert.deepEqual(bytes, new Uint8Array(readFileSync(join(dist, name))), name);
});
