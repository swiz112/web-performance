/*import { test } from '@playwright/test';
import playwright from 'playwright-core';
import lighthouse from 'lighthouse';
import { URL } from 'url';
import fs from 'fs';
import xlsx from 'xlsx';

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

test('Run performance tests for multiple URLs', async () => {
  test.setTimeout(120000);
  const workbook = xlsx.readFile('urls.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const urls = xlsx.utils.sheet_to_json(worksheet, { header: 1 }).map(row => row[0]).filter(url => url);

  if (urls.length === 0) {
    console.log('No URLs found in urls.xlsx');
    return;
  }

  const dateTime = getFormattedDateTime();
  const resultsDir = `results/${dateTime}`;
  fs.mkdirSync(resultsDir, { recursive: true });

  const browser = await playwright.chromium.launch({
    args: ['--remote-debugging-port=9222'],
  });

  for (const url of urls) {
    try {
      console.log(`Running performance test for: ${url}`);
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const runnerResult = await lighthouse(url, {
        port: 9222,
        output: 'html',
        logLevel: 'info',
      });

      if (runnerResult && runnerResult.report) {
        const reportHtml = runnerResult.report;
        const urlObject = new URL(url);
        const domain = urlObject.hostname.replace(/www./g, '');
        const reportPath = `${resultsDir}/${domain}.html`;

        fs.writeFileSync(reportPath, reportHtml);
        console.log(`Lighthouse report saved to ${reportPath}`);
      }
      await page.close();
    } catch (error) {
      console.error(`Failed to test ${url}:`, error);
    }
  }

  await browser.close();
});
*/
import { test } from '@playwright/test';
import playwright from 'playwright-core';
import lighthouse from 'lighthouse';
import { URL } from 'url';
import fs from 'fs';
import xlsx from 'xlsx';

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

test('Run desktop & mobile performance tests in one report', async () => {
  test.setTimeout(600000); // allow enough time

  // Read URLs from Excel
  const workbook = xlsx.readFile('urls.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const urls = xlsx.utils.sheet_to_json(worksheet, { header: 1 })
    .map(row => row[0])
    .filter(url => url);

  if (urls.length === 0) {
    console.log('No URLs found in urls.xlsx');
    return;
  }

  const dateTime = getFormattedDateTime();
  const resultsDir = `results/${dateTime}`;
  fs.mkdirSync(resultsDir, { recursive: true });

  const browser = await playwright.chromium.launch({
    args: ['--remote-debugging-port=9222'],
  });

  for (const url of urls) {
    try {
      console.log(`Running performance tests for: ${url}`);
      const urlObject = new URL(url);
      const domain = urlObject.hostname.replace(/www./g, '');

      // ---- Desktop Test ----
      const desktopResult = await lighthouse(url, {
        port: 9222,
        output: 'html',
        logLevel: 'info',
        formFactor: 'desktop',
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false,
        },
      });
      const desktopHtml = desktopResult.report;

      // ---- Mobile Test ----
      const mobileResult = await lighthouse(url, {
        port: 9222,
        output: 'html',
        logLevel: 'info',
        formFactor: 'mobile',
        screenEmulation: {
          mobile: true,
          width: 412,
          height: 915,
          deviceScaleFactor: 2.625,
          disabled: false,
        },
      });
      const mobileHtml = mobileResult.report;

      // ---- Combined Tabbed Report ----
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
            .tab {
              flex: 1;
              padding: 12px;
              text-align: center;
              cursor: pointer;
              color: #fff;
              background: #444;
            }
            .tab.active { background: #007bff; }
            .content { display: none; padding: 0; }
            .content.active { display: block; }
            iframe { width: 100%; height: 95vh; border: none; }
          </style>
        </head>
        <body>
          <div class="tabs">
            <div class="tab active" onclick="showTab('desktop')">Desktop</div>
            <div class="tab" onclick="showTab('mobile')">Mobile</div>
          </div>

          <div id="desktop" class="content active">
            <iframe srcdoc='${desktopHtml.replace(/'/g, "&apos;")}'></iframe>
          </div>
          <div id="mobile" class="content">
            <iframe srcdoc='${mobileHtml.replace(/'/g, "&apos;")}'></iframe>
          </div>

          <script>
            function showTab(id) {
              document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
              document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
              document.querySelector('.tab[onclick="showTab(\\'' + id + '\\')"]').classList.add('active');
              document.getElementById(id).classList.add('active');
            }
          </script>
        </body>
        </html>
      `;

      const reportPath = `${resultsDir}/${domain}.html`;
      fs.writeFileSync(reportPath, combinedHtml);
      console.log(`Combined desktop+mobile report saved: ${reportPath}`);

    } catch (error) {
      console.error(`Failed to test ${url}:`, error);
    }
  }

  await browser.close();
});
