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