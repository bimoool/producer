#!/usr/bin/env node
'use strict';

// Authorized production smoke: never changes form values, marks a report sent,
// copies a report, or follows third-party browser requests. The caller must
// create and revoke a short-lived owner session around this command.
const { createHash } = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const BASE_URL = process.env.BASE_URL || 'https://producer.bimoool.com';
const TOKEN = process.env.PRODUCER_SESSION_TOKEN;
const REPORT_DATE = '2026-11-13';
const HISTORY_ID = 'b62821db-b04b-4905-9f3a-8c9ad9e5d792';
let stage = 'configuration';
let browser;

function requireCheck(condition, code) {
  if (!condition) throw new Error(code);
}

// Compare values in memory through hashes so assertion failures cannot print
// personal report text into public GitHub Actions logs.
async function fieldDigest(page) {
  const fields = await page.locator('textarea, input:not([type="hidden"]), select, [role="checkbox"], [role="radio"]').evaluateAll((elements) => elements
    .filter((el) => el.id !== 'report-date' && !el.closest('form[action="/reports/new"]'))
    .map((el) => ({
      tag: el.tagName,
      type: el.getAttribute('type'),
      id: el.id,
      name: el.getAttribute('name'),
      label: el.getAttribute('aria-label'),
      role: el.getAttribute('role'),
      value: 'value' in el ? el.value : null,
      checked: 'checked' in el ? el.checked : el.getAttribute('aria-checked'),
    })));
  return createHash('sha256').update(JSON.stringify(fields)).digest('hex');
}

async function metadataDigest(page) {
  const text = await page.locator('[data-slot="card-description"]').allTextContents();
  const dates = text.filter((value) => value.includes('Отчётная дата:'));
  return createHash('sha256').update(JSON.stringify(dates)).digest('hex');
}

async function navigate(page, path) {
  const response = await page.goto(new URL(path, BASE_URL).href, { waitUntil: 'networkidle' });
  requireCheck(response && response.status() === 200, 'HTTP_NOT_200');
  requireCheck(new URL(page.url()).pathname !== '/login', 'SESSION_NOT_ACCEPTED');
}

(async () => {
  const origin = new URL(BASE_URL);
  requireCheck(Boolean(TOKEN), 'MISSING_SESSION');
  requireCheck(origin.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(origin.hostname), 'HTTPS_REQUIRED');
  const childEnv = { ...process.env };
  delete childEnv.PRODUCER_SESSION_TOKEN;
  browser = await chromium.launch({
    headless: true,
    env: childEnv,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
  });
  const context = await browser.newContext();
  context.setDefaultTimeout(30000);
  const browserErrors = [];
  const blockedHosts = new Set();
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin.origin) {
      blockedHosts.add(url.hostname);
      return route.abort();
    }
    return route.continue();
  });
  await context.addCookies([{
    name: '__Host-gt_session', value: TOKEN, domain: origin.hostname,
    path: '/', secure: true, httpOnly: true, sameSite: 'Lax',
  }]);
  const page = await context.newPage();
  page.on('pageerror', () => browserErrors.push(true));

  stage = 'reports_list';
  await navigate(page, '/reports');
  await page.getByText('Актуальная неделя', { exact: false }).first().waitFor();

  stage = 'selected_report';
  await navigate(page, `/reports/new?date=${REPORT_DATE}`);
  const unsaved = new URL(page.url()).pathname === '/reports/new';
  let savedNewDraft = false;
  const editable = await page.getByLabel('Фокус', { exact: true }).count() > 0;
  if (editable) {
    const before = await fieldDigest(page);
    const datesBefore = await metadataDigest(page);
    if (unsaved) {
      const descriptions = (await page.locator('[data-slot="card-description"]').allTextContents()).join('\n');
      requireCheck(descriptions.includes('Отчётная дата: 13.11.2026'), 'INCORRECT_REPORT_DATE');
      requireCheck(descriptions.includes('09.11.2026–13.11.2026'), 'INCORRECT_COVERAGE');
      requireCheck(descriptions.includes('дата среза: 12.11.2026'), 'INCORRECT_INITIAL_CUTOFF');
    }
    const descriptions = (await page.locator('[data-slot="card-description"]').allTextContents()).join('\n');
    const isFinal = !unsaved && descriptions.includes('· готов');
    // Preserve an existing final without changing its status or timestamps.
    if (!isFinal) {
      stage = 'draft_save';
      await page.getByRole('button', { name: 'Сохранить черновик', exact: true }).click();
      await page.getByText('Черновик сохранён', { exact: true }).waitFor();
      await page.waitForURL(/\/reports\/[0-9a-f-]{36}$/);
      savedNewDraft = unsaved;
    }
    const savedUrl = page.url();
    requireCheck(/\/reports\/[0-9a-f-]{36}$/.test(new URL(savedUrl).pathname), 'MISSING_SAVED_ID');
    stage = 'same_record_reopen';
    await navigate(page, `/reports/new?date=${REPORT_DATE}`);
    requireCheck(page.url() === savedUrl, 'REOPENED_DIFFERENT_RECORD');
    await page.getByLabel('Фокус', { exact: true }).waitFor();
    requireCheck(await fieldDigest(page) === before, 'SAVED_FIELDS_CHANGED');
    requireCheck(await metadataDigest(page) === datesBefore, 'SAVED_DATES_CHANGED');
  } else {
    // If another writer already sent this date, keep it immutable.
    requireCheck(!unsaved, 'MISSING_REPORT_EDITOR');
    await page.getByText('Отправлен', { exact: false }).first().waitFor();
    requireCheck(await page.getByRole('button', { name: 'Сохранить черновик', exact: true }).count() === 0, 'SENT_IS_EDITABLE');
  }
  const reportUrl = page.url();

  stage = 'historical_sent_report';
  await navigate(page, `/reports/${HISTORY_ID}`);
  await page.getByText('не изменяется', { exact: false }).first().waitFor();
  requireCheck(await page.getByRole('button', { name: 'Сохранить черновик', exact: true }).count() === 0, 'HISTORY_IS_EDITABLE');
  requireCheck(await page.getByRole('button', { name: 'Отчёт готов', exact: true }).count() === 0, 'HISTORY_CAN_FINALIZE');

  stage = 'other_sections';
  const sections = ['/', '/tasks', '/goals', '/declaration', '/finance', '/projects'];
  for (const section of sections) await navigate(page, section);
  requireCheck(browserErrors.length === 0, 'BROWSER_ERROR');
  requireCheck(blockedHosts.size === 0, 'UNEXPECTED_THIRD_PARTY_REQUEST');
  console.log(JSON.stringify({ status: 'PASS', reportUrl, savedNewDraft, sections: sections.length }));
})().catch(() => {
  // Never print an exception, locator dump, screenshot, field values or token.
  console.error(JSON.stringify({ status: 'FAIL', stage }));
  process.exitCode = 1;
}).finally(async () => {
  if (browser) await browser.close();
});
