import assert from "node:assert/strict";
import { crc32 } from "../src/lib/zip.ts";

/** Read entries from a ZIP produced by our writer (deflate only). */
export async function inflateParts(bytes: Uint8Array): Promise<Map<string, string>> {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const eocd = bytes.length - 22;
	assert.equal(view.getUint32(eocd, true), 0x06054b50);
	const count = view.getUint16(eocd + 10, true);
	let p = view.getUint32(eocd + 16, true);
	const out = new Map<string, string>();
	for (let i = 0; i < count; i++) {
		assert.equal(view.getUint32(p, true), 0x02014b50);
		const crc = view.getUint32(p + 16, true);
		const compSize = view.getUint32(p + 20, true);
		const nameLen = view.getUint16(p + 28, true);
		const local = view.getUint32(p + 42, true);
		const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
		const localNameLen = view.getUint16(local + 26, true);
		const data = bytes.subarray(local + 30 + localNameLen, local + 30 + localNameLen + compSize);
		const raw = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
		assert.equal(crc32(raw), crc, `crc mismatch for ${name}`);
		out.set(name, new TextDecoder().decode(raw));
		p += 46 + nameLen;
	}
	return out;
}
