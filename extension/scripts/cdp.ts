// Tiny Chrome DevTools Protocol client over --remote-debugging-pipe, with no
// dependencies. Used to render the icons and to run the end-to-end tests
// against the real unpacked extension (Extensions.loadUnpacked needs the pipe).
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Readable, Writable } from "node:stream";

/** Chrome first; other Chromium browsers (Edge, Chromium) as fallbacks. */
export function findChrome(): string | null {
	const candidates = [
		process.env.CHROME_PATH,
		"C:/Program Files/Google/Chrome/Application/chrome.exe",
		"C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
		process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Google/Chrome/Application/chrome.exe"),
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		"/usr/bin/google-chrome",
		"/usr/bin/google-chrome-stable",
		"/usr/bin/chromium",
		"/usr/bin/chromium-browser",
		// Any current Chromium-based browser speaks the same protocol.
		"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
		"C:/Program Files/Microsoft/Edge/Application/msedge.exe",
		"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
		"/usr/bin/microsoft-edge",
	];
	return candidates.find((p): p is string => !!p && existsSync(p)) ?? null;
}

type Listener = (params: any, sessionId?: string) => void;

export class Browser {
	private nextId = 1;
	private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; method: string }>();
	private listeners = new Map<string, Set<Listener>>();
	private buffer = "";

	private proc: ChildProcess;
	private out: Writable;
	private profile: string;

	private constructor(proc: ChildProcess, out: Writable, profile: string) {
		this.proc = proc;
		this.out = out;
		this.profile = profile;
		const input = proc.stdio[4] as Readable;
		input.setEncoding("utf8");
		input.on("data", (chunk: string) => {
			this.buffer += chunk;
			let end: number;
			while ((end = this.buffer.indexOf("\0")) >= 0) {
				const msg = JSON.parse(this.buffer.slice(0, end));
				this.buffer = this.buffer.slice(end + 1);
				if (msg.id && this.pending.has(msg.id)) {
					const p = this.pending.get(msg.id)!;
					this.pending.delete(msg.id);
					if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
					else p.resolve(msg.result);
				} else if (msg.method) {
					for (const l of this.listeners.get(msg.method) ?? []) l(msg.params, msg.sessionId);
				}
			}
		});
	}

	static async launch(chromePath: string, extraArgs: string[] = []): Promise<Browser> {
		const profile = mkdtempSync(join(tmpdir(), "dlp-ext-chrome-"));
		const proc = spawn(
			chromePath,
			[
				"--headless=new",
				"--remote-debugging-pipe",
				"--enable-unsafe-extension-debugging",
				`--user-data-dir=${profile}`,
				"--no-first-run",
				"--no-default-browser-check",
				"--disable-sync",
				"--disable-background-networking",
				"--disable-component-update",
				"--hide-scrollbars",
				// GitHub-hosted Linux runners restrict the Chrome sandbox.
				...(process.platform === "linux" && process.env.CI ? ["--no-sandbox"] : []),
				...extraArgs,
				"about:blank",
			],
			{ stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] },
		);
		return new Browser(proc, proc.stdio[3] as Writable, profile);
	}

	send<T = any>(method: string, params: object = {}, sessionId?: string): Promise<T> {
		const id = this.nextId++;
		const msg = JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) });
		return new Promise<T>((resolve, reject) => {
			this.pending.set(id, { resolve, reject, method });
			this.out.write(msg + "\0");
		});
	}

	on(method: string, listener: Listener): () => void {
		if (!this.listeners.has(method)) this.listeners.set(method, new Set());
		this.listeners.get(method)!.add(listener);
		return () => this.listeners.get(method)!.delete(listener);
	}

	/** Open a page target and return a session bound to it. */
	async newPage(url = "about:blank"): Promise<Page> {
		const { targetId } = await this.send("Target.createTarget", { url: "about:blank" });
		const { sessionId } = await this.send("Target.attachToTarget", { targetId, flatten: true });
		const page = new Page(this, sessionId, targetId);
		await page.send("Page.enable");
		await page.send("Runtime.enable");
		if (url !== "about:blank") await page.goto(url);
		return page;
	}

	async close() {
		try {
			await Promise.race([this.send("Browser.close"), new Promise((r) => setTimeout(r, 3000))]);
		} catch {
			/* already gone */
		}
		this.proc.kill();
		await new Promise((r) => setTimeout(r, 300));
		try {
			rmSync(this.profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
		} catch {
			/* temp profile cleanup is best-effort */
		}
	}
}

export class Page {
	readonly browser: Browser;
	readonly sessionId: string;
	readonly targetId: string;

	constructor(browser: Browser, sessionId: string, targetId: string) {
		this.browser = browser;
		this.sessionId = sessionId;
		this.targetId = targetId;
	}

	send<T = any>(method: string, params: object = {}): Promise<T> {
		return this.browser.send<T>(method, params, this.sessionId);
	}

	on(method: string, listener: (params: any) => void): () => void {
		return this.browser.on(method, (p, s) => {
			if (s === this.sessionId) listener(p);
		});
	}

	async goto(url: string) {
		const loaded = new Promise<void>((resolve) => {
			const off = this.on("Page.loadEventFired", () => {
				off();
				resolve();
			});
		});
		await this.send("Page.navigate", { url });
		await loaded;
	}

	/** Evaluate an expression (awaiting promises) and return its JSON value. */
	async eval<T = any>(expression: string): Promise<T> {
		const r = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
		if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
		return r.result.value as T;
	}

	async waitFor(expression: string, timeout = 5000): Promise<any> {
		const start = Date.now();
		for (;;) {
			const v = await this.eval(expression);
			if (v) return v;
			if (Date.now() - start > timeout) throw new Error(`timed out waiting for: ${expression}`);
			await new Promise((r) => setTimeout(r, 50));
		}
	}

	async key(key: string, opts: { shift?: boolean } = {}) {
		const map: Record<string, { code: string; keyCode: number; text?: string }> = {
			Tab: { code: "Tab", keyCode: 9 },
			Enter: { code: "Enter", keyCode: 13, text: "\r" },
			" ": { code: "Space", keyCode: 32, text: " " },
			ArrowRight: { code: "ArrowRight", keyCode: 39 },
			ArrowLeft: { code: "ArrowLeft", keyCode: 37 },
			ArrowDown: { code: "ArrowDown", keyCode: 40 },
			ArrowUp: { code: "ArrowUp", keyCode: 38 },
			Home: { code: "Home", keyCode: 36 },
			End: { code: "End", keyCode: 35 },
			Escape: { code: "Escape", keyCode: 27 },
		};
		const k = map[key];
		if (!k) throw new Error(`unmapped key ${key}`);
		const base = { key, code: k.code, windowsVirtualKeyCode: k.keyCode, modifiers: opts.shift ? 8 : 0 };
		await this.send("Input.dispatchKeyEvent", { type: k.text ? "keyDown" : "rawKeyDown", ...base, ...(k.text ? { text: k.text } : {}) });
		await this.send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
	}

	async type(text: string) {
		await this.send("Input.insertText", { text });
	}

	async setViewport(width: number, height: number) {
		await this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
	}
}
