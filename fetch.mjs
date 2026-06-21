#!/usr/bin/env node
// sci-fetch — build a local corpus of OPEN-ACCESS scientific papers for a query.
// Searches OpenAlex (free, no key), downloads the legal OA PDFs, and writes a
// manifest. Non-open-access papers are listed (DOI + link) but never pirated.
//
// Usage:
//   node fetch.mjs "<query>" [--limit N] [--from-year YYYY] [--out DIR] [--email ADDR]
//
// No API keys. --email (or env OPENALEX_MAILTO) is optional: it only opts into
// OpenAlex's faster "polite pool".

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  buildSearchUrl, mapWork, filenameFor, looksLikePdf,
} from './lib.mjs';

function parseArgs(argv) {
  const a = { limit: 15, out: './sci-corpus', fromYear: null, email: process.env.OPENALEX_MAILTO || null, query: '' };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--limit') a.limit = parseInt(argv[++i], 10) || a.limit;
    else if (t === '--from-year') a.fromYear = parseInt(argv[++i], 10) || null;
    else if (t === '--out') a.out = argv[++i];
    else if (t === '--email') a.email = argv[++i];
    else rest.push(t);
  }
  a.query = rest.join(' ').trim();
  return a;
}

async function downloadPdf(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'sci-fetch/1.0 (+https://github.com/oscolv/sci-fetch)' },
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!looksLikePdf(buf)) throw new Error('not a PDF (likely an HTML landing page)');
  return buf;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.query) {
    console.error('Usage: node fetch.mjs "<query>" [--limit N] [--from-year YYYY] [--out DIR] [--email ADDR]');
    process.exit(2);
  }
  const outDir = resolve(args.out);
  await mkdir(outDir, { recursive: true });

  const url = buildSearchUrl(args.query, { perPage: args.limit, fromYear: args.fromYear, mailto: args.email });
  console.error(`[sci-fetch] querying OpenAlex: ${args.query} (limit ${args.limit}${args.fromYear ? `, from ${args.fromYear}` : ''})`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'sci-fetch/1.0 (+https://github.com/oscolv/sci-fetch)' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) { console.error(`[sci-fetch] OpenAlex error HTTP ${res.status}`); process.exit(1); }
  const works = ((await res.json()).results || []).map(mapWork);

  const downloaded = [];
  const skipped = [];   // OA-but-no-resolvable-pdf or every candidate failed
  for (const w of works) {
    const candidates = (w.candidates && w.candidates.length) ? w.candidates : (w.pdfUrl ? [w.pdfUrl] : []);
    if (!candidates.length) { skipped.push({ ...w, reason: 'no direct OA PDF url' }); continue; }
    const fname = filenameFor(w);
    let lastErr = '';
    let ok = false;
    for (const url of candidates) {
      try {
        const buf = await downloadPdf(url);
        await writeFile(join(outDir, fname), buf);
        downloaded.push({ ...w, file: fname, sizeBytes: buf.length, pdfFrom: url });
        console.error(`  ✓ ${fname} (${Math.round(buf.length / 1024)} KB)`);
        ok = true;
        break;
      } catch (e) {
        lastErr = e.message;
      }
    }
    if (!ok) {
      skipped.push({ ...w, reason: `download failed (${candidates.length} candidate(s)): ${lastErr}` });
      console.error(`  ✗ ${w.doi || w.title}: ${lastErr}`);
    }
  }

  const manifest = {
    query: args.query, generatedFrom: 'OpenAlex',
    counts: { found: works.length, downloaded: downloaded.length, skipped: skipped.length },
    downloaded, skipped,
  };
  await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const corpus = [
    `# sci-fetch corpus: ${args.query}`, '',
    `Open-access PDFs downloaded from OpenAlex. ${downloaded.length} of ${works.length} results.`, '',
    '## Downloaded', '',
    ...downloaded.map((w) => `- **${w.file}** — ${w.title} (${w.year || 'n.d.'}, ${w.venue || '—'})${w.doi ? ` · doi:${w.doi}` : ''}`),
    '', '## Not downloaded (no open-access PDF — get via your institution)', '',
    ...skipped.map((w) => `- ${w.title} (${w.year || 'n.d.'})${w.doi ? ` · doi:${w.doi}` : ''}${w.oaUrl ? ` · ${w.oaUrl}` : ''} — _${w.reason}_`),
    '',
  ].join('\n');
  await writeFile(join(outDir, 'corpus.md'), corpus);

  console.error(`[sci-fetch] done: ${downloaded.length} downloaded, ${skipped.length} skipped → ${outDir}`);
  console.log(JSON.stringify(manifest.counts));
}

main().catch((e) => { console.error(`[sci-fetch] fatal: ${e.message}`); process.exit(1); });
