# Output formats

The generator writes the same records in seven formats. With a fixed seed, every format has the same values; only the layout differs. DLP engines often treat each file type differently (some only inspect Office documents, some extract PDF text, some check plain text), so test the formats your policies cover.

| Format | `format=` | File | Header | Labels next to values | Max rows (API) |
|---|---|---|---|---|---|
| [CSV](#csv) | `csv` | `.csv` | Field ids (optional) | No | 10,000 |
| [JSON](#json) | `json` | `.json` | Keys are field ids | No | 10,000 |
| [JSON Lines](#json-lines) | `ndjson` | `.jsonl` | Keys are field ids | No | 10,000 |
| [TXT](#txt) | `txt` | `.txt` | None | Yes | 10,000 |
| [Excel](#excel-xlsx) | `xlsx` | `.xlsx` | Field labels (optional) | No | 2,000 |
| [Word](#word-docx) | `docx` | `.docx` | None | Yes | 2,000 |
| [PDF](#pdf) | `pdf` | `.pdf` | None | Yes | 2,000 |

The web UI allows more rows because it generates in the browser: 100,000 for CSV, JSON, JSON Lines, TXT and XLSX, and 10,000 for DOCX and PDF.

All files are UTF-8 (the PDF is ASCII). Every generated value is plain ASCII, and only `private_key` contains line breaks. The examples below use `fields=full_name,ssn,cc_number&rows=2&seed=demo`.

See also: [field reference](fields.md) · [API reference](api.md)

## CSV

`text/csv; charset=utf-8`

```csv
full_name,ssn,cc_number
Casey Davis,050-43-2174,6011918456830360
Mark Hall,327-94-2340,377940508381953
```

- [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180) style: comma-separated, `CRLF` line endings, ending with a final `CRLF`.
- The header row lists field ids. `header=false` leaves it out.
- A value containing a comma, double quote or line break is wrapped in double quotes, with inner quotes doubled. In practice that's only `private_key`, which keeps its line breaks inside the quotes.
- Values are never quoted otherwise, so leading zeros survive in text tools. Spreadsheet apps may still drop them when opening a CSV directly; use XLSX if that matters.

## JSON

`application/json; charset=utf-8`

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

- An array of objects, one per record, pretty-printed with two-space indentation and a trailing newline.
- Keys are field ids in the requested order. Every value is a string.
- Line breaks in `private_key` are escaped as `\n`.
- If a field id is repeated in `fields`, only the last value is kept, because JSON keys must be unique.

## JSON Lines

`application/x-ndjson; charset=utf-8`, saved as `.jsonl`

```json
{"full_name":"Casey Davis","ssn":"050-43-2174","cc_number":"6011918456830360"}
{"full_name":"Mark Hall","ssn":"327-94-2340","cc_number":"377940508381953"}
```

- One compact JSON object per line, `LF` line endings, ending with a final newline. Objects are the same as in [JSON](#json).
- Good for streaming tools (`jq -c`, log pipelines, line-by-line ingestion).

## TXT

`text/plain; charset=utf-8`

```text
Record 1
Full name: Casey Davis
SSN: 050-43-2174
Credit card number: 6011918456830360

Record 2
Full name: Mark Hall
SSN: 327-94-2340
Credit card number: 377940508381953
```

- Labelled records: a `Record N` line, then one `Label: value` line per field. Records are separated by a blank line; `LF` line endings.
- Labels are the human-readable field labels (`SSN`, `Credit card number`), so keyword-proximity rules have a keyword next to every value.
- `private_key` is written as-is, so its PEM lines follow its label on their own lines.
- `header` is ignored.

## Excel (XLSX)

`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. Always sent as an attachment.

- One worksheet named **DLP test data**.
- Row 1 has the field labels in bold, frozen so it stays visible when scrolling. `header=false` removes it, and the data starts in row 1 with nothing frozen.
- One record per row, one field per column, in the requested order.
- Every cell is stored as text, so leading zeros and long digit strings (card numbers, routing numbers) stay exact instead of turning into numbers.
- Column widths fit the label and the first 200 values (up to 60 characters).
- `private_key` keeps its line breaks inside the cell.
- Written without dependencies by `src/lib/documents.ts`.

## Word (DOCX)

`application/vnd.openxmlformats-officedocument.wordprocessingml.document`. Always sent as an attachment.

- A **DLP test data** title, then the line "Synthetic records for data loss prevention testing. No real person's data."
- Each record starts with a bold **Record N** heading, kept on the same page as its first field.
- One paragraph per field: the label in bold, then the value (**SSN:** 050-43-2174).
- `private_key` keeps its line breaks.
- US Letter, 0.75-inch margins, Word's default font.
- `header` is ignored.

## PDF

`application/pdf`. Always sent as an attachment.

- PDF 1.4, US Letter, 0.75-inch margins.
- Real text using the standard PDF fonts (no embedded fonts, no images), so DLP engines and `pdftotext` can extract every value.
- Each page has a **DLP test data** title at the top and a footer: "Synthetic records for DLP testing. No real person's data. Page X of Y".
- Each record has a bold **Record N** heading (Helvetica Bold), kept on the same page as its first line, then one `Label: value` line per field in Courier 9.5 pt.
- Lines longer than 88 characters wrap onto the next line. Continuation lines of `private_key` are indented two spaces.
- The document title in the file's properties is "DLP test data".
- `header` is ignored.

No current field produces a line that long, so values are never split across lines. Text extraction can still join or split lines differently from the layout, depending on the extractor.

## Determinism

With a fixed seed, XLSX, DOCX and PDF files are byte-identical on every run (the timestamps inside XLSX and DOCX are fixed at 1980-01-01), so you can compare them by hash. See [Repeatable output](api.md#repeatable-output) for what changes the values.
