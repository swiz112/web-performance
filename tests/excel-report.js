import xlsx from 'xlsx';
import fs from 'fs';

const excelFileName = 'performance-report.xlsx';

export function initializeExcel(resultsDir) {
    const excelFilePath = `${resultsDir}/${excelFileName}`;
    if (fs.existsSync(excelFilePath)) {
        return;
    }
    const headers = [
        'Date and Time',
        'Website Name',
        'Test URL',
        'Redirected URL',
        'URL Error Code',
        'Error',
        'FCP',
        'TBT',
        'LCP',
        'CLS',
        'Speed Index',
        'Overall Performance Score',
        'Website Load Time'
    ];
    const worksheet = xlsx.utils.aoa_to_sheet([headers]);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Performance Report');
    xlsx.writeFile(workbook, excelFilePath);
}

export function appendToExcel(data, resultsDir) {
    const excelFilePath = `${resultsDir}/${excelFileName}`;
    const workbook = xlsx.readFile(excelFilePath);
    const worksheet = workbook.Sheets['Performance Report'];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    jsonData.push(data);
    const newWorksheet = xlsx.utils.aoa_to_sheet(jsonData);
    workbook.Sheets['Performance Report'] = newWorksheet;
    xlsx.writeFile(workbook, excelFilePath);
}