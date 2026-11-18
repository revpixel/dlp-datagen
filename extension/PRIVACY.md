# Privacy: DLP Data Generator for Chrome

**The extension generates synthetic data locally and doesn't collect, transmit or sell any data.**

- **Local generation.** All values are produced inside the extension by code bundled with it. It makes no network requests. Its content security policy sets `connect-src 'none'`, and it works offline.
- **Your pages stay private.** The extension has no host permissions and no content scripts. It doesn't read, inspect, change or inject anything into the pages you visit, and it doesn't see your tabs, browsing history, cookies or form contents.
- **Write-only clipboard.** It writes to the clipboard only when you press a Copy button, and it never reads the clipboard.
- **Downloads you start.** Files are created only when you press Download.
- **Only preferences are saved.** Selected fields, favorites, mode, format, row count and similar settings are kept in `chrome.storage.local` on your device. They aren't synced to your Google account. Generated values, datasets and history are never saved. **Reset saved preferences** in the panel footer deletes them, and so does removing the extension.
- **No tracking.** No analytics, telemetry, accounts or third-party services.

Links in the panel to the web app and to GitHub open in a normal browser tab when you click them. Those sites have their own policies.

Generated values are synthetic. Secrets and tokens are random values in real formats that authenticate to nothing. Valid-mode identifiers follow real checksums, so one could match a real number by chance. Use them only to test systems you're authorized to test.

Permissions: `sidePanel` (show the panel) and `storage` (save preferences). Questions or concerns: [open an issue](https://github.com/revpixel/dlp-datagen/issues/new/choose).
