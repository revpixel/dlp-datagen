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
| `ipv4` | IPv4 address | Network | | `55.127.90.220` |
| `mac` | MAC address | Network | | `0D:8E:85:A1:A1:C4` |
| `username` | Username | Network | | `pwhite89` |

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

These match the patterns DLP and secret scanners look for. None is a working credential. Real GitHub tokens end with a checksum, so scanners that check it, or that test credentials against the provider, won't treat these as live. Secrets don't have a valid/invalid difference.

Some examples below are shortened (`…`). The full values match secret-scanning patterns closely enough that GitHub push protection blocks them from this repository, which is the point of the generator but not of its documentation. Generate a full value with, for example, `/api/generate?preset=secrets&rows=1`.

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

---

## Network

### `ipv4` — IPv4 address

Dotted quad: first octet 1 to 223, middle octets 0 to 255, last octet 1 to 254. Addresses aren't limited to private or documentation ranges, so they may be real public addresses (or private ones such as `10.x.x.x`).

Example: `55.127.90.220`

### `mac` — MAC address

Six pairs of uppercase hex digits separated by colons. Random, so the vendor prefix isn't a real one.

Example: `0D:8E:85:A1:A1:C4`

### `username` — Username

Lowercase: the first letter of the row's first name, the last name and a number from 1 to 99.

Example: `pwhite89` (Patricia White)

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

`pii` is the default when neither `fields` nor `preset` is given.

## Consistency within a row

Some fields share one underlying value per row, so they always agree:

| Shared value | Fields that use it |
|---|---|
| Person's name | `full_name`, `first_name`, `last_name`, `email`, `username`, the second letter of `dea` |
| Place (city) | `city`, `state`, `zip` prefix, `phone` area code, `drivers_license` format |
| Card | `cc_number`, `cc_brand`, `cc_cvv` length |
| Diagnosis | `icd10`, `diagnosis` |

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
