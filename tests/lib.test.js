const { test } = require('node:test');
const assert = require('node:assert');
// fetch.mjs runs as a normal Node process (not the Workflow sandbox), so the
// pure logic lives in an importable module and is tested directly.
let lib;
test.before(async () => { lib = await import('../lib.mjs'); });

test('slugify makes safe filename stems', () => {
  assert.equal(lib.slugify('CRISPR/Cas9: a "review"!'), 'crispr_cas9_a_review');
  assert.equal(lib.slugify('  Édge  cases '), 'edge_cases'); // accents transliterated (É→e)
});

test('buildSearchUrl builds an OpenAlex query with OA filter', () => {
  const u = lib.buildSearchUrl('base editing', { perPage: 15, fromYear: 2020 });
  assert.match(u, /^https:\/\/api\.openalex\.org\/works\?/);
  assert.match(u, /search=base\+editing|search=base%20editing/);
  assert.match(u, /open_access\.is_oa%3Atrue|open_access\.is_oa:true/);
  assert.match(u, /from_publication_date%3A2020-01-01|from_publication_date:2020-01-01/);
  assert.match(u, /per-page=15/);
  assert.ok(!/mailto=/.test(u), 'no mailto unless provided');
});

test('buildSearchUrl adds mailto only when given', () => {
  const u = lib.buildSearchUrl('x', { mailto: 'a@b.edu' });
  assert.match(u, /mailto=a%40b\.edu/);
});

test('normalizeDoi strips the URL prefix', () => {
  assert.equal(lib.normalizeDoi('https://doi.org/10.1/AbC'), '10.1/abc');
  assert.equal(lib.normalizeDoi('10.1/xyz'), '10.1/xyz');
  assert.equal(lib.normalizeDoi(null), '');
});

const WORK = {
  id: 'https://openalex.org/W123',
  doi: 'https://doi.org/10.1038/s41586-020-2649-2',
  display_name: 'Array programming with NumPy',
  publication_year: 2020,
  primary_location: { source: { display_name: 'Nature' }, pdf_url: null },
  best_oa_location: { pdf_url: 'https://www.nature.com/articles/x.pdf' },
  open_access: { is_oa: true, oa_url: 'https://www.nature.com/articles/x' },
  authorships: [
    { author: { display_name: 'Charles Harris' } },
    { author: { display_name: 'K. Millman' } },
  ],
};

test('mapWork normalizes an OpenAlex work', () => {
  const w = lib.mapWork(WORK);
  assert.equal(w.title, 'Array programming with NumPy');
  assert.equal(w.doi, '10.1038/s41586-020-2649-2');
  assert.equal(w.year, 2020);
  assert.equal(w.venue, 'Nature');
  assert.equal(w.isOA, true);
  assert.equal(w.firstAuthor, 'Charles Harris');
  assert.equal(w.pdfUrl, 'https://www.nature.com/articles/x.pdf');
});

test('pickPdfUrl prefers best_oa_location, then primary, then none', () => {
  assert.equal(lib.pickPdfUrl(WORK), 'https://www.nature.com/articles/x.pdf');
  assert.equal(lib.pickPdfUrl({ primary_location: { pdf_url: 'p.pdf' } }), 'p.pdf');
  assert.equal(lib.pickPdfUrl({ open_access: {} }), '');
});

test('filenameFor builds year-author-title.pdf', () => {
  assert.equal(lib.filenameFor(lib.mapWork(WORK)),
    '2020-harris-array_programming_with_numpy.pdf');
});

test('arxivPdfUrl derives a direct PDF from an arXiv landing page', () => {
  assert.equal(lib.arxivPdfUrl('https://arxiv.org/abs/2401.01234'), 'https://arxiv.org/pdf/2401.01234.pdf');
  assert.equal(lib.arxivPdfUrl('http://arxiv.org/abs/1234.5678v2'), 'https://arxiv.org/pdf/1234.5678v2.pdf');
  assert.equal(lib.arxivPdfUrl('https://nature.com/x'), '');
});

test('pdfCandidates collects ordered, de-duplicated candidate URLs', () => {
  const work = {
    best_oa_location: { pdf_url: 'https://a.org/best.pdf', landing_page_url: null },
    primary_location: { pdf_url: null, landing_page_url: 'https://arxiv.org/abs/2401.01234' },
    locations: [
      { pdf_url: 'https://a.org/best.pdf' }, // dup of best
      { pdf_url: 'https://b.org/loc.pdf' },
      { pdf_url: null, landing_page_url: 'https://arxiv.org/abs/2401.01234' }, // -> arxiv pdf
    ],
    open_access: { oa_url: 'https://arxiv.org/abs/9999.0001' },
  };
  const c = lib.pdfCandidates(work);
  assert.equal(c[0], 'https://a.org/best.pdf');           // best first
  assert.ok(c.includes('https://b.org/loc.pdf'));
  assert.ok(c.includes('https://arxiv.org/pdf/2401.01234.pdf')); // derived
  assert.ok(c.includes('https://arxiv.org/pdf/9999.0001.pdf'));  // from oa_url
  assert.equal(new Set(c).size, c.length);                 // de-duplicated
});

test('looksLikePdf checks the %PDF magic bytes', () => {
  assert.equal(lib.looksLikePdf(Buffer.from('%PDF-1.7\n...')), true);
  assert.equal(lib.looksLikePdf(Buffer.from('<!DOCTYPE html>')), false);
});
