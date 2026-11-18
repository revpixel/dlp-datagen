import { CATEGORIES, FIELDS, PRESETS } from "./lib/fields.ts";
import { EXTENSION, FORMATS, MIME, OptionsError, generate, isBinary, render, type Format } from "./lib/generate.ts";

export const MAX_API_ROWS = 10_000;
/** XLSX, DOCX and PDF cost more CPU to build, so they get a lower cap. */
export const MAX_API_DOCUMENT_ROWS = 2_000;

const CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
	"Access-Control-Expose-Headers": "X-DLP-Seed",
};

/**
 * Header values can't hold every character: the Headers constructor throws on
 * anything above U+00FF, and CR, LF and NUL are invalid. Tab and printable
 * ASCII seeds are sent as-is, exactly as before. Any other seed is sent as
 * UTF-8 percent-encoding, flagged by X-DLP-Seed-Encoding: percent.
 */
function seedHeaders(seed: string): Record<string, string> {
	if (/^[\t\x20-\x7e]*$/.test(seed)) return { "X-DLP-Seed": seed };
	return {
		"X-DLP-Seed": encodeURIComponent(seed),
		"X-DLP-Seed-Encoding": "percent",
		"Access-Control-Expose-Headers": "X-DLP-Seed, X-DLP-Seed-Encoding",
	};
}

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body, null, 2) + "\n", {
		status,
		headers: { "Content-Type": MIME.json, "Cache-Control": "no-store", ...CORS },
	});
}

async function generateResponse(p: URLSearchParams): Promise<Response> {
	const preset = p.get("preset");
	const fieldParam = p.get("fields");
	let fields: string[];
	if (fieldParam) fields = fieldParam.split(",").map((s) => s.trim()).filter(Boolean);
	else if (preset && Object.hasOwn(PRESETS, preset)) fields = [...PRESETS[preset].fields];
	else if (preset) return json({ error: `Unknown preset: ${preset}` }, 400);
	else fields = [...PRESETS.pii.fields];

	const rows = Number(p.get("rows") ?? "10");
	if (!Number.isInteger(rows) || rows < 1 || rows > MAX_API_ROWS) {
		return json({ error: `rows must be an integer from 1 to ${MAX_API_ROWS}` }, 400);
	}
	const format = (p.get("format") ?? "json") as Format;
	if (!FORMATS.includes(format)) return json({ error: `format must be one of ${FORMATS.join(", ")}` }, 400);
	if (isBinary(format) && rows > MAX_API_DOCUMENT_ROWS) {
		return json({ error: `rows must be at most ${MAX_API_DOCUMENT_ROWS} for ${format}` }, 400);
	}
	const validParam = p.get("valid");
	const valid = validParam === null || !["false", "0", "no"].includes(validParam.toLowerCase());
	const header = p.get("header") !== "false";

	try {
		const ds = generate({ fields, rows, valid, seed: p.get("seed") ?? undefined });
		const headers: Record<string, string> = {
			"Content-Type": MIME[format],
			"Cache-Control": "no-store",
			...CORS,
			...seedHeaders(ds.seed),
		};
		if (p.has("download") || isBinary(format)) {
			headers["Content-Disposition"] = `attachment; filename="dlp-test-data.${EXTENSION[format]}"`;
		}
		const body = await render(ds, format, header);
		return new Response(body as BodyInit, { headers });
	} catch (e) {
		if (e instanceof OptionsError) return json({ error: e.message }, 400);
		throw e;
	}
}

export async function handleApi(request: Request): Promise<Response> {
	const url = new URL(request.url);
	if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
	if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "Method not allowed" }, 405);

	switch (url.pathname) {
		case "/api/health":
			return json({ ok: true });
		case "/api/fields":
			return json({
				categories: CATEGORIES,
				fields: FIELDS.map(({ id, label, category, checksum, description }) => ({ id, label, category, checksum, description })),
				presets: PRESETS,
				formats: FORMATS,
				maxRows: MAX_API_ROWS,
				maxDocumentRows: MAX_API_DOCUMENT_ROWS,
			});
		case "/api/generate":
			return generateResponse(url.searchParams);
	}
	return json({ error: "Not found" }, 404);
}
