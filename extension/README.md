# DLP Data Generator for Chrome

Synthetic test data for DLP and security-control validation.

A Chrome extension that keeps the [DLP Test Data Generator](https://dlp.cyberdynenetwork.com) open in Chrome's side panel while you work in other tabs. Generate a value or a few records, copy them, and paste them into whatever form, chat, upload or editor you're testing. The panel stays open as you switch tabs.

It runs the same generator as the web app and API, bundled into the extension. Everything is generated locally, works offline, and nothing is sent anywhere.

> Version 0.1.0 (MVP). Not yet published to the Chrome Web Store: [load it unpacked](#load-the-unpacked-extension) for now.

## What it does

| View | For |
|---|---|
| **Generate** | Choose a preset or individual fields, valid or near-miss mode, 1–500 rows, an optional seed and a format. Copy any value, any row, or the whole output, or download it as a file. |
| **Quick copy** | One value for one field, in valid or near-miss form, ready to copy. Shows which field, mode and seed produced it. |
| **Favorites** | Fields you pin for one-click values. Reorder or remove them from the keyboard or mouse. Optionally start from a small starter set (SSN, credit card number, email, GitHub token, JWT). |

Other details:

- **Every field and preset:** all 54 fields, the 7 presets, and their categories, labels, API ids and checksum badges, read from the shared registry. Fields added there show up here automatically.
- **Valid and near-miss:** valid values pass their checksum or structure rule, so DLP rules should flag them. Near-misses look right but fail it, for false-positive testing. Fields without a rule have no near-miss form, and the panel says so.
- **Deterministic:** the same seed, fields, row count and mode give exactly the same data as the web app and the API.
- **Nothing copied by surprise:** values reach the clipboard only when you press a Copy button. Generating never copies.
- **Open full generator:** a link in the header (and the footer) opens the web app for bigger jobs, the API command builder and the documentation.

## Output formats

| Format | Copy | Download |
|---|---|---|
| Labeled text (`Label: value` records) | ✓ | `.txt` |
| CSV (optional header row) | ✓ | `.csv` |
| JSON | ✓ | `.json` |
| JSON Lines | ✓ | `.jsonl` |
| Excel | | `.xlsx` |
| Word | | `.docx` |
| PDF | | `.pdf` |

All seven use the project's own serializers in `src/lib`, so a file from the extension is byte-identical to the web app's and the API's for the same request. The document formats need no extra code or permissions in the extension, so they're included as download-only. You can still copy individual values and rows from document-format output: a copied row is labeled text.

**Copy row** uses the selected text format: one CSV line, a JSON object, a JSON Lines line, or `Label: value` lines.

### Limits

The panel generates **up to 500 rows**. Generation itself takes milliseconds, but the panel is for quick copy-and-paste, and at 500 rows a CSV of every field is already about 1 MB. For more, use the [full generator](https://dlp.cyberdynenetwork.com) (100,000 rows) or the [API](../docs/api.md) (10,000 per request).

Only the first 20 records are shown as copyable cards. **Copy all** and **Download** always include every row, and the formatted preview shows up to 40,000 characters.

## Privacy and permissions

See [PRIVACY.md](PRIVACY.md). In short:

| Permission | Why |
|---|---|
| `sidePanel` | Shows the generator in Chrome's side panel and makes the toolbar button open it. |
| `storage` | Saves your preferences (below) in `chrome.storage.local` on this device. |

That's all. The extension has no host permissions, content scripts, `tabs`, `activeTab`, `scripting`, `downloads`, `clipboardRead` or `clipboardWrite` permission:

- **Copying** uses the web Clipboard API (`navigator.clipboard.writeText`) from your click, which needs no extension permission. It only ever writes to the clipboard and never reads it.
- **Downloads** are ordinary links to an in-memory file (`<a download>`), which need no `downloads` permission.
- **The service worker** only sets the toolbar button to open the panel. It has no tab, page, message or network listeners.
- **The extension's content security policy** allows only its own packaged files and sets `connect-src 'none'`, so the panel can't make network requests even by mistake. Links to the website and GitHub open as ordinary new tabs when you click them.

### What's saved

Only lightweight preferences, in `chrome.storage.local` under one `prefs` key:

- the Generate view's selected fields, mode, format, row count and CSV header setting;
- which categories are expanded and which view was open last;
- the Quick copy field and mode;
- your favorites (field ids, in your order) and their mode.

Generated values, datasets, seeds and history are never saved: they're gone when the panel closes. Preferences are read back defensively: corrupted values, fields that a later version removed, and unknown formats fall back to the defaults, and the panel tells you if it had to repair anything. **Reset saved preferences** in the footer clears everything.

Preferences use `storage.local`, not `storage.sync`, so they aren't copied to your Google account.

## Architecture

The extension lives in this repository so it can share the generator without a copy that could drift. It's a separate package with its own manifest, entry points, build, tests, version and release ZIP.

```
src/lib/                  shared core (environment-neutral; no DOM, Worker or extension APIs)
  fields.ts               field registry, presets, inRegistryOrder()
  generate.ts             generate(), text serializers, render()
  documents.ts, zip.ts    XLSX, DOCX and PDF writers
  categories.ts           category icons and colour tokens (pure data)
  checksums.ts, secrets.ts, rng.ts, data.ts
src/web/, index.html      web app        ─┐
src/api.ts, src/index.ts  Worker API      ├─ all import src/lib
extension/                Chrome extension ─┘
  public/manifest.json    Manifest V3
  public/icons/           PNG icons (rendered from assets/icon.svg)
  sidepanel.html          the panel
  src/sidepanel.ts        panel UI (DOM, chrome.storage)
  src/catalog.ts          field and preset discovery from the registry
  src/output.ts           extension limits, generateOutput(), copy formats, Quick Copy
  src/prefs.ts            preference schema, sanitizing and storage
  src/clipboard.ts        write-only copy
  src/background.ts       service worker (opens the panel from the toolbar)
  scripts/                package.ts (store ZIP), icons.ts, cdp.ts (headless Chrome driver)
  test/                   unit, build-audit and end-to-end tests
```

Only `extension/src` uses `chrome.*` APIs. The shared core stays free of them, and the web app doesn't depend on anything in `extension/`. The shared-core changes made for the extension were small and behaviour-preserving:

- `inRegistryOrder()` moved from the web UI into `src/lib/fields.ts`, so both UIs send fields to the generator in the same order.
- The category icons and colour tokens moved into `src/lib/categories.ts`.

## Build and test

From the repository root, after `npm install`:

```bash
npm run ext:build     # build the unpacked extension into extension/dist/
npm run ext:test      # build, then run all extension tests
npm run ext:package   # build, write extension/release/dlp-data-generator-<version>.zip, verify it
npm run ext:icons     # re-render the PNG icons after editing assets/icon.svg
npm test              # whole repo: web/API tests plus extension unit tests
npm run typecheck     # Worker, web app and extension
```

`npm run build` and `npm run deploy` still build and deploy only the website and API.

### Tests

| File | Covers |
|---|---|
| `test/core.test.ts` | Same output as the API, byte for byte, for every text format, mode and several seeds; document formats identical to the shared serializers; registry discovery; seeded determinism; valid and near-miss checksums; Quick Copy; row-count validation; copy formats; safe error messages |
| `test/prefs.test.ts` | Defaults, corrupted and outdated preferences, removed and renamed fields, persistence, no generated values in storage, storage failures, reset |
| `test/build.test.ts` | Manifest validity, exact permissions, CSP, no remote code or network APIs in the bundle, the shared generator present in the bundle, and the store ZIP matching the build |
| `test/e2e.test.ts` | The real unpacked extension in headless Chrome: side-panel behaviour, every field and preset present, no sideways scrolling at 280–420 px, a full keyboard-only run with visible focus, live-region announcements, row validation, copy and download output checked against the shared generator, Quick Copy, favorites persistence, preference repair, offline use, other pages left untouched, and no network requests, CSP violations or errors |

The build and end-to-end tests skip themselves if there's no build. The end-to-end tests also skip if there's no Chrome or Chromium browser. They look for Chrome first, then Edge or Chromium; set `CHROME_PATH` to choose one. They load the extension with the DevTools Protocol's `Extensions.loadUnpacked` over `--remote-debugging-pipe`, so they need no test framework or dependencies.

## Load the unpacked extension

1. Run `npm run ext:build`.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose the `extension/dist` folder.
4. Pin **DLP Data Generator** from the extensions menu (the puzzle piece), then click its toolbar button to open the side panel.

After rebuilding, click the reload icon on the extension's card. Requires Chrome 116 or later.

## Package for the Chrome Web Store

`npm run ext:package` writes `extension/release/dlp-data-generator-<version>.zip`, with `manifest.json` at the root of the archive. The ZIP writer is deterministic, so the same build always produces the same archive.

To release a version:

1. Bump `version` in both `extension/package.json` and `extension/public/manifest.json`. A test fails if they differ.
2. Push a tag `extension-v<version>`. The **Extension release** workflow (`.github/workflows/extension-release.yml`) tests, packages and attaches the ZIP to a GitHub release. CI also uploads the ZIP as an artifact on every push and pull request.
3. Upload the ZIP in the Chrome Web Store developer dashboard. Publishing is a manual step; nothing in this repository publishes to the store.

For the store listing:

- **Single purpose:** generate synthetic test data for DLP and security-control testing.
- **Permission justifications:** use the table [above](#privacy-and-permissions).
- **Data use:** no user data collected (see [PRIVACY.md](PRIVACY.md)).

## Known limitations (MVP)

- **Chrome only:** Chrome 116 or later. It isn't packaged for Firefox or Edge's add-on store, though it should load unpacked in other Chromium browsers that support the side panel API.
- **Up to 500 rows per generation.** Use the web app or the API for more.
- **Manual copy and paste:** no form filling, page scanning, context-menu entries or keyboard shortcuts by design. The extension never touches the pages you test.
- **No history:** a value is gone when the panel closes, unless you regenerate it from its seed.
- **Line endings:** copied text uses `\n` line endings, except CSV, which uses `\r\n`. Your operating system's clipboard may convert them (Windows uses `\r\n`).
- **Not on the Chrome Web Store yet.**

## Relationship to the web app

| | Extension | Web app | API |
|---|---|---|---|
| Runs in | Chrome side panel, offline | Browser tab | Cloudflare Worker |
| Generator | Shared `src/lib` | Shared `src/lib` | Shared `src/lib` |
| Max rows | 500 | 100,000 (10,000 DOCX/PDF) | 10,000 (2,000 documents) |
| Strengths | Stays open beside your work; per-value copy; Quick Copy; favorites | Large files, table preview, copy-as-curl, full documentation | Scripts and pipelines |

## Issues and feature requests

Use the repository's [issue forms](https://github.com/revpixel/dlp-datagen/issues/new/choose): **Report an issue** and **Request a feature** links are also in the panel's footer. Say that it's about the Chrome extension and include the extension version (shown in the footer). Never include real personal data or real credentials.
