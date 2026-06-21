# sci-fetch

A [Claude Code](https://claude.com/claude-code) skill that builds a **local
corpus of open-access scientific papers** for a topic: it searches
[OpenAlex](https://openalex.org) (free, no API key), downloads the legal
open-access PDFs to a folder, and writes a manifest.

It's the legal, native companion to
[storm-article](https://github.com/oscolv/storm-article): `sci-fetch` collects
the papers, `storm-article --refs` cites them at full text — closing the
"paywalled Q1" gap without shadow libraries.

```
sci-fetch "CRISPR base editing" --from-year 2018 --out ~/crispr-corpus
storm-article "CRISPR base editing" --sources academic --refs ~/crispr-corpus
```

## Requirements

- **Node.js ≥ 18** (uses the built-in global `fetch`). No other dependencies.
- No API key, no login. (`--email` is optional — see below.)

## Install

```bash
git clone https://github.com/oscolv/sci-fetch.git ~/.claude/skills/sci-fetch
```

Claude Code discovers the skill automatically; invoke it with `/sci-fetch`. You
can also run the downloader directly:

```bash
node ~/.claude/skills/sci-fetch/fetch.mjs "your topic" --out ./sci-corpus
```

## Usage

```
/sci-fetch <query> [--limit N] [--from-year YYYY] [--out <dir>] [--email <addr>]
```

| Option | Default | Description |
|---|---|---|
| `<query>` | — | Research topic / search terms (required). |
| `--limit` | 15 | Max results to fetch. |
| `--from-year` | none | Only papers from this year onward. |
| `--out` | `./sci-corpus` | Output folder. |
| `--email` | none | Optional OpenAlex "polite pool" email (also env `OPENALEX_MAILTO`). Not required. |

## Output

In the output folder:

| File | Contents |
|---|---|
| `*.pdf` | The downloaded open-access papers (`<year>-<author>-<title>.pdf`) |
| `manifest.json` | Machine-readable list of downloaded + skipped works with metadata |
| `corpus.md` | Human-readable index, including non-OA results listed with DOI/link |

## Open access only

This skill downloads **only legally open-access** PDFs (resolved by OpenAlex).
Results without an open-access PDF are **listed with their DOI and link** so you
can obtain them through your institution — they are never downloaded from
shadow libraries such as Sci-Hub.

**Yield depends on the field.** Papers on arXiv / PubMed Central / institutional
repositories expose a directly downloadable PDF and are fetched reliably (a
CS/physics/math query typically yields most results). Some publisher-hosted
open-access papers only expose an HTML landing page behind their PDF link; those
are skipped (not saved as junk) and listed in `corpus.md` with their DOI. The
downloader tries every candidate URL OpenAlex reports, plus derived arXiv PDFs,
before giving up on a paper.

## Tests

```bash
node --test ~/.claude/skills/sci-fetch/tests/*.test.js
```

## License

[MIT](LICENSE) © 2026 Oscar Olvera Neria
