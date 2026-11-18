# Field reference

Every field the generator produces: its API id, format, an example, and the validation rule it follows. Fields marked ✓ have a checksum or structure rule; in invalid mode (`valid=false`) they keep the right shape but fail that rule. Fields without ✓ are generated the same way in both modes.

All values are strings, including numbers, so leading zeros are kept (`007-83-9774`, `015497860`).

The examples come from `seed=docs` (valid) and `seed=docs&valid=false` (invalid). Valid and invalid runs aren't row-for-row versions of each other, so the two examples for a field can differ by more than the broken part.

See also: [API reference](api.md) · [output formats](formats.md)

**Contents:** [Identity](#identity) · [Contact](#contact) · [Government ID](#government-id) · [Financial](#financial) · [Health](#health) · [Secrets](#secrets) · [Network](#network) · [Presets](#presets) · [Consistency within a row](#consistency-within-a-row) · [Source lists](#source-lists) · [Testing tips](#testing-tips)

## Summary

| id | Label | Category | ✓ | Example |
|---|---|---|---|---|
| `full_name` | Full name | Identity | | `Patricia White` |
| `first_name` | First name | Identity | | `Patricia` |
| `last_name` | Last name | Identity | | `White` |
| `dob` | Date of birth | Identity | | `1995-01-18` |
| `gender` | Gender | Identity | | `M` |
| `email` | Email | Contact | | `patricia.white@example.org` |
| `phone` | Phone (US) | Contact | | `(443) 206-2546` |
| `street` | Street address | Contact | | `5452 Highland Pl` |
| `city` | City | Contact | | `Baltimore` |
| `state` | State | Contact | | `MD` |
| `zip` | ZIP code | Contact | | `21252` |
| `ssn` | SSN | Government ID | ✓ | `007-83-9774` |
| `itin` | ITIN | Government ID | ✓ | `968-70-4064` |
| `ein` | EIN | Government ID | ✓ | `37-4689184` |
| `drivers_license` | Driver's license | Government ID | | `Y75971011` |
| `passport_us` | US passport | Government ID | | `L72283262` |
| `uk_nino` | UK National Insurance no. | Government ID | ✓ | `KL 39 22 56 C` |
| `ca_sin` | Canadian SIN | Government ID | ✓ | `915 224 414` |
| `cc_number` | Credit card number | Financial | ✓ | `4659632162667774` |
| `cc_brand` | Card brand | Financial | | `Visa` |
| `cc_expiry` | Card expiry | Financial | | `11/31` |
| `cc_cvv` | CVV | Financial | | `859` |
| `iban` | IBAN | Financial | ✓ | `DE96 4404 7657 7460 8493 41` |
| `aba_routing` | ABA routing number | Financial | ✓ | `015497860` |
| `bank_account` | Bank account (US) | Financial | | `39769973938` |
| `swift_bic` | SWIFT/BIC | Financial | | `XWOJGBJD` |
| `mrn` | Medical record no. | Health | | `MRN42972714` |
| `npi` | NPI | Health | ✓ | `2958569677` |
| `dea` | DEA number | Health | ✓ | `FW9323990` |
| `icd10` | ICD-10 code | Health | | `O80` |
| `diagnosis` | Diagnosis | Health | | `Encounter for full-term uncomplicated delivery` |
| `medication` | Medication | Health | | `Escitalopram 10 mg` |
| `insurer` | Health insurer | Health | | `Kaiser Permanente` |
| `member_id` | Insurance member ID | Health | | `EHK038608294` |
| `mbi` | Medicare MBI | Health | ✓ | `4X92-UN6-WM61` |
| `aws_access_key_id` | AWS access key ID | Secrets | | `AKIAV2B3C37H…` |
| `aws_secret_key` | AWS secret key | Secrets | | `n6sCpIr6F7NZ…` |
| `github_pat` | GitHub token | Secrets | | `ghp_eEyZq9FtD2tCK9JP1govQpMUrjulxrXyT0Dn` |
| `slack_token` | Slack bot token | Secrets | | `xoxb-5866…` |
| `stripe_key` | Stripe secret key | Secrets | | `sk_live_kE3t…` |
| `private_key` | Private key (PEM) | Secrets | | `-----BEGIN RSA PRIVATE KEY-----` … (multi-line) |
| `password` | Password | Secrets | | `W%bCi9fd#HGu5x` |
| `entra_client_secret` | Entra client secret | Secrets | ✓ | `QgX8Q~5A5i…` |
| `azure_devops_pat` | Azure DevOps PAT | Secrets | ✓ | `oYmGE5n2…AZDO3lJY` |
| `azure_storage_key` | Azure storage account key | Secrets | ✓ | `Nb+oHxqV…+AStGN9Jww==` |
| `azure_storage_connection_string` | Azure Storage connection string | Secrets | ✓ | `DefaultEndpointsProtocol=https;AccountName=…` |
| `azure_service_bus_connection_string` | Azure Service Bus connection string | Secrets | ✓ | `Endpoint=sb://example-telemetry-4392…` |
| `azure_sas` | Azure Storage SAS URL | Secrets | ✓ | `https://examplefiles8892.blob.core.windows.net/…` |
| `gcp_api_key` | Google Cloud API key | Secrets | | `AIzaSy4xGWK1…` |
| `jwt` | JSON Web Token (JWT) | Secrets | ✓ | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ…` |
| `bearer_token` | Bearer token (HTTP header) | Secrets | | `Authorization: Bearer khn1NlVf…` |
| `ipv4` | IPv4 address | Network | | `32.100.77.26` |
| `mac` | MAC address | Network | | `8C:02:73:36:A4:EC` |
| `username` | Username | Network | | `pwhite54` |

The label is what appears in XLSX headers and next to each value in TXT, DOCX and PDF output. CSV headers and JSON keys use the id.

---

## Identity

### `full_name` — Full name

First and last name separated by a space, from the [name lists](#source-lists). Matches `first_name` and `last_name` in the same row.

Example: `Patricia White`

### `first_name` — First name

A given name from a list of 72 common US names, including some gender-neutral names (Jordan, Taylor, Casey) and names from other cultures (Priya, Wei, Mohammed).

Example: `Patricia`

### `last_name` — Last name

A family name from a list of 56 common US surnames.

Example: `White`

### `dob` — Date of birth

`YYYY-MM-DD`. The year makes the person 18 to 90 years old in the current UTC year; the month is random and the day is 1 to 28, so every date exists.

Example: `1995-01-18`

Because the range follows the current year, the same seed gives a year-later `dob` after each New Year.

### `gender` — Gender

`M`, `F` or `X`, with equal probability. It's chosen independently of the name.

Example: `M`

---

## Contact

### `email` — Email

`first.last@domain`, lowercase, built from the row's name. Half the addresses add a number from 1 to 99 after the last name. The domain is `example.com`, `example.org` or `example.net`, which are reserved for documentation ([RFC 2606](https://www.rfc-editor.org/rfc/rfc2606)) and can never receive mail.

Examples: `patricia.white@example.org`, `matthew.adams42@example.org`

### `phone` — Phone (US)

`(AAA) EEE-NNNN`. The area code is a real one for the row's city; the exchange is 201 to 999 and the line number is four random digits. Numbers aren't checked against assignment data.

Example: `(443) 206-2546` (Baltimore)

### `street` — Street address

House number 10 to 9999, a street name and a suffix (`St`, `Ave`, `Rd`, `Blvd`, `Ln`, `Dr`, `Ct`, `Way`, `Pl`).

Example: `5452 Highland Pl`

### `city` — City

One of 30 large US cities. See [source lists](#source-lists).

Example: `Baltimore`

### `state` — State

The two-letter USPS code for the row's city.

Example: `MD`

### `zip` — ZIP code

Five digits: the first three are a real ZIP prefix for the row's city, the last two are random. The ZIP is plausible for the city but may not exist.

Example: `21252`

---

## Government ID

### `ssn` — US Social Security number ✓

`AAA-GG-SSSS`.

| Mode | Rule |
|---|---|
| Valid | Area 001 to 899 except 666, group 01 to 99, serial 0001 to 9999. The SSA has never issued numbers outside these ranges. |
| Invalid | One of five patterns the SSA never issues, chosen at random: area `000`, area `666`, area `900` to `999`, group `00`, or serial `0000`. |

Valid `007-83-9774` · Invalid `000-83-9774`

Valid numbers follow the issuance rules, but some fall inside ranges that were issued to real people. Never use them outside testing.

### `itin` — US Individual Taxpayer Identification Number ✓

`9XX-GG-XXXX`: always starts with 9. The middle two digits (the group) decide validity.

| Mode | Group |
|---|---|
| Valid | 50 to 65, 70 to 88, 90 to 92, or 94 to 99 (the IRS-assigned ranges) |
| Invalid | 00 to 49, 66, 89 or 93 |

Valid `968-70-4064` · Invalid `968-20-4064`

### `ein` — US Employer Identification Number ✓

`XX-XXXXXXX`. The two-digit prefix decides validity.

| Mode | Prefix |
|---|---|
| Valid | One of the prefixes the IRS assigns to its campuses: 01–06, 10–16, 20–27, 30–48, 50–68, 71–77, 80–88, 90–95, 98, 99 |
| Invalid | A prefix the IRS doesn't assign: 00, 07, 08, 09, 17, 18, 19, 28, 29, 49, 69, 70, 78, 79, 89, 96 or 97 |

Valid `37-4689184` · Invalid `18-4689184`

### `drivers_license` — Driver's license

The format follows the row's state. There's no checksum, so both modes are the same.

| State | Format | Example shape |
|---|---|---|
| CA | 1 letter + 7 digits | `B1234567` |
| TX | 8 digits | `12345678` |
| NY | 9 digits | `123456789` |
| FL | 1 letter + 12 digits, dashed | `B123-456-78-901-2` |
| IL | 1 letter + 11 digits, dashed | `B123-4567-8901` |
| WA | `WDL` + 9 letters or digits | `WDLAB12CD34E` |
| PA | 8 digits, spaced | `12 345 678` |
| Other states | 1 letter + 7 or 8 digits | `B1234567` |

Example: `Y75971011` (MD)

### `passport_us` — US passport number

Either 9 digits or, for the Next Generation passport, a letter followed by 8 digits (equal odds). No checksum.

Examples: `L72283262`, `712604999`

### `uk_nino` — UK National Insurance number ✓

`AB 12 34 56 C`: two prefix letters, six digits in pairs, and a suffix letter `A` to `D`, separated by spaces.

| Mode | Prefix rule |
|---|---|
| Valid | First letter isn't D, F, I, Q, U or V; second letter isn't D, F, I, O, Q, U or V; the prefix isn't BG, GB, KN, NK, NT, TN or ZZ (HMRC rules) |
| Invalid | First letter is D, F, I, Q, U or V |

Valid `KL 39 22 56 C` · Invalid `IL 39 22 56 C`

### `ca_sin` — Canadian Social Insurance Number ✓

`NNN NNN NNN`, nine digits with a Luhn check digit. The first digit is 1 to 7 or 9 (0 and 8 aren't used for individuals).

| Mode | Rule |
|---|---|
| Valid | Passes the Luhn check |
| Invalid | Last digit is wrong, so the Luhn check fails |

Valid `915 224 414` · Invalid `915 224 415`

---

## Financial

### `cc_number` — Credit card number ✓

Digits only, no spaces or dashes. Each of the four brands is equally likely, with real issuer prefixes (IIN ranges) and lengths:

| Brand | Prefix | Length |
|---|---|---|
| Visa | 4 | 16 |
| Mastercard | 51–55 (70%) or 2221–2720 (30%) | 16 |
| American Express | 34 or 37 | 15 |
| Discover | 6011 or 65 | 16 |

| Mode | Rule |
|---|---|
| Valid | Passes the Luhn check |
| Invalid | Right prefix and length, wrong final digit, so the Luhn check fails |

Valid `4659632162667774` (Visa) · Invalid `379632162667779` (American Express)

The prefixes are real, so a valid number could belong to a real card by chance. Never use one for a payment.

### `cc_brand` — Card brand

`Visa`, `Mastercard`, `American Express` or `Discover`, always matching the row's `cc_number`.

Example: `Visa`

### `cc_expiry` — Card expiry

`MM/YY`, month 01 to 12, year 1 to 5 years after the current UTC year. Like `dob`, it moves forward a year each New Year for a given seed.

Example: `11/31`

### `cc_cvv` — Card security code

3 random digits, or 4 for American Express (matching the row's card).

Example: `859`

### `iban` — International Bank Account Number ✓

Two-letter country code, two check digits and the country's BBAN, printed in groups of four separated by spaces.

| Country | Length | BBAN |
|---|---|---|
| DE (Germany) | 22 | 18 digits |
| GB (United Kingdom) | 22 | 4 letters + 14 digits |
| NL (Netherlands) | 18 | 4 letters + 10 digits |
| CH (Switzerland) | 21 | 17 digits |
| FR (France) | 27 | 23 digits |

| Mode | Rule |
|---|---|
| Valid | Check digits pass the ISO 13616 mod-97 check |
| Invalid | Check digits are changed to another two-digit value, so the mod-97 check fails |

Valid `DE96 4404 7657 7460 8493 41` · Invalid `NL26 AMSS 5774 6084 93`

Only the IBAN check digits are computed. The BBAN contents (bank codes, sort codes, France's RIB key) are random, so a tool that also checks national bank codes may reject them.

To compare without the spaces, strip whitespace first; most DLP IBAN detectors accept both forms.

### `aba_routing` — ABA routing number ✓

Nine digits. The first two are a valid Federal Reserve routing symbol (01–12, 21–32, 61–72 or 80) and the ninth is the check digit.

| Mode | Rule |
|---|---|
| Valid | `3(d1 + d4 + d7) + 7(d2 + d5 + d8) + (d3 + d6 + d9)` is a multiple of 10 |
| Invalid | Wrong ninth digit, so the sum isn't a multiple of 10 |

Valid `015497860` · Invalid `050549782`

### `bank_account` — US bank account number

8 to 12 random digits. US account numbers have no standard format or checksum.

Example: `39769973938`

### `swift_bic` — SWIFT/BIC code

A 4-letter bank code, a country code (`US`, `GB`, `DE`, `FR`, `CH` or `NL`), a 2-character location code, and, half the time, a 3-character branch code. That makes 8 or 11 characters, all uppercase. There's no checksum, and the bank codes are random.

Examples: `XWOJGBJD`, `ZJOQUSUHIXA`

---

## Health

### `mrn` — Medical record number

`MRN` followed by 8 digits. Real MRNs differ between healthcare organizations, so the `MRN` prefix gives DLP rules a keyword to match.

Example: `MRN42972714`

### `npi` — US National Provider Identifier ✓

Ten digits starting with 1 or 2. The last digit is a Luhn check digit calculated with the `80840` prefix in front, as CMS specifies.

| Mode | Rule |
|---|---|
| Valid | Luhn over `80840` + the first 9 digits gives the 10th |
| Invalid | Wrong 10th digit |

Valid `2958569677` · Invalid `2958569676`

### `dea` — DEA registration number ✓

Two letters and seven digits. The first letter is a registrant type (`A`, `B`, `F`, `G` or `M`); the second is the first letter of the row's last name, as for real practitioners.

| Mode | Rule |
|---|---|
| Valid | `(d1 + d3 + d5) + 2 × (d2 + d4 + d6)`, mod 10, equals d7 |
| Invalid | Wrong d7 |

Valid `FW9323990` (last name White) · Invalid `MW3239956`

### `icd10` — ICD-10 diagnosis code

A real ICD-10-CM code from a list of 20 common diagnoses. The list includes sensitive conditions that health-data policies often target, such as HIV (`B20`), alcohol dependence (`F10.20`), depression (`F32.9`) and breast cancer (`C50.919`). Codes are real in both modes.

Example: `O80`

### `diagnosis` — Diagnosis

The description of the row's `icd10` code.

Example: `Encounter for full-term uncomplicated delivery`

### `medication` — Medication

A common drug and dose from a list of 12, such as `Metformin 500 mg` or `Insulin glargine 100 U/mL`. Chosen independently of the diagnosis.

Example: `Escitalopram 10 mg`

### `insurer` — Health insurer

One of Aetna, Blue Cross Blue Shield, Cigna, UnitedHealthcare, Humana, Kaiser Permanente, Medicare or Medicaid.

Example: `Kaiser Permanente`

### `member_id` — Insurance member ID

3 uppercase letters and 9 digits. Real member ID formats vary by insurer.

Example: `EHK038608294`

### `mbi` — Medicare Beneficiary Identifier ✓

11 characters, shown in CMS's dashed form `XXXX-XXX-XXXX`. Letters exclude S, L, O, I, B and Z.

| Position | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Allowed | 1–9 | letter | letter or digit | digit | letter | letter or digit | digit | letter | letter | digit | digit |

| Mode | Rule |
|---|---|
| Valid | Every position follows the table above |
| Invalid | Position 1 is `0` |

Valid `4X92-UN6-WM61` · Invalid `0YJ7-JX8-MR16`

---

## Secrets

These match the patterns DLP and secret scanners look for. None is a working credential: every value is random, issued by no provider, and tied to no real account, tenant, namespace or project. The generator never contacts a provider. Real GitHub tokens end with a checksum, so scanners that check it, or that test credentials against the provider, won't treat these as live.

The first seven fields have no valid/invalid difference. The Secrets v2 fields from `entra_client_secret` onward have one wherever the provider's format has a real rule to break: a length and marker, a checksum, a signature length or a token structure.

Many examples below are shortened (`…`). The full values match secret-scanning patterns closely enough that GitHub push protection blocks them from this repository, which is the point of the generator but not of its documentation. Generated output is always complete; get full values with `/api/generate?preset=cloud_secrets&rows=1`.

### `aws_access_key_id` — AWS access key ID

`AKIA` followed by 16 characters from `A–Z` and `2–7`, 20 characters in all.

Example: `AKIAV2B3C37H…`

### `aws_secret_key` — AWS secret access key

40 characters from `A–Z`, `a–z`, `0–9`, `+` and `/`.

Example: `n6sCpIr6F7NZ…`

Without a keyword, this is just a random string; many rules need `aws_secret_access_key` or an access key ID nearby. Pair it with `aws_access_key_id`, and use TXT, DOCX or PDF to get labels next to the values.

### `github_pat` — GitHub personal access token

`ghp_` followed by 36 letters and digits, 40 characters in all.

Example: `ghp_eEyZq9FtD2tCK9JP1govQpMUrjulxrXyT0Dn`

### `slack_token` — Slack bot token

`xoxb-`, 12 digits, `-`, 13 digits, `-`, and 24 letters and digits.

Example: `xoxb-5866…`

### `stripe_key` — Stripe secret key

`sk_live_` followed by 24 letters and digits.

Example: `sk_live_kE3t…`

### `private_key` — RSA private key (PEM)

A six-line PEM block: the `-----BEGIN RSA PRIVATE KEY-----` header, a first line starting `MIIEpAIBAAKCAQEA` (how real 2048-bit RSA keys start), four more 64-character base64 lines, and the matching footer. The body is random, so it doesn't parse as a key.

```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAcHpjA8SUSXlXlq2dxSYjn4mOopLYABlTa+fYTH7pIHjCIaoC
kPZlew5go3tXJ34H6qtx4fcgBseAUxrAoJkp7cRIq+XAuhKWBVOjk0DUpBNubOJ+
vjsBYMtMEb5BU5kaK7IbgVAueYuLMw/gehmI7V7vxTGEWZ7m4RnduG/BR9cdSZyM
ZiiG9MBhTJs7vdYc1k3+7vSmORY6uGjIblw9/IJuhYSxCobq8ntMGwDsM37wt10U
+ygzXwViM4FEvcBEZKtrgLnooQxRJ03GjypfZxQIlo+Wv0oDJA5C+5qpnp+cBQU/
-----END RSA PRIVATE KEY-----
```

This is the only multi-line field. See [output formats](formats.md) for how each format handles the line breaks.

### `password` — Password

12 to 16 characters from letters, digits and `!@#$%^&*`.

Example: `W%bCi9fd#HGu5x`

### `entra_client_secret` — Microsoft Entra client secret ✓

40 characters from letters, digits and `- . _ ~` (RFC 3986 unreserved characters), with the fixed marker `8Q~` at positions 4 to 6. This is the current format Entra ID issues for app registration secrets; Microsoft's open-source scanner ([microsoft/security-utilities](https://github.com/microsoft/security-utilities), rule SEC101/156) requires exactly 40 characters when the marker is `8Q~`.

| Mode | Rule |
|---|---|
| Valid | 40 characters, `8Q~` at positions 4 to 6 |
| Invalid | Same alphabet and marker, but 39 characters, so a length-checking detector rejects it |

Valid `QgX8Q~5A5i…` (40 characters) · Invalid `QgX8Q~5A5i…` (39 characters)

**Context:** the marker makes the raw value distinctive, but Microsoft Purview's Entra client secret type also looks for nearby words such as `secret`, `password` or `key`. The label `Entra client secret` provides that in TXT, DOCX and PDF output.

**Why it can't work:** the 37 non-marker characters are random. Entra doesn't validate secrets offline, and no app registration holds these values.

### `azure_devops_pat` — Azure DevOps personal access token ✓

84 characters in the Common Annotated Security Key (CASK) format that Azure DevOps has issued since July 2024:

| Positions | Content |
|---|---|
| 1–52 | Random letters and digits |
| 53–58 | `JQQJ99` (CASK signature) |
| 59 | Allocation year: `A` = 2024, `B` = 2025, `C` = 2026 |
| 60 | Allocation month: `A` to `L` |
| 61–72 | Random letters and digits (platform data) |
| 73–76 | `AAAA` (provider data) |
| 77–80 | `AZDO` (Azure DevOps signature) |
| 81–84 | Checksum |

The checksum is a Marvin32 hash of the first 80 characters (decoded from base64) with the `Default0` seed, written in base62. Generation follows `IdentifiableSecrets.GenerateCommonAnnotatedTestKey` in microsoft/security-utilities, and the check follows `TryValidateCommonAnnotatedKey`.

| Mode | Rule |
|---|---|
| Valid | Checksum matches |
| Invalid | Every fixed part is still in place; the last checksum character is wrong |

Valid `oYmGE5n2…JQQJ99CLp7bkJdjq28tYAAAAAZDO3lJY` · Invalid `woYmGE5n…JQQJ99CJmp7bkJdjq28tAAAAAZDO1VfW`

**Context:** `AZDO` at positions 77 to 80 makes it detectable alone. Purview's Azure DevOps PAT type marks itself as checksum-validated and lists keywords such as `pat`, `token` and `ado`; the label `Azure DevOps PAT` supplies `PAT`. Microsoft doesn't publish how Purview validates the checksum. Pattern-only detectors, including the security-utilities rule SEC101/201, will match near-misses too.

The older 52-character base32 PAT format still works at Azure DevOps but isn't generated.

**Why it can't work:** the 64 random characters were never issued, so no organization recognizes the token. A valid checksum only means the format is consistent.

### `azure_storage_key` — Azure Storage account key ✓

88 base64 characters (64 bytes) in Microsoft's *identifiable key* format: 76 random characters, the signature `+ASt`, then a 4-byte Marvin32 checksum (seed `Default0`) ending in `==`. Generation follows `IdentifiableSecrets.GenerateBase64KeyHelper`; security-utilities rule SEC101/152 detects it.

| Mode | Rule |
|---|---|
| Valid | Marvin32 checksum of the first 60 bytes matches the last 4 |
| Invalid | Same length, alphabet and `+ASt` signature; one checksum byte is changed |

Valid `Nb+oHxqV…+AStGN9Jww==` · Invalid `Nb+oHxqV…+AStKN9Jww==`

**Context:** an identifiable key is detectable alone. Older storage keys have no signature, so detectors for those need context; Purview's storage key types look for `AccountKey` or `SharedAccessKey` nearby. A bare key in a CSV column has neither, so use `azure_storage_connection_string`, or TXT, DOCX or PDF output where the label `Azure storage account key` sits next to the value.

**Why it can't work:** the key bytes are random and tied to no storage account; the checksum only proves the format.

### `azure_storage_connection_string` — Azure Storage connection string ✓

The standard storage account connection string:

```
DefaultEndpointsProtocol=https;AccountName=<account>;AccountKey=<88-character key>;EndpointSuffix=core.windows.net
```

The account name is `example` + a word + 4 digits (for example `examplefiles8892`), 3 to 24 lowercase letters and digits as Azure requires. The key is the row's `azure_storage_key`, so the two fields always match when both are selected.

| Mode | Rule |
|---|---|
| Valid | The `AccountKey` passes its Marvin32 checksum |
| Invalid | Same string with a near-miss key (checksum fails) |

Example: `DefaultEndpointsProtocol=https;AccountName=examplefiles8892;AccountKey=Nb+oHxqV…+AStGN9Jww==;EndpointSuffix=core.windows.net`

**Context:** `AccountName=` and `AccountKey=` are the context Purview and security-utilities (SEC101/106) look for, so this is the most reliably detected storage field in CSV and JSON.

**Why it can't work:** the account names are invented and the key is random. An `example…` account could happen to exist, but the key wouldn't be one of its keys.

### `azure_service_bus_connection_string` — Azure Service Bus connection string ✓

```
Endpoint=sb://<namespace>.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=<44-character key>
```

The namespace is `example-` + a word + `-` + 4 digits. The key is a 32-byte identifiable key: 33 random characters, the Service Bus signature `+ASb`, and a Marvin32 checksum with the `Manage00` seed, the seed Microsoft uses for manage-level keys such as `RootManageSharedAccessKey` (rule SEC101/171). Event Hubs uses the same connection string format, so this field also covers Event Hubs detection rules that match `servicebus.windows.net`.

| Mode | Rule |
|---|---|
| Valid | `SharedAccessKey` passes its Marvin32 checksum |
| Invalid | Same string with one checksum byte changed |

Example: `Endpoint=sb://example-telemetry-4392.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=iCcwQlKS…+ASbKtIY1g=`

**Why it can't work:** invented namespaces and a random key.

### `azure_sas` — Azure Storage shared access signature URL ✓

A full blob URL with a service SAS in its query string, in the parameter order the Azure portal uses:

```
https://<account>.blob.core.windows.net/<container>/<blob>?sp=<permissions>&st=<start>&se=<expiry>&spr=https&sv=2022-11-02&sr=b&sig=<signature>
```

- `sp` is `r`, `rw`, `rcw` or `racwd`, in Azure's required order.
- `st` is a time in 2025 and `se` is 1, 8, 24 or 168 hours later. They come from a fixed window, not the current date, so a seed always gives the same URL; every generated SAS has already expired.
- `sv=2022-11-02` is a storage service version Azure documents for SAS tokens.
- `sig` is a base64 HMAC-SHA256 signature: 32 random bytes, with `+`, `/` and `=` percent-encoded as `%2B`, `%2F` and `%3D`.
- The account name is the row's storage account, shared with `azure_storage_connection_string`.

A full URL was chosen over a bare token because detectors usually key on `sig=` together with the other SAS parameters or the `blob.core.windows.net` host, and the URL is how SAS values usually leak (in logs, scripts and chat). It's still one column in tables.

| Mode | Rule |
|---|---|
| Valid | `sig` decodes to 32 bytes (44 base64 characters, ending `%3D`), the length of an HMAC-SHA256 |
| Invalid | Same URL, but `sig` decodes to 24 bytes (32 characters, no padding). Rules that require a 43+ character signature, such as security-utilities SEC101/060, skip it |

Valid: `https://examplefiles8892.blob.core.windows.net/invoices/customers.json?sp=rw&st=2025-12-15T03:11:43Z&se=2025-12-16T03:11:43Z&spr=https&sv=2022-11-02&sr=b&sig=0JskvZKx…%3D`

Invalid: `https://examplereports8927.blob.core.windows.net/invoices/db/backup-01.bak?sp=racwd&st=2025-10-23T09:40:40Z&se=2025-10-23T17:40:40Z&spr=https&sv=2022-11-02&sr=b&sig=JL2SsUjBLxgoujJkrKONCy8GgnLqL1Do`

**Why it can't work:** the signature is random rather than computed from a real account key, the account is invented, and the expiry has passed.

### `gcp_api_key` — Google Cloud API key

`AIza` followed by 35 characters from letters, digits, `-` and `_`, 39 characters in all, as in Google's documentation and Purview's Google API key type. Generated keys start `AIzaSy`, like the example in Google's API key docs. Google publishes no checksum, so both modes generate the same way.

Example: `AIzaSy4xGWK1…`

**Context:** the `AIza` prefix and fixed length make it detectable alone.

**Why it can't work:** the 33 characters after `AIzaSy` are random and belong to no project.

### `jwt` — JSON Web Token ✓

A compact JWS: three base64url segments joined by dots.

- Header: always `{"alg":"HS256","typ":"JWT"}`, so every token starts `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.`
- Payload: synthetic claims, for example:

  ```json
  {"iss":"https://auth.example.com","sub":"user-403181","aud":"api.example.org","iat":1737678565,"exp":1737682165,"jti":"4d6685c5bccb466f"}
  ```

  The issuer and audience use reserved example domains, `sub` is a random user number, and there's no personal data. `iat` is a time in 2025 from a fixed window (not the current time), and `exp` is one hour later, so every token is reproducible and already expired.
- Signature: 32 random bytes in base64url (43 characters).

| Mode | Rule |
|---|---|
| Valid | Three segments; the header and payload decode to JSON objects |
| Invalid | The signature segment is missing (`header.payload`), so it isn't a valid JWS; both remaining segments still decode |

Valid `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3Mi….E81hEf1S…` · Invalid `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3Mi…` (no third segment)

"Valid" means well-formed, not trusted. The signature is random, so it doesn't verify against any key.

**Context:** the three-segment `eyJ… . eyJ… . …` shape is distinctive alone.

### `bearer_token` — HTTP bearer token header

A complete header line, `Authorization: Bearer <token>`. The token is opaque, 32 to 48 characters long, starts with a letter or digit, and then uses letters, digits and `- . _ ~` (a subset of the RFC 6750 `b64token` syntax). It's deliberately not a JWT; use `jwt` for that.

The value includes `Authorization: Bearer` because generic bearer rules, such as security-utilities SEC101/061, match the header, not a bare token. A random string alone isn't recognizable as a credential.

Example: `Authorization: Bearer khn1NlVf…`

There's no structural rule to break, so both modes generate the same way.

**Why it can't work:** the token is random and issued by no server.

---

## Network

### `ipv4` — IPv4 address

Dotted quad: first octet 1 to 223, middle octets 0 to 255, last octet 1 to 254. Addresses aren't limited to private or documentation ranges, so they may be real public addresses (or private ones such as `10.x.x.x`).

Example: `32.100.77.26`

### `mac` — MAC address

Six pairs of uppercase hex digits separated by colons. Random, so the vendor prefix isn't a real one.

Example: `8C:02:73:36:A4:EC`

### `username` — Username

Lowercase: the first letter of the row's first name, the last name and a number from 1 to 99.

Example: `pwhite54` (Patricia White)

---

## Presets

| Preset | Label | Fields |
|---|---|---|
| `pii` | PII basics | `full_name`, `dob`, `email`, `phone`, `street`, `city`, `state`, `zip`, `ssn` |
| `pci` | PCI (cards) | `full_name`, `cc_number`, `cc_brand`, `cc_expiry`, `cc_cvv`, `zip` |
| `phi` | HIPAA / PHI | `full_name`, `dob`, `ssn`, `mrn`, `icd10`, `diagnosis`, `medication`, `insurer`, `member_id`, `npi` |
| `banking` | Banking | `full_name`, `aba_routing`, `bank_account`, `iban`, `swift_bic` |
| `gov` | Government IDs | `full_name`, `ssn`, `itin`, `drivers_license`, `passport_us`, `uk_nino`, `ca_sin` |
| `secrets` | Secrets & keys | `username`, `password`, `aws_access_key_id`, `aws_secret_key`, `github_pat`, `slack_token`, `stripe_key` |
| `cloud_secrets` | Cloud secrets & tokens | `aws_access_key_id`, `aws_secret_key`, `github_pat`, `entra_client_secret`, `azure_devops_pat`, `azure_storage_key`, `azure_storage_connection_string`, `azure_service_bus_connection_string`, `azure_sas`, `gcp_api_key`, `jwt`, `bearer_token` |

`pii` is the default when neither `fields` nor `preset` is given.

`secrets` is unchanged from before Secrets v2, so existing seeds keep producing the same data. `cloud_secrets` covers cloud and token credentials: every Secrets v2 field plus the AWS and GitHub fields. A `cloud_secrets` row is about 1 KB of text and the connection strings and SAS URL are long, so expect wide columns in CSV and XLSX; TXT, DOCX and PDF put each value on its own labelled line.

## Consistency within a row

Some fields share one underlying value per row, so they always agree:

| Shared value | Fields that use it |
|---|---|
| Person's name | `full_name`, `first_name`, `last_name`, `email`, `username`, the second letter of `dea` |
| Place (city) | `city`, `state`, `zip` prefix, `phone` area code, `drivers_license` format |
| Card | `cc_number`, `cc_brand`, `cc_cvv` length |
| Diagnosis | `icd10`, `diagnosis` |
| Azure Storage account | `azure_storage_key`, the account and key in `azure_storage_connection_string`, the account in `azure_sas` |

Everything else is independent: `gender` doesn't follow the name, `medication` doesn't follow the diagnosis, and rows don't relate to each other.

## Source lists

Defined in [`src/lib/data.ts`](../src/lib/data.ts).

| List | Size | Contents |
|---|---|---|
| First names | 72 | Common US given names, with some gender-neutral and international names |
| Last names | 56 | Common US surnames, including Nguyen, Patel, Kim, Chen, Singh, Okafor, Kowalski |
| Places | 30 | New York, Buffalo, Los Angeles, San Diego, San Jose, Chicago, Houston, Austin, Dallas, Phoenix, Philadelphia, Pittsburgh, Jacksonville, Miami, Tampa, Columbus, Charlotte, Seattle, Denver, Boston, Nashville, Portland, Atlanta, Minneapolis, Detroit, Baltimore, Milwaukee, Salt Lake City, Las Vegas, Richmond. Each has its state, a ZIP prefix and its area codes. |
| Street names | 24 | Main, Oak, Pine, Maple, Washington, Lincoln and similar |
| ICD-10 codes | 20 | Common and sensitive diagnoses with their descriptions |
| Medications | 12 | Common prescriptions with doses |
| Insurers | 8 | Large US payers, Medicare and Medicaid |
| Email domains | 3 | `example.com`, `example.org`, `example.net` |

Names and places are combined at random, so a generated person is unlikely to match a real one, but a name, city and number could coincide with one by chance.

## Testing tips

- **True positives:** use valid mode and check that every record is detected. Rules that validate checksums (cards, IBANs, ABA numbers, NPIs and so on) should match all of them.
- **False positives:** use invalid mode with the same fields. A rule that validates checksums should match none of the ✓ fields. If it still matches, it's using the pattern alone.
- **Keyword proximity:** many rules need a keyword such as "SSN" or "card" near the number. CSV and JSON put the field name only in the header or key; TXT, DOCX and PDF put the label (`SSN: 007-83-9774`) next to every value.
- **Instance counts:** policies often trigger only above a number of matches (for example, 10 or more card numbers). Set `rows` above and below the threshold to test both sides.
- **File types:** generate the same seed in several formats to check that each file type is inspected; the values are identical across formats.
- **Regression tests:** fix the seed in automated tests, so a change in detection points to the rule, not the data.
- **Secret scanning:** run `cloud_secrets` in valid mode and every provider-aware scanner rule should fire. In near-miss mode, rules that check a checksum, length or signature (Azure DevOps, Azure Storage, Service Bus, Entra, SAS, JWT) should stay quiet, while the AWS, GitHub, Google and bearer values are generated the same way in both modes. Test push protection in a throwaway repository, never a real one.
- **Context-dependent secrets:** `aws_secret_key` and `azure_storage_key` look like long random strings. Test them bare (CSV) and labelled (TXT, DOCX, PDF) to see whether your rules need context; `azure_storage_connection_string` carries `AccountKey=` context in every format.
