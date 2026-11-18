// Render assets/icon.svg to the PNG sizes Chrome needs (16, 32, 48, 128).
// Run after changing the SVG: npm run ext:icons. The PNGs are committed.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Browser, findChrome } from "./cdp.ts";

const root = resolve(import.meta.dirname, "..");
const svg = readFileSync(resolve(root, "assets/icon.svg"));
const chrome = findChrome();
if (!chrome) throw new Error("Chrome not found. Set CHROME_PATH to render icons.");

const browser = await Browser.launch(chrome);
try {
	const page = await browser.newPage();
	await page.send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
	for (const size of [16, 32, 48, 128]) {
		await page.setViewport(size, size);
		const html = `<!doctype html><style>html,body{margin:0;background:transparent}img{display:block}</style><img src="data:image/svg+xml;base64,${svg.toString("base64")}" width="${size}" height="${size}">`;
		await page.goto(`data:text/html;base64,${Buffer.from(html).toString("base64")}`);
		const { data } = await page.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: size, height: size, scale: 1 } });
		writeFileSync(resolve(root, `public/icons/icon-${size}.png`), Buffer.from(data, "base64"));
		console.log(`icons/icon-${size}.png`);
	}
} finally {
	await browser.close();
}
