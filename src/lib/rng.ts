// Small seeded PRNG (mulberry32) so the same seed always yields the same data.

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
export const ALNUM = UPPER + LOWER + DIGITS;
export const CHARSETS = { UPPER, LOWER, DIGITS, ALNUM };

/** Hash an arbitrary string seed into a 32-bit integer (FNV-1a). */
export function hashSeed(seed: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

export function randomSeed(): string {
	const buf = new Uint32Array(2);
	crypto.getRandomValues(buf);
	return buf[0].toString(36) + buf[1].toString(36);
}

export class Rng {
	private state: number;

	constructor(seed: string | number) {
		this.state = typeof seed === "number" ? seed >>> 0 : hashSeed(seed);
	}

	/** Float in [0, 1). */
	next(): number {
		this.state = (this.state + 0x6d2b79f5) >>> 0;
		let t = this.state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	/** Integer in [min, max] inclusive. */
	int(min: number, max: number): number {
		return min + Math.floor(this.next() * (max - min + 1));
	}

	pick<T>(items: readonly T[]): T {
		return items[Math.floor(this.next() * items.length)];
	}

	chance(p: number): boolean {
		return this.next() < p;
	}

	chars(n: number, charset: string): string {
		let out = "";
		for (let i = 0; i < n; i++) out += charset[Math.floor(this.next() * charset.length)];
		return out;
	}

	digits(n: number): string {
		return this.chars(n, DIGITS);
	}

	/** Zero-padded integer in [min, max]. */
	padded(min: number, max: number, width: number): string {
		return String(this.int(min, max)).padStart(width, "0");
	}
}
