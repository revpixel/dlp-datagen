// Build for the Chrome extension. It bundles the shared generator from
// ../src/lib into the package, so the extension runs with no network access.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = import.meta.dirname;
const { version } = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { version: string };

export default defineConfig({
	root,
	base: "./",
	publicDir: "public",
	define: { __APP_VERSION__: JSON.stringify(version) },
	build: {
		outDir: "dist",
		emptyOutDir: true,
		target: "chrome116",
		sourcemap: false,
		// Every asset ships as a file: the extension CSP allows no data: URLs.
		assetsInlineLimit: 0,
		// No inline preload helper or polyfill that would issue fetches.
		modulePreload: false,
		rolldownOptions: {
			input: {
				sidepanel: resolve(root, "sidepanel.html"),
				background: resolve(root, "src/background.ts"),
			},
			output: {
				entryFileNames: (chunk) => (chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js"),
			},
		},
	},
});
