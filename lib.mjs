// Pure, side-effect-free helpers for sci-fetch. Imported by both fetch.mjs
// (the CLI) and the unit tests.

export function slugify(s) {
  return String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')   // drop combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function normalizeDoi(doi) {
  if (!doi) return '';
  return String(doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').toLowerCase();
}

// Build an OpenAlex /works query. OpenAlex needs no API key; `mailto` is
// OPTIONAL (it only opts into the faster "polite pool").
export function buildSearchUrl(query, opts = {}) {
  const perPage = Math.min(Math.max(opts.perPage || 15, 1), 200);
  const filters = ['open_access.is_oa:true'];
  if (opts.fromYear) filters.push(`from_publication_date:${opts.fromYear}-01-01`);
  const p = new URLSearchParams();
  p.set('search', query || '');
  p.set('filter', filters.join(','));
  p.set('per-page', String(perPage));
  p.set('sort', 'relevance_score:desc');
  if (opts.mailto) p.set('mailto', opts.mailto);
  // URLSearchParams encodes ':' as %3A and ',' as %2C; OpenAlex accepts both
  // encoded and raw, so leave the standard encoding.
  return `https://api.openalex.org/works?${p.toString()}`;
}

export function pickPdfUrl(work) {
  return (
    (work && work.best_oa_location && work.best_oa_location.pdf_url) ||
    (work && work.primary_location && work.primary_location.pdf_url) ||
    ''
  );
}

// arXiv landing/abs pages aren't PDFs, but the direct PDF is derivable.
export function arxivPdfUrl(url) {
  const m = String(url || '').match(/arxiv\.org\/(?:abs|pdf)\/([^\s?#]+?)(?:\.pdf)?$/i);
  return m ? `https://arxiv.org/pdf/${m[1]}.pdf` : '';
}

// Ordered, de-duplicated list of candidate PDF URLs to try (best first):
// best_oa_location, primary_location, every locations[] entry, plus arXiv PDFs
// derived from any landing page or the open-access url.
export function pdfCandidates(work) {
  const out = [];
  const push = (u) => { if (u && !out.includes(u)) out.push(u); };
  const fromLoc = (loc) => {
    if (!loc) return;
    push(loc.pdf_url);
    push(arxivPdfUrl(loc.landing_page_url));
  };
  fromLoc(work && work.best_oa_location);
  fromLoc(work && work.primary_location);
  for (const loc of (work && work.locations) || []) fromLoc(loc);
  push(arxivPdfUrl(work && work.open_access && work.open_access.oa_url));
  return out;
}

export function mapWork(work) {
  const authors = ((work && work.authorships) || [])
    .map((a) => a && a.author && a.author.display_name)
    .filter(Boolean);
  const venue =
    (work && work.primary_location && work.primary_location.source &&
      work.primary_location.source.display_name) || '';
  return {
    openAlexId: (work && work.id) || '',
    title: (work && (work.display_name || work.title)) || 'Untitled',
    doi: normalizeDoi(work && work.doi),
    year: (work && work.publication_year) || null,
    venue,
    authors,
    firstAuthor: authors[0] || '',
    isOA: !!(work && work.open_access && work.open_access.is_oa),
    oaUrl: (work && work.open_access && work.open_access.oa_url) || '',
    pdfUrl: pickPdfUrl(work),
    candidates: pdfCandidates(work),
  };
}

// year-firstauthorlastname-title.pdf (falls back to DOI / openAlexId)
export function filenameFor(w) {
  const year = w.year || 'nd';
  const last = w.firstAuthor ? w.firstAuthor.trim().split(/\s+/).pop() : '';
  const stem = slugify(w.title).slice(0, 60);
  const base = [year, slugify(last), stem].filter(Boolean).join('-');
  return `${base || slugify(w.doi) || 'paper'}.pdf`;
}

export function looksLikePdf(buf) {
  if (!buf || buf.length < 4) return false;
  return buf.slice(0, 4).toString('latin1') === '%PDF';
}
