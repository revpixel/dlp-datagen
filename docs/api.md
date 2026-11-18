# API reference

The API serves the same generator as the web UI. It needs no key or sign-up, and every response is generated fresh (`Cache-Control: no-store`).

**Base URLs** (identical; use either):

- `https://dlp.cyberdynenetwork.com`
- `https://dlp-datagen.revpixel.workers.dev`

| Endpoint | Purpose |
|---|---|
| [`GET /api/generate`](#get-apigenerate) | Generate data |
| [`GET /api/fields`](#get-apifields) | List fields, categories, presets, formats and limits |
| [`GET /api/health`](#get-apihealth) | Health check |

See also: [field reference](fields.md) · [output formats](formats.md)

---

## GET /api/generate

Returns generated records in the requested format. With no parameters, you get 10 rows of the `pii` preset as JSON.

```bash
curl "https://dlp.cyberdynenetwork.com/api/generate?fields=full_name,ssn,cc_number&rows=2&seed=demo"
```

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Cache-Control: no-store
X-DLP-Seed: demo
Access-Control-Allow-Origin: *
Access-Control-Expose-Headers: X-DLP-Seed
```

```json
[
  {
    "full_name": "Casey Davis",
    "ssn": "050-43-2174",
    "cc_number": "6011918456830360"
  },
  {
    "full_name": "Mark Hall",
    "ssn": "327-94-2340",
    "cc_number": "377940508381953"
  }
]
```

### Query parameters

All parameters are optional. Field ids, preset names and format names are lowercase and case-sensitive.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `fields` | comma-separated ids | | Fields to generate, in column order. Overrides `preset`. |
| `preset` | string | `pii` | A named set of fields. Ignored (and not checked) when `fields` is set. |
| `rows` | integer | `10` | Number of records. 1 to 10,000, or 1 to 2,000 for `xlsx`, `docx` and `pdf`. |
| `format` | string | `json` | `csv`, `json`, `ndjson`, `txt`, `xlsx`, `docx` or `pdf` |
| `valid` | boolean | `true` | `false` generates near-misses that fail validation. |
| `seed` | string | random | Makes the output repeatable. |
| `header` | boolean | `true` | `false` drops the header row from CSV and XLSX. |
| `download` | flag | | If present, the response is sent as an attachment. |

#### `fields`

A comma-separated list of field ids from the [field reference](fields.md) or [`/api/fields`](#get-apifields). Whitespace around each id is trimmed and empty entries are skipped, so `fields=ssn, cc_number,` works.

- Columns appear in the order you list them.
- Any unknown id fails the whole request with a `400` that names it.
- `fields=` (empty) is treated as not set, so the preset applies. A value with only commas (`fields=,,`) is a `400`.
- A repeated id gives separate columns with independent values in CSV, TXT, XLSX, DOCX and PDF. JSON and NDJSON objects can't have duplicate keys, so only the last one is kept.

#### `preset`

| Preset | Label | Fields |
|---|---|---|
| `pii` | PII basics | full_name, dob, email, phone, street, city, state, zip, ssn |
| `pci` | PCI (cards) | full_name, cc_number, cc_brand, cc_expiry, cc_cvv, zip |
| `phi` | HIPAA / PHI | full_name, dob, ssn, mrn, icd10, diagnosis, medication, insurer, member_id, npi |
| `banking` | Banking | full_name, aba_routing, bank_account, iban, swift_bic |
| `gov` | Government IDs | full_name, ssn, itin, drivers_license, passport_us, uk_nino, ca_sin |
| `secrets` | Secrets & keys | username, password, aws_access_key_id, aws_secret_key, github_pat, slack_token, stripe_key |
| `cloud_secrets` | Cloud secrets & tokens | aws_access_key_id, aws_secret_key, github_pat, entra_client_secret, azure_devops_pat, azure_storage_key, azure_storage_connection_string, azure_service_bus_connection_string, azure_sas, gcp_api_key, jwt, bearer_token |

An unknown preset is a `400`, unless `fields` is also set.

#### `rows`

A whole number from 1 to 10,000. The document formats (`xlsx`, `docx`, `pdf`) take more CPU to build, so they're capped at 2,000. Exponent notation works (`rows=1e3` is 1,000); an empty value, a decimal, zero or a number over the cap is a `400`.

For more rows than the cap, make several requests with different seeds (see [Large datasets](#large-datasets)), or use the web UI, which generates up to 100,000 rows (10,000 for DOCX and PDF) in the browser.

#### `format`

| Value | Content-Type | File extension | Attachment |
|---|---|---|---|
| `json` | `application/json; charset=utf-8` | `.json` | with `download` |
| `ndjson` | `application/x-ndjson; charset=utf-8` | `.jsonl` | with `download` |
| `csv` | `text/csv; charset=utf-8` | `.csv` | with `download` |
| `txt` | `text/plain; charset=utf-8` | `.txt` | with `download` |
| `xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `.xlsx` | always |
| `docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `.docx` | always |
| `pdf` | `application/pdf` | `.pdf` | always |

[Output formats](formats.md) describes each one's layout.

#### `valid`

`false`, `0` or `no` (any case) turns on invalid mode. Any other value, including an empty one, leaves it on valid.

In invalid mode, every field marked ✓ in the [field reference](fields.md) fails its checksum or structure rule while keeping the right shape. For the Secrets v2 fields that means, for example, a bad Marvin32 checksum on Azure keys, a 39-character Entra secret, a 24-byte SAS signature or a JWT without its signature segment. Fields without a rule are generated the same way in both modes.

#### `seed`

Any string. Leading and trailing whitespace is trimmed; an empty or blank seed means "pick one at random". The seed used, given or random, is always returned in the `X-DLP-Seed` response header, so you can reproduce any response later. See [Repeatable output](#repeatable-output).

#### `header`

Only the exact value `false` turns the header off (`header=0` and `header=no` keep it). It applies to `csv` (a row of field ids) and `xlsx` (a bold, frozen row of field labels). Other formats ignore it.

#### `download`

If `download` is present with any value, even `download=false`, the response gets `Content-Disposition: attachment; filename="dlp-test-data.<ext>"`. `xlsx`, `docx` and `pdf` always get this header.

### Response headers

| Header | Value |
|---|---|
| `Content-Type` | Per format; see the table above |
| `X-DLP-Seed` | The seed used for this response |
| `Content-Disposition` | `attachment; filename="dlp-test-data.<ext>"`, for document formats or when `download` is set |
| `Cache-Control` | `no-store` |
| `Access-Control-Allow-Origin` | `*` |
| `Access-Control-Allow-Methods` | `GET, HEAD, OPTIONS` |
| `Access-Control-Expose-Headers` | `X-DLP-Seed`, so browser code can read the seed |

---

## GET /api/fields

Everything the generator supports, as JSON. Use it to build field pickers or to check ids before calling `/api/generate`.

```bash
curl "https://dlp.cyberdynenetwork.com/api/fields"
```

```json
{
  "categories": ["Identity", "Contact", "Government ID", "Financial", "Health", "Secrets", "Network"],
  "fields": [
    {
      "id": "full_name",
      "label": "Full name",
      "category": "Identity",
      "checksum": false,
      "description": "First and last name"
    },
    {
      "id": "ssn",
      "label": "SSN",
      "category": "Government ID",
      "checksum": true,
      "description": "AAA-GG-SSSS; invalid mode uses area 000/666/9xx, group 00 or serial 0000"
    }
  ],
  "presets": {
    "pci": {
      "label": "PCI (cards)",
      "fields": ["full_name", "cc_number", "cc_brand", "cc_expiry", "cc_cvv", "zip"]
    }
  },
  "formats": ["csv", "json", "ndjson", "txt", "xlsx", "docx", "pdf"],
  "maxRows": 10000,
  "maxDocumentRows": 2000
}
```

(Shortened: the real response lists all 54 fields and all 7 presets.)

| Key | Type | Description |
|---|---|---|
| `categories` | string[] | Category names, in display order |
| `fields` | object[] | Every field, in display order |
| `fields[].id` | string | Value to pass in `fields` |
| `fields[].label` | string | Human-readable name, used in XLSX headers and in TXT, DOCX and PDF records |
| `fields[].category` | string | One of `categories` |
| `fields[].checksum` | boolean | `true` if the field has a checksum or structure rule that invalid mode breaks |
| `fields[].description` | string | Short format description |
| `presets` | object | Preset name → `{ label, fields }` |
| `formats` | string[] | Accepted `format` values |
| `maxRows` | number | Row cap for text formats |
| `maxDocumentRows` | number | Row cap for `xlsx`, `docx` and `pdf` |

---

## GET /api/health

```bash
curl "https://dlp.cyberdynenetwork.com/api/health"
```

```json
{
  "ok": true
}
```

---

## Methods and CORS

- `GET` and `HEAD` work on every endpoint. `HEAD` returns the same status and headers as `GET` with no body.
- `OPTIONS` returns `204` with the CORS headers, for browser preflight requests.
- Any other method returns `405`.
- CORS allows every origin, so a web page on any domain can call the API with `fetch`.

## Errors

Errors are JSON with a single `error` message:

```json
{
  "error": "Unknown field(s): nope"
}
```

| Status | `error` | Cause |
|---|---|---|
| 400 | `Unknown field(s): <ids>` | One or more ids in `fields` don't exist |
| 400 | `Choose at least one field.` | `fields` has no ids after trimming, e.g. `fields=,,` |
| 400 | `Unknown preset: <name>` | `preset` isn't one of the seven presets (and `fields` isn't set) |
| 400 | `rows must be an integer from 1 to 10000` | `rows` is empty, not a whole number, below 1 or above 10,000 |
| 400 | `rows must be at most 2000 for <format>` | More than 2,000 rows for `xlsx`, `docx` or `pdf` |
| 400 | `format must be one of csv, json, ndjson, txt, xlsx, docx, pdf` | Unknown or wrongly cased `format` |
| 404 | `Not found` | Unknown path under `/api/` (including a trailing slash, such as `/api/generate/`) |
| 405 | `Method not allowed` | Method other than `GET`, `HEAD` or `OPTIONS` |

Only the first problem is reported. Checks run in this order: `preset`, `rows`, `format`, the document row cap, then the ids in `fields`.

## Limits

| Limit | Value |
|---|---|
| Rows per request, text formats | 10,000 |
| Rows per request, `xlsx` / `docx` / `pdf` | 2,000 |
| Authentication | None |
| Rate limiting | None in the app. Cloudflare's own platform limits still apply. |

There's no quota, but it's a free public service; for very large or frequent jobs, generate in the web UI or run your own copy (see the [README](../README.md#development)).

## Repeatable output

With a seed, the output is fully deterministic:

- The same seed, `fields` (in the same order), `rows` and `valid` give the same values, whichever format you pick. Document formats are byte-identical too: the ZIP timestamps inside XLSX and DOCX are fixed.
- More rows extend the output: the first 10 rows of a `rows=100` request match a `rows=10` request with the same seed.
- Changing the field list or its order changes the values, because the fields share one random stream.
- Valid and invalid runs with the same seed are not row-for-row versions of each other. Both are repeatable, but the invalid run's values aren't the valid run's values with a digit changed.
- `dob` and `cc_expiry` are relative to the current UTC year (ages 18 to 90, expiry 1 to 5 years ahead), so those two fields shift by a year each New Year. Everything else is stable.
- Changes to the generator itself can change the output for a seed. To pin output exactly, run a specific commit yourself.

The seed is hashed into a 32-bit number (FNV-1a), so two different seeds can, very rarely, produce the same data. A random seed is up to 14 lowercase letters and digits.

The web UI and the API share the generator code, so a seed from one reproduces the same data in the other.

## Examples

### curl

```bash
# Default: 10 rows of PII as JSON
curl "https://dlp.cyberdynenetwork.com/api/generate"

# A preset as CSV, saved to a file
curl "https://dlp.cyberdynenetwork.com/api/generate?preset=pci&rows=1000&format=csv" -o pci.csv

# Near-misses for false-positive testing
curl "https://dlp.cyberdynenetwork.com/api/generate?fields=ssn,cc_number,iban&rows=500&valid=false&format=csv" -o near-misses.csv

# A Word document with a fixed seed
curl "https://dlp.cyberdynenetwork.com/api/generate?preset=gov&rows=50&format=docx&seed=q3-audit" -o gov.docx

# Show the seed of a random run
curl -s -D - -o /dev/null "https://dlp.cyberdynenetwork.com/api/generate?preset=phi" | grep -i x-dlp-seed

# Stream JSON Lines into jq
curl -s "https://dlp.cyberdynenetwork.com/api/generate?preset=secrets&rows=5&format=ndjson" | jq -c '{username, github_pat}'

# Cloud credentials as labelled text, and their near-misses
curl "https://dlp.cyberdynenetwork.com/api/generate?preset=cloud_secrets&rows=25&format=txt" -o cloud-secrets.txt
curl "https://dlp.cyberdynenetwork.com/api/generate?preset=cloud_secrets&rows=25&format=txt&valid=false" -o cloud-near-misses.txt
```

### PowerShell

```powershell
# Parsed objects
$rows = Invoke-RestMethod "https://dlp.cyberdynenetwork.com/api/generate?preset=pii&rows=25"
$rows | Format-Table full_name, ssn, email

# Save a PDF
Invoke-WebRequest "https://dlp.cyberdynenetwork.com/api/generate?preset=phi&rows=200&format=pdf" -OutFile phi.pdf

# Read the seed header
$r = Invoke-WebRequest "https://dlp.cyberdynenetwork.com/api/generate?preset=pci&format=csv"
$r.Headers["X-DLP-Seed"]
```

### Python

```python
import requests

BASE = "https://dlp.cyberdynenetwork.com/api/generate"

r = requests.get(BASE, params={"preset": "banking", "rows": 100, "seed": "ci-run-7"})
r.raise_for_status()
records = r.json()
print(r.headers["X-DLP-Seed"], records[0]["iban"])

# Document formats are binary
pdf = requests.get(BASE, params={"preset": "phi", "rows": 300, "format": "pdf"})
open("phi.pdf", "wb").write(pdf.content)

# Errors carry a message
bad = requests.get(BASE, params={"fields": "ssn,nope"})
print(bad.status_code, bad.json()["error"])  # 400 Unknown field(s): nope
```

### JavaScript (browser or Node)

```js
const url = new URL("https://dlp.cyberdynenetwork.com/api/generate");
url.search = new URLSearchParams({ fields: "full_name,cc_number,cc_expiry", rows: "20", valid: "false" });

const res = await fetch(url);
if (!res.ok) throw new Error((await res.json()).error);
console.log("seed", res.headers.get("X-DLP-Seed"));
const records = await res.json();
```

### Large datasets

Each request is capped, so join several. Distinct seeds give distinct rows, and the whole set stays reproducible:

```bash
for i in $(seq 1 10); do
  curl -s "https://dlp.cyberdynenetwork.com/api/generate?preset=pii&rows=10000&format=csv&seed=bulk-$i&header=$([ $i = 1 ] && echo true || echo false)"
done > pii-100k.csv
```
