// Minimal typings for the few extension APIs this package uses, so the build
// needs no @types/chrome dependency. Extend only when a new API is adopted.

interface ChromeStorageArea {
	get(keys: string | string[]): Promise<Record<string, unknown>>;
	set(items: Record<string, unknown>): Promise<void>;
	remove(keys: string | string[]): Promise<void>;
}

interface ChromeApi {
	storage?: { local?: ChromeStorageArea };
	sidePanel?: {
		setPanelBehavior(behavior: { openPanelOnActionClick: boolean }): Promise<void>;
	};
	runtime?: {
		onInstalled: { addListener(cb: () => void): void };
		onStartup: { addListener(cb: () => void): void };
		getManifest(): { version: string };
	};
}

// eslint-disable-next-line no-var
declare var chrome: ChromeApi | undefined;

// Vite bundles imported stylesheets.
declare module "*.css";
