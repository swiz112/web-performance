const { test } = require('@playwright/test');
const playwright = require('playwright-core');
const lighthouse = require('lighthouse');
const { URL } = require('url');
const fs = require('fs');
const xlsx = require('xlsx');

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
  const workbook = xlsx.readFile('urls.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const urls = xlsx.utils.sheet_to_json(worksheet, { header: 1 }).map(row => row[0]);

  if (urls.length === 0) {
    console.log('No URLs found in urls.xlsx');
    return;
  }

  const dateTime = getFormattedDateTime();
  const resultsDir = `results/${dateTime}`;
  fs.mkdirSync(`${resultsDir}/desktop`, { recursive: true });
  fs.mkdirSync(`${resultsDir}/mobile`, { recursive: true });

  const browser = await playwright.chromium.launch({
    args: ['--remote-debugging-port=9222'],
  });

  for (const url of urls) {
    try {
      console.log(`Running performance tests for: ${url}`);
      const urlObject = new URL(url);
      const domain = urlObject.hostname.replace(/www./g, '');

      // Desktop test
      const desktopResult = await lighthouse(url, {
        port: 9222,
        output: ['html', 'json'],
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

      const desktopReportHtml = desktopResult.report[0];
      const desktopLhr = desktopResult.lhr;
      const desktopReportPath = `${resultsDir}/desktop/${domain}.html`;
      fs.writeFileSync(desktopReportPath, desktopReportHtml);
      console.log(`Lighthouse desktop report saved to ${desktopReportPath}`);

      // Mobile test
      const mobileResult = await lighthouse(url, {
        port: 9222,
        output: ['html', 'json'],
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

      const mobileReportHtml = mobileResult.report[0];
      const mobileLhr = mobileResult.lhr;
      const mobileReportPath = `${resultsDir}/mobile/${domain}.html`;
      fs.writeFileSync(mobileReportPath, mobileReportHtml);
      console.log(`Lighthouse mobile report saved to ${mobileReportPath}`);

      // Create summary report
      const summaryHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Performance Summary for ${domain}</title>
          <style>
            body { font-family: sans-serif; margin: 2em; }
            table { border-collapse: collapse; width: 100%; max-width: 800px; margin: 2em 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            h1, h2 { color: #333; }
            a { color: #007bff; }
          </style>
        </head>
        <body>
          <h1>Performance Summary for ${domain}</h1>
          <h2>URL: <a href="${url}" target="_blank">${url}</a></h2>
          <table>
            <tr>
              <th>Metric</th>
              <th>Desktop</th>
              <th>Mobile</th>
            </tr>
            <tr>
              <td>Performance Score</td>
              <td>${(desktopLhr.categories.performance.score * 100).toFixed(0)}</td>
              <td>${(mobileLhr.categories.performance.score * 100).toFixed(0)}</td>
            </tr>
            <tr>
              <td>First Contentful Paint</td>
              <td>${desktopLhr.audits['first-contentful-paint'].displayValue}</td>
              <td>${mobileLhr.audits['first-contentful-paint'].displayValue}</td>
            </tr>
            <tr>
              <td>Speed Index</td>
              <td>${desktopLhr.audits['speed-index'].displayValue}</td>
              <td>${mobileLhr.audits['speed-index'].displayValue}</td>
            </tr>
            <tr>
              <td>Largest Contentful Paint</td>
              <td>${desktopLhr.audits['largest-contentful-paint'].displayValue}</td>
              <td>${mobileLhr.audits['largest-contentful-paint'].displayValue}</td>
            </tr>
            <tr>
              <td>Time to Interactive</td>
              <td>${desktopLhr.audits['interactive'].displayValue}</td>
              <td>${mobileLhr.audits['interactive'].displayValue}</td>
            </tr>
            <tr>
              <td>Total Blocking Time</td>
              <td>${desktopLhr.audits['total-blocking-time'].displayValue}</td>
              <td>${mobileLhr.audits['total-blocking-time'].displayValue}</td>
            </tr>
            <tr>
              <td>Cumulative Layout Shift</td>
              <td>${desktopLhr.audits['cumulative-layout-shift'].displayValue}</td>
              <td>${mobileLhr.audits['cumulative-layout-shift'].displayValue}</td>
            </tr>
          </table>
          <h2>Full Reports</h2>
          <ul>
            <li><a href="./desktop/${domain}.html">View Full Desktop Report</a></li>
            <li><a href="./mobile/${domain}.html">View Full Mobile Report</a></li>
          </ul>
        </body>
        </html>
      `;
      const summaryReportPath = `${resultsDir}/${domain}-summary.html`;
      fs.writeFileSync(summaryReportPath, summaryHtml);
      console.log(`Summary report saved to ${summaryReportPath}`);

    } catch (error) {
      console.error(`Failed to test ${url}:`, error);
    }
  }

  await browser.close();
});
