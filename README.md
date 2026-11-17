# DLP Test Data Generator

**Live:** https://dlp-datagen.revpixel.workers.dev

Synthetic PII, PCI, PHI and secrets for testing data loss prevention (DLP) rules: Microsoft Purview, Netskope, Zscaler, Symantec, Forcepoint, Google DLP and similar tools.

Values with check digits or structure rules (card numbers, SSNs, IBANs, ABA routing numbers, NPIs and more) pass the same validation DLP engines run, so they trigger real detections. **Invalid mode** produces near-misses that look right but fail validation, for checking false positives.

- **Web UI:** pick fields, row count and format, then preview, download or copy. Data is generated in the browser; nothing is sent to a server.
- **API:** the same generator on Cloudflare Workers, for scripts and automated tests.
- **Repeatable:** pass a seed to get identical output every time.

## Fields

| Category | Fields |
|---|---|
| Identity | full name, first/last name, date of birth, gender |
| Contact | email (reserved `example.*` domains), US phone, street, city, state, ZIP |
| Government ID | SSN ✓, ITIN ✓, EIN ✓, driver's license (state formats), US passport, UK NINO ✓, Canadian SIN ✓ |
| Financial | credit card ✓ (Visa, Mastercard, Amex, Discover), brand, expiry, CVV, IBAN ✓ (DE, GB, NL, CH, FR), ABA routing ✓, US bank account, SWIFT/BIC |
| Health | MRN, NPI ✓, DEA ✓, ICD-10 code and diagnosis, medication, insurer, member ID, Medicare MBI ✓ |
| Secrets | AWS access key ID and secret, GitHub token, Slack bot token, Stripe secret key, RSA private key (PEM), password |
| Network | IPv4, MAC address, username |

✓ = has a checksum or structure rule; invalid mode breaks it.

Fields in the same row agree with each other: the email matches the name, the phone area code and ZIP match the city, the card brand matches the card number.

## API

```bash
# 10 PCI rows as CSV
curl "https://dlp-datagen.revpixel.workers.dev/api/generate?preset=pci&rows=10&format=csv"

# Specific fields, invalid near-misses, fixed seed
curl "https://dlp-datagen.revpixel.workers.dev/api/generate?fields=full_name,ssn,cc_number&rows=100&valid=false&seed=run-42"

# List all fields and presets
curl "https://dlp-datagen.revpixel.workers.dev/api/fields"
```

| Parameter | Default | Notes |
|---|---|---|
| `fields` | | Comma-separated field ids (see `/api/fields`) |
| `preset` | `pii` | `pii`, `pci`, `phi`, `banking`, `gov`, `secrets`; ignored when `fields` is set |
| `rows` | `10` | 1 to 10,000 |
| `format` | `json` | `csv`, `json`, `ndjson`, `txt` |
| `valid` | `true` | `false` for near-misses |
| `seed` | random | Returned in the `X-DLP-Seed` response header |
| `header` | `true` | CSV header row |
| `download` | | Present = send as an attachment |

The `txt` format writes labelled records (`SSN: 123-45-6789`), since many DLP rules require a keyword near the match.

## Development

Requires Node.js 22.18 or later.

```bash
npm install
npm run dev        # local server with the UI and API
npm test           # generator, checksum and API tests
npm run typecheck
npm run deploy     # deploy to Cloudflare Workers (cf CLI)
```

Layout:

- `src/lib/` generators, checksums and serializers, shared by the browser and the Worker
- `src/api.ts` API handler; `src/index.ts` Worker entry
- `src/web/` and `index.html` web UI
- `test/` tests (Node's built-in test runner)

## Responsible use

Everything here is synthetic. Valid-mode numbers follow real formats and checksums, so a generated SSN or card number could coincide with a real one by chance. Use the output only for testing systems you're authorized to test, and don't submit it to payment processors, government services or third parties.

## License

MIT
