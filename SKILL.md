---
name: sci-fetch
description: Build a local corpus of open-access scientific papers for a topic. Searches OpenAlex (free, no API key), downloads the legal open-access PDFs to a folder, and writes a manifest. Use when the user wants to collect papers / build a reference library on a research topic, especially to feed storm-article's --refs. Open-access only — never pirates paywalled papers.
---

# sci-fetch

Collect open-access scientific papers on a topic into a local folder, ready to
cite at full text.

## Invocation

`/sci-fetch <query> [--limit N] [--from-year YYYY] [--out <dir>] [--email <addr>]`

- `<query>`: the research topic / search terms (required).
- `--limit`: max results to fetch (default 15).
- `--from-year`: only papers published from this year onward (optional).
- `--out`: output folder (default `./sci-corpus`).
- `--email`: optional — opts into OpenAlex's faster "polite pool". Not required;
  also read from env `OPENALEX_MAILTO`.

## What to do

1. Parse `<query>` and options. If no query, ask for one and stop.
2. Run the bundled downloader (it needs network + filesystem, which a normal
   skill Bash call has):

   ```bash
   node <this skill dir>/fetch.mjs "<query>" [--limit N] [--from-year YYYY] [--out <dir>] [--email <addr>]
   ```

3. It writes into the output folder: the downloaded `*.pdf` files, a
   `manifest.json`, and a human-readable `corpus.md` index.
4. Report to the user: how many open-access PDFs were downloaded vs. how many
   results had no open-access PDF (those are listed with their DOI/link in
   `corpus.md` so the user can obtain them legally via their institution).

## Integration with storm-article

The output folder is a ready-made `--refs` corpus:

```
/sci-fetch "CRISPR base editing" --from-year 2018 --out ~/crispr-corpus
/storm-article "CRISPR base editing" --sources academic --refs ~/crispr-corpus
```

sci-fetch builds the legal full-text corpus; storm-article cites it.

## Notes

- Source: OpenAlex (`api.openalex.org`) — free, no API key, no login.
- **Open-access only.** Papers without a legal OA PDF are listed but never
  downloaded from shadow libraries. This skill does not use Sci-Hub.
- Requires Node.js ≥ 18 (uses the built-in global `fetch`).
