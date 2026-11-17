// Minimal ZIP writer (deflate via CompressionStream), enough for OOXML files.
// Works in browsers, Workers and Node without dependencies.

const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		t[n] = c >>> 0;
	}
	return t;
})();

export function crc32(data: Uint8Array): number {
	let c = 0xffffffff;
	for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream("deflate-raw"));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

export interface ZipEntry {
	name: string;
	data: string | Uint8Array;
}

// Fixed timestamp (1980-01-01 00:00) so a given seed always yields identical bytes.
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

export async function zip(entries: readonly ZipEntry[]): Promise<Uint8Array> {
	const enc = new TextEncoder();
	const locals: Uint8Array[] = [];
	const centrals: Uint8Array[] = [];
	let offset = 0;

	for (const e of entries) {
		const name = enc.encode(e.name);
		const raw = typeof e.data === "string" ? enc.encode(e.data) : e.data;
		const comp = await deflateRaw(raw);
		const crc = crc32(raw);

		const local = new Uint8Array(30 + name.length);
		const lv = new DataView(local.buffer);
		lv.setUint32(0, 0x04034b50, true);
		lv.setUint16(4, 20, true); // version needed
		lv.setUint16(6, 0x0800, true); // UTF-8 names
		lv.setUint16(8, 8, true); // deflate
		lv.setUint16(10, DOS_TIME, true);
		lv.setUint16(12, DOS_DATE, true);
		lv.setUint32(14, crc, true);
		lv.setUint32(18, comp.length, true);
		lv.setUint32(22, raw.length, true);
		lv.setUint16(26, name.length, true);
		local.set(name, 30);

		const central = new Uint8Array(46 + name.length);
		const cv = new DataView(central.buffer);
		cv.setUint32(0, 0x02014b50, true);
		cv.setUint16(4, 20, true); // version made by
		cv.setUint16(6, 20, true);
		cv.setUint16(8, 0x0800, true);
		cv.setUint16(10, 8, true);
		cv.setUint16(12, DOS_TIME, true);
		cv.setUint16(14, DOS_DATE, true);
		cv.setUint32(16, crc, true);
		cv.setUint32(20, comp.length, true);
		cv.setUint32(24, raw.length, true);
		cv.setUint16(28, name.length, true);
		cv.setUint32(42, offset, true);
		central.set(name, 46);

		locals.push(local, comp);
		centrals.push(central);
		offset += local.length + comp.length;
	}

	const cdSize = centrals.reduce((n, c) => n + c.length, 0);
	const end = new Uint8Array(22);
	const ev = new DataView(end.buffer);
	ev.setUint32(0, 0x06054b50, true);
	ev.setUint16(8, entries.length, true);
	ev.setUint16(10, entries.length, true);
	ev.setUint32(12, cdSize, true);
	ev.setUint32(16, offset, true);

	const parts = [...locals, ...centrals, end];
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let pos = 0;
	for (const p of parts) {
		out.set(p, pos);
		pos += p.length;
	}
	return out;
}
