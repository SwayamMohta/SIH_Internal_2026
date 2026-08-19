const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = 'https://prgi.gov.in/registration-title-details';
const OUT_DIR = path.resolve('prgi_chunks');
const MERGED_CSV = path.resolve('prgi_registered_titles.csv');
const MAX_PAGES = Number.parseInt(process.env.MAX_PAGES || '', 10) || null;
const START_PAGE = Number.parseInt(process.env.START_PAGE || '0', 10);
const PAGE_SIZE = 500;

function pageUrl(pageIndex) {
  const params = new URLSearchParams({
    title_name: '',
    registration_number: '',
    owner_name: '',
    pub_state_name: '',
    pub_dist_name: '',
    languages: '',
    items_per_page: String(PAGE_SIZE),
    page: String(pageIndex),
  });
  return `${BASE_URL}?${params.toString()}`;
}

function chunkPath(pageIndex) {
  return path.join(OUT_DIR, `page_${String(pageIndex + 1).padStart(3, '0')}.csv`);
}

async function detectLastPage(page) {
  await page.goto(pageUrl(0), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForLoadState('networkidle', { timeout: 120000 }).catch(() => {});
  await page.waitForSelector('table tbody tr', { timeout: 120000 });
  await page.waitForSelector('button.buttons-csv', { timeout: 120000 });
  await page.waitForFunction(() => {
    return [...document.links]
      .filter(a => a.href.includes('registration-title-details') && a.href.includes('page='))
      .some(a => /Last/i.test(a.textContent || '') || Number.parseInt(new URL(a.href).searchParams.get('page') || '', 10) > 0);
  }, undefined, { timeout: 120000 });

  return await page.evaluate(() => {
    const pageValues = [...document.links]
      .filter(a => a.href.includes('registration-title-details') && a.href.includes('page='))
      .map(a => new URL(a.href).searchParams.get('page'))
      .map(value => Number.parseInt(value || '', 10))
      .filter(Number.isFinite);
    return Math.max(...pageValues, 0);
  });
}

async function downloadPageCsv(page, pageIndex) {
  const target = chunkPath(pageIndex);
  if (fs.existsSync(target) && fs.statSync(target).size > 0) {
    return { skipped: true, rows: null, target };
  }

  await page.goto(pageUrl(pageIndex), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('table tbody tr', { timeout: 120000 });
  await page.waitForSelector('button.buttons-csv', { timeout: 120000 });

  const rows = await page.locator('table tbody tr').count();
  const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
  await page.locator('button.buttons-csv').click();
  const download = await downloadPromise;
  await download.saveAs(target);

  return { skipped: false, rows, target };
}

function mergeCsvChunks(totalPages) {
  let header = null;
  let mergedRows = 0;
  const output = fs.createWriteStream(MERGED_CSV, { encoding: 'utf8' });

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    const file = chunkPath(pageIndex);
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
      throw new Error(`Missing chunk: ${file}`);
    }

    const lines = fs.readFileSync(file, 'utf8')
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/);
    const fileHeader = lines.shift();
    if (!fileHeader) continue;

    if (header === null) {
      header = fileHeader;
      output.write(`${header}\n`);
    } else if (fileHeader !== header) {
      throw new Error(`Header mismatch in ${file}`);
    }

    for (const line of lines) {
      if (!line.trim()) continue;
      output.write(`${line}\n`);
      mergedRows += 1;
    }
  }

  output.end();
  return mergedRows;
}

async function withRetries(fn, label, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`${label} failed on attempt ${attempt}/${maxAttempts}: ${error.message}`);
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, attempt * 3000));
      }
    }
  }
  throw lastError;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true, ignoreHTTPSErrors: true });
  const page = await context.newPage();

  await page.route('**/*', route => {
    const resourceType = route.request().resourceType();
    if (['font', 'image', 'media', 'stylesheet'].includes(resourceType)) {
      return route.abort();
    }
    return route.continue();
  });

  try {
    const lastPage = await withRetries(() => detectLastPage(page), 'detect last page');
    const availablePages = lastPage + 1;
    const totalPages = MAX_PAGES ? Math.min(MAX_PAGES, availablePages - START_PAGE) : availablePages - START_PAGE;
    console.log(`Detected ${availablePages} pages at ${PAGE_SIZE} rows/page. Downloading ${totalPages} pages from zero-based page ${START_PAGE}.`);

    for (let offset = 0; offset < totalPages; offset += 1) {
      const pageIndex = START_PAGE + offset;
      const result = await withRetries(() => downloadPageCsv(page, pageIndex), `page ${pageIndex + 1}`);
      const action = result.skipped ? 'skipped' : 'saved';
      const rowText = result.rows === null ? '' : ` (${result.rows} visible rows)`;
      console.log(`${String(offset + 1).padStart(3, '0')}/${String(totalPages).padStart(3, '0')} ${action} ${path.relative(process.cwd(), result.target)}${rowText}`);
    }

    const mergedRows = mergeCsvChunks(START_PAGE + totalPages);
    console.log(`Merged ${mergedRows} rows into ${MERGED_CSV}`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
