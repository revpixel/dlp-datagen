// Zip extension/dist into a Chrome Web Store upload:
// extension/release/dlp-data-generator-<version>.zip
// Uses the repository's own deterministic ZIP writer (src/lib/zip.ts), so the
// same build always produces byte-identical archives.
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { zip } from "../../src/lib/zip.ts";

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "dist");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string };

function files(dir: string): string[] {
	return readdirSync(dir)
		.flatMap((name) => {
			const path = join(dir, name);
			return statSync(path).isDirectory() ? files(path) : [path];
		})
		.sort();
}

const manifest = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8")) as { version: string };
if (manifest.version !== version) {
	throw new Error(`manifest.json version ${manifest.version} doesn't match package.json ${version}`);
}

const entries = files(dist).map((path) => ({ name: relative(dist, path).replaceAll("\\", "/"), data: new Uint8Array(readFileSync(path)) }));
const out = join(root, "release", `dlp-data-generator-${version}.zip`);
mkdirSync(join(root, "release"), { recursive: true });
writeFileSync(out, await zip(entries));
console.log(`${relative(process.cwd(), out)} (${entries.length} files, ${statSync(out).size.toLocaleString()} bytes)`);
