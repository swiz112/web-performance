// import 'chromium' to use Playwright's browser management features
import { test, chromium } from '@playwright/test';
import playwright from 'playwright-core';
import lighthouse from 'lighthouse';
import { URL } from 'url';
import fs from 'fs';
import xlsx from 'xlsx';
import { initializeExcel, appendToExcel } from './excel-report.js';

function getFormattedDateTime() {
  const date = new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}


// The single test block below has been replaced by a more robust structure.
// New hooks and variables are defined here to manage the browser and test execution.
let browser;
let context;
if (!global.resultsDir) {
  const dateTime = getFormattedDateTime();
  global.resultsDir = `results/${dateTime}`;
}
const resultsDir = global.resultsDir;

// `beforeAll` to set up the browser and results directory once.
test.beforeAll(async () => {
  fs.mkdirSync(resultsDir, { recursive: true });
  browser = await chromium.launch({
    args: ['--remote-debugging-port=9222'],
  });
  context = await browser.newContext();
  initializeExcel(resultsDir);
});

// `afterAll` to cleanly close the browser after all tests are done.
test.afterAll(async () => {
  await context.close();
  await browser.close();
});

// URL reading is now done once, outside of any test.
const workbook = xlsx.readFile('test-url.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const urls = xlsx.utils.sheet_to_json(worksheet, { header: 1 })
  .map(row => row[0])
  .filter(url => url && typeof url === 'string' && url.startsWith('http'));

// A loop is now used to dynamically create a separate test for each URL.
if (urls.length === 0) {
  console.log('No URLs found in test-url.xlsx. Skipping tests.');
  test('No URLs found', () => {
    test.skip(true, 'No URLs were found in the excel file.');
  });
} else {
  for (const url of urls) {
    test(`Performance test for ${url}`, async () => {
      // Timeout for better control.
      test.setTimeout(120000);
      const page = await context.newPage();
      let response;
      // NOTE: The logic below is the same as the original, but now runs isolated for each test.
      try {
        response = await page.goto(url, { waitUntil: 'domcontentloaded' });
        console.log(`Running performance tests for: ${url}`);
        const urlObject = new URL(url);
        const domain = urlObject.hostname.replace(/www\./g, '');

        const desktopResult = await lighthouse(url, {
          port: 9222, output: ['html', 'json'], logLevel: 'info', formFactor: 'desktop',
          screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
        });
        const desktopHtml = desktopResult.report[0];
        const desktopLhr = desktopResult.lhr;

        const mobileResult = await lighthouse(url, {
          port: 9222, output: 'html', logLevel: 'info', formFactor: 'mobile',
          screenEmulation: { mobile: true, width: 412, height: 915, deviceScaleFactor: 2.625, disabled: false },
        });
        const mobileHtml = mobileResult.report;

        const combinedHtml = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Performance Report for ${domain}</title>
            <style>
              body { font-family: sans-serif; margin: 0; }
              .tabs { display: flex; background: #333; }
              .tab { flex: 1; padding: 12px; text-align: center; cursor: pointer; color: #fff; background: #444; }
              .tab.active { background: #007bff; }
              .content { display: none; padding: 0; }
              .content.active { display: block; }
              iframe { width: 100%; height: 95vh; border: none; }
            </style>
          </head>
          <body>
            <div class="tabs">
              <div class="tab active" onclick="showTab('desktop', this)">Desktop</div>
              <div class="tab" onclick="showTab('mobile', this)">Mobile</div>
            </div>
            <div id="desktop" class="content active">
              <iframe srcdoc='${desktopHtml.replace(/'/g, "&apos;")}'></iframe>
            </div>
            <div id="mobile" class="content">
              <iframe srcdoc='${mobileHtml.replace(/'/g, "&apos;")}'></iframe>
            </div>
            <script>
              function showTab(id, element) {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
                element.classList.add('active');
                document.getElementById(id).classList.add('active');
              }
            </script>
          </body>
          </html>
        `;
        const reportPath = `${resultsDir}/${domain}.html`;
        fs.writeFileSync(reportPath, combinedHtml);
        console.log(`Combined desktop+mobile report saved: ${reportPath}`);

        const now = getFormattedDateTime();
        const websiteName = domain;
        const testUrl = url;
        const redirectedUrl = desktopLhr.finalUrl;
        const fcp = desktopLhr.audits['first-contentful-paint'].displayValue;
        const tbt = desktopLhr.audits['total-blocking-time'].displayValue;
        const lcp = desktopLhr.audits['largest-contentful-paint'].displayValue;
        const cls = desktopLhr.audits['cumulative-layout-shift'].displayValue;
        const si = desktopLhr.audits['speed-index'].displayValue;
        const overallPerformanceScore = desktopLhr.categories.performance.score * 100;
        const websiteLoadTime = desktopLhr.audits['interactive'].displayValue;

        const data = [
            now,
            websiteName,
            testUrl,
            redirectedUrl,
            response.status(),
            '',
            fcp,
            tbt,
            lcp,
            cls,
            si,
            overallPerformanceScore,
            websiteLoadTime
        ];
        appendToExcel(data, resultsDir);

      } catch (error) {
        console.error(`Failed to test ${url}:`, error);
        const now = getFormattedDateTime();
        let websiteName;
        try {
          websiteName = new URL(url).hostname.replace(/www\./g, '');
        } catch (e) {
          websiteName = url;
        }
        const data = [
            now,
            websiteName,
            url,
            '',
            response ? response.status() : '',
            error.message,
            '',
            '',
            '',
            '',
            '',
            '',
            ''
        ];
        appendToExcel(data, resultsDir);
      } finally {
        await page.close();
      }
    });
  }
}
