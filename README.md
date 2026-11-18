# DLP Test Data Generator

**Live:** https://dlp.cyberdynenetwork.com

Synthetic PII, PCI, PHI and secrets for testing data loss prevention (DLP) rules in Microsoft Purview, Netskope, Zscaler, Symantec, Forcepoint, Google Cloud DLP and similar tools.

Values that have check digits or structure rules (card numbers, SSNs, IBANs, ABA routing numbers, NPIs and more) pass the same validation DLP engines run, so they trigger real detections. **Invalid mode** produces near-misses that look right but fail validation, for checking false positives.

- **Web UI:** pick fields, row count and format, then preview, download or copy. Data is generated in your browser; nothing is sent to a server.
- **API:** the same generator on Cloudflare Workers, for scripts, pipelines and automated tests. No key or sign-up.
- **7 formats:** CSV, JSON, JSON Lines, TXT, Excel (.xlsx), Word (.docx) and PDF. DLP engines often inspect each file type differently, so test the ones your policies cover.
- **45 fields, 6 presets** across identity, contact, government ID, financial, health, secrets and network data.
- **Repeatable:** pass a seed to get identical output every time, down to the bytes of the XLSX, DOCX and PDF files.

## Documentation

| Document | Covers |
|---|---|
| [Field reference](docs/fields.md) | Every field: format, example, validation rule and what invalid mode changes. Presets, row consistency and data sources. |
| [API reference](docs/api.md) | Endpoints, every parameter, response headers, errors, limits, CORS, determinism, and examples in curl, PowerShell, Python and JavaScript. |
| [Output formats](docs/formats.md) | Exactly what each of the 7 formats contains and how it's laid out. |

## Quick start

```bash
# 10 rows of the default PII preset as JSON
curl "https://dlp.cyberdynenetwork.com/api/generate"

# 100 card records as CSV
curl "https://dlp.cyberdynenetwork.com/api/generate?preset=pci&rows=100&format=csv"

# Pick fields, make them near-misses, fix the seed
curl "https://dlp.cyberdynenetwork.com/api/generate?fields=full_name,ssn,cc_number&rows=50&valid=false&seed=run-42&format=csv"

# A PHI spreadsheet (document formats always download; save with -o)
curl "https://dlp.cyberdynenetwork.com/api/generate?preset=phi&rows=500&format=xlsx" -o phi.xlsx

# Everything the API can generate
curl "https://dlp.cyberdynenetwork.com/api/fields"
```

Example output (`?preset=pci&rows=2&format=csv&seed=demo`):

```csv
full_name,cc_number,cc_brand,cc_expiry,cc_cvv,zip
Casey Davis,4428091845683031,Visa,09/28,739,78756
Jordan Kowalski,5308381957542378,Mastercard,07/28,148,14224
```

## Fields

✓ = has a checksum or structure rule that invalid mode breaks. The [field reference](docs/fields.md) has the format, an example and the rule for each one.

| Category | Fields (API id) |
|---|---|
| Identity | `full_name`, `first_name`, `last_name`, `dob`, `gender` |
| Contact | `email`, `phone`, `street`, `city`, `state`, `zip` |
| Government ID | `ssn` ✓, `itin` ✓, `ein` ✓, `drivers_license`, `passport_us`, `uk_nino` ✓, `ca_sin` ✓ |
| Financial | `cc_number` ✓, `cc_brand`, `cc_expiry`, `cc_cvv`, `iban` ✓, `aba_routing` ✓, `bank_account`, `swift_bic` |
| Health | `mrn`, `npi` ✓, `dea` ✓, `icd10`, `diagnosis`, `medication`, `insurer`, `member_id`, `mbi` ✓ |
| Secrets | `aws_access_key_id`, `aws_secret_key`, `github_pat`, `slack_token`, `stripe_key`, `private_key`, `password` |
| Network | `ipv4`, `mac`, `username` |

Fields in the same row agree with each other: the email and username match the name, the phone area code, ZIP and driver's license format match the city and state, the card brand and CVV length match the card number, and the diagnosis matches the ICD-10 code.

### Presets

| Preset | Fields |
|---|---|
| `pii` (default) | full_name, dob, email, phone, street, city, state, zip, ssn |
| `pci` | full_name, cc_number, cc_brand, cc_expiry, cc_cvv, zip |
| `phi` | full_name, dob, ssn, mrn, icd10, diagnosis, medication, insurer, member_id, npi |
| `banking` | full_name, aba_routing, bank_account, iban, swift_bic |
| `gov` | full_name, ssn, itin, drivers_license, passport_us, uk_nino, ca_sin |
| `secrets` | username, password, aws_access_key_id, aws_secret_key, github_pat, slack_token, stripe_key |

## API at a glance

Base URL: `https://dlp.cyberdynenetwork.com` (also `https://dlp-datagen.revpixel.workers.dev`).

| Endpoint | Returns |
|---|---|
| `GET /api/generate` | Generated data in the requested format |
| `GET /api/fields` | All fields, categories, presets, formats and row limits, as JSON |
| `GET /api/health` | `{"ok": true}` |

| Parameter | Default | Notes |
|---|---|---|
| `fields` | | Comma-separated field ids, in column order. Overrides `preset`. |
| `preset` | `pii` | `pii`, `pci`, `phi`, `banking`, `gov`, `secrets` |
| `rows` | `10` | 1 to 10,000; 1 to 2,000 for `xlsx`, `docx` and `pdf` |
| `format` | `json` | `csv`, `json`, `ndjson`, `txt`, `xlsx`, `docx`, `pdf` |
| `valid` | `true` | `false`, `0` or `no` for near-misses |
| `seed` | random | Any string. The seed used is returned in the `X-DLP-Seed` header. |
| `header` | `true` | `false` drops the header row from CSV and XLSX |
| `download` | | Present (any value) = send as an attachment |

Errors are JSON (`{"error": "..."}`) with status 400, 404 or 405. CORS is open, so browser code on any origin can call the API. The [API reference](docs/api.md) has the full details.

## Web UI vs API

Both use the same generator code (`src/lib/`), so the same fields, seed and mode give the same values in either.

| | Web UI | API |
|---|---|---|
| Where data is generated | Your browser | Cloudflare Worker |
| Max rows (CSV, JSON, NDJSON, TXT, XLSX) | 100,000 | 10,000 (2,000 for XLSX) |
| Max rows (DOCX, PDF) | 10,000 | 2,000 |
| Extras | Live preview, copy to clipboard, copy-as-curl for the current settings, remembers your last settings | Scriptable; seed in a response header |

## Development

Requires Node.js 22.18 or later. Uses the Cloudflare [`cf` CLI](https://developers.cloudflare.com/cf/) and Vite.

```bash
npm install
npm run dev        # local server with the UI and API
npm test           # generator, checksum, document and API tests
npm run typecheck  # Worker and web UI
npm run build      # production build
npm run deploy     # deploy to Cloudflare Workers
```

CI (`.github/workflows/ci.yml`) runs the tests and type checks on every push to `main` and on every pull request.

### Layout

| Path | Contents |
|---|---|
| `src/lib/fields.ts` | Field registry, per-row consistency, presets |
| `src/lib/checksums.ts` | Luhn, ABA, IBAN mod-97, NPI and DEA algorithms |
| `src/lib/data.ts` | Seed lists: names, places, ICD-10 codes, medications, insurers |
| `src/lib/rng.ts` | Seeded PRNG (FNV-1a hash into mulberry32) |
| `src/lib/generate.ts` | Generation, text serializers, MIME types |
| `src/lib/documents.ts`, `src/lib/zip.ts` | Dependency-free XLSX, DOCX and PDF writers |
| `src/api.ts` | API handler; `src/index.ts` is the Worker entry |
| `src/web/`, `index.html` | Web UI |
| `test/` | Tests (Node's built-in test runner) |
| `cloudflare.config.ts` | Worker name, custom domain, static asset routing |

### Adding a field

1. Add an entry to `FIELDS` in `src/lib/fields.ts` with an `id`, `label`, `category`, `checksum`, `description` and `gen` function. Use `row.rng` for randomness and `row.memo` for anything other fields in the row should agree with.
2. If it has a checksum, add the algorithm to `src/lib/checksums.ts`, produce a wrong check value when `row.valid` is false, and add the field to the valid/invalid tests in `test/generators.test.ts`.
3. Document it in [docs/fields.md](docs/fields.md) and the table above.

A new field only changes output for requests that include it; existing seeds keep producing the same data.

## Responsible use

Everything here is synthetic. Names, addresses and other values are randomly combined from short lists of common names and places, and email addresses use reserved `example.*` domains that can't receive mail. Valid-mode numbers follow real formats and checksums, so a generated SSN or card number could match a real one by chance. Use the output only for testing systems you're authorized to test, and don't submit it to payment processors, government services or other third parties.

## License

MIT
