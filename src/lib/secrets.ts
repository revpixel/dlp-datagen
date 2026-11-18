// Builders for Microsoft "identifiable" secrets: keys that carry a fixed
// signature and a Marvin32 checksum, so scanners can confirm a match without
// calling the service. Ported from Microsoft's open-source scanner,
// microsoft/security-utilities (IdentifiableSecrets.cs, Marvin.cs, Base62.cs).
//
// The random parts come from the seeded Rng, so every key is synthetic: it
// passes the format and checksum checks but was never issued by Azure.
import type { Rng } from "./rng.ts";

export const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** A 64-bit Marvin seed as [low 32 bits, high 32 bits]. */
export type Seed64 = readonly [number, number];

/** "Default0": Azure Storage keys and the CASK (Azure DevOps PAT) format. */
export const SEED_DEFAULT0: Seed64 = [0x756c7430, 0x44656661];
/** "Manage00": Azure Service Bus / Event Hubs manage keys. */
export const SEED_MANAGE00: Seed64 = [0x67653030, 0x4d616e61];

// ---------- encodings ----------

export function base64(bytes: Uint8Array, url = false): string {
	let out = "";
	for (let i = 0; i < bytes.length; i += 3) {
		const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
		const chars = [n >>> 18, (n >>> 12) & 63, (n >>> 6) & 63, n & 63].map((c) => BASE64[c]);
		const left = bytes.length - i;
		out += left >= 3 ? chars.join("") : left === 2 ? chars.slice(0, 3).join("") + "=" : chars.slice(0, 2).join("") + "==";
	}
	return url ? out.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : out;
}

/** Decode standard or URL-safe base64 (padding optional). Throws on bad characters. */
export function fromBase64(text: string): Uint8Array {
	const s = text.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
	const out: number[] = [];
	let bits = 0;
	let acc = 0;
	for (const ch of s) {
		const v = BASE64.indexOf(ch);
		if (v < 0) throw new Error(`invalid base64 character ${ch}`);
		acc = (acc << 6) | v;
		bits += 6;
		if (bits >= 8) {
			bits -= 8;
			out.push((acc >>> bits) & 0xff);
		}
	}
	return new Uint8Array(out);
}

/** Base62 of a byte array read as a big-endian number, keeping leading zero bytes (Base62.cs). */
export function toBase62(bytes: Uint8Array): string {
	let source = [...bytes];
	const leadingZeros = Math.min(source.findIndex((b) => b !== 0) === -1 ? source.length : source.findIndex((b) => b !== 0), source.length - 1);
	const digits: number[] = [];
	while (source.length > 0) {
		const quotient: number[] = [];
		let remainder = 0;
		for (const d of source) {
			const acc = d + remainder * 256;
			const q = Math.floor(acc / 62);
			remainder = acc % 62;
			if (quotient.length > 0 || q > 0) quotient.push(q);
		}
		digits.unshift(remainder);
		source = quotient;
	}
	return "0".repeat(leadingZeros) + digits.map((d) => BASE62[d]).join("");
}

// ---------- Marvin32 ----------

const rotl = (x: number, n: number) => ((x << n) | (x >>> (32 - n))) >>> 0;

/** Marvin32 hash as .NET computes it (System.Marvin / Marvin.ComputeHash32), returned as a signed int32. */
export function marvin32(data: Uint8Array, seed: Seed64, offset = 0, length = data.length - offset): number {
	const [p0, p1] = marvin(data, seed, offset, length);
	return (p1 ^ p0) | 0;
}

/** Marvin state after hashing: [p0, p1]. The 64-bit hash is (p1 << 32) | p0. */
export function marvin(data: Uint8Array, seed: Seed64, offset = 0, length = data.length - offset): [number, number] {
	let p0 = seed[0] >>> 0;
	let p1 = seed[1] >>> 0;
	const block = () => {
		p1 = (p1 ^ p0) >>> 0;
		p0 = rotl(p0, 20);
		p0 = (p0 + p1) >>> 0;
		p1 = rotl(p1, 9);
		p1 = (p1 ^ p0) >>> 0;
		p0 = rotl(p0, 27);
		p0 = (p0 + p1) >>> 0;
		p1 = rotl(p1, 19);
	};
	const u32 = (i: number) => (data[i] | (data[i + 1] << 8) | (data[i + 2] << 16) | (data[i + 3] << 24)) >>> 0;
	let i = offset;
	let count = length;
	while (count >= 4) {
		p0 = (p0 + u32(i)) >>> 0;
		block();
		i += 4;
		count -= 4;
	}
	let final: number;
	switch (count) {
		case 0:
			final = 0x80;
			break;
		case 1:
			final = 0x8000 | data[i];
			break;
		case 2:
			final = 0x800000 | data[i] | (data[i + 1] << 8);
			break;
		default:
			final = (0x80000000 | (data[i + 2] << 16) | data[i] | (data[i + 1] << 8)) >>> 0;
	}
	p0 = (p0 + final) >>> 0;
	block();
	block();
	return [p0, p1];
}

function int32LE(n: number): Uint8Array {
	return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
}

function randomBytes(rng: Rng, n: number): Uint8Array {
	const b = new Uint8Array(n);
	for (let i = 0; i < n; i++) b[i] = rng.int(0, 255);
	return b;
}

// ---------- identifiable keys (Azure Storage, Service Bus, ...) ----------

/**
 * A standard-base64 key of `length` random bytes whose encoding ends in the
 * 4-character `signature` followed by a Marvin32 checksum over everything
 * before it (IdentifiableSecrets.GenerateKeyWithAppendedSignatureAndChecksum).
 * With `valid` false, one checksum byte is changed so the check fails.
 */
export function identifiableKey(rng: Rng, length: number, signature: string, seed: Seed64, valid: boolean): string {
	const key = randomBytes(rng, length);
	const checksumOffset = length - 4;
	const signatureOffset = checksumOffset - 4;

	// Place the signature so it renders on a 6-bit boundary in the base64 text.
	const sig = fromBase64(signature);
	const padding = ((length - 7) * 8) % 6;
	const mask = padding === 2 ? 0xfcffffff : padding === 4 ? 0xf0ffffff : 0xffffffff;
	let word = ((key[signatureOffset] << 24) & mask) >>> 0;
	word = (word | (sig[0] << (16 + padding)) | (sig[1] << (8 + padding)) | (sig[2] << padding)) >>> 0;
	key.set([word >>> 24, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff], signatureOffset);

	key.set(int32LE(marvin32(key, seed, 0, checksumOffset)), checksumOffset);
	if (!valid) key[checksumOffset] ^= 1 + rng.int(0, 254);
	return base64(key);
}

/** True when the key's last 4 bytes are the Marvin32 checksum of the rest (IdentifiableSecrets.ValidateChecksum). */
export function identifiableChecksumValid(key: string, seed: Seed64): boolean {
	let bytes: Uint8Array;
	try {
		bytes = fromBase64(key);
	} catch {
		return false;
	}
	const expected = new DataView(bytes.buffer).getInt32(bytes.length - 4, true);
	return marvin32(bytes, seed, 0, bytes.length - 4) === expected;
}

// ---------- Common Annotated Security Key (Azure DevOps PAT) ----------

/** First 4 characters of the CASK checksum for an 80-character key body. */
export function caskChecksum(body80: string): string {
	return toBase62(int32LE(marvin32(fromBase64(body80), SEED_DEFAULT0))).padEnd(6, "0").slice(0, 4);
}

/**
 * An 84-character CASK key: 52 random base62 characters, the JQQJ99
 * signature, allocation year and month, 12 platform characters, 4 provider
 * characters, the 4-character provider signature and a 4-character checksum
 * (IdentifiableSecrets.GenerateCommonAnnotatedTestKey, short form).
 */
export function caskKey(rng: Rng, providerSignature: string, providerData: string, valid: boolean): string {
	const year = BASE64[rng.int(0, 2)]; // A = 2024, B = 2025, C = 2026
	const month = BASE64[rng.int(0, 11)]; // A = January ... L = December
	const body = rng.chars(52, BASE62) + "JQQJ99" + year + month + rng.chars(12, BASE62) + providerData + providerSignature;
	let checksum = caskChecksum(body);
	if (!valid) {
		const last = BASE62[(BASE62.indexOf(checksum[3]) + rng.int(1, 61)) % 62];
		checksum = checksum.slice(0, 3) + last;
	}
	return body + checksum;
}

export function caskChecksumValid(key: string): boolean {
	return key.length === 84 && /^[0-9A-Za-z]{84}$/.test(key) && caskChecksum(key.slice(0, 80)) === key.slice(80);
}
