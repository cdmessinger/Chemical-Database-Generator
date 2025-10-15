import { exec } from 'child_process';
import path from 'path';
import ExcelJS from 'exceljs';

export async function exportToExcel(parsedData, filepath = 'chemical_data.xlsx') {
    if (!parsedData || parsedData.length === 0) {
        console.warn('No data to export');
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Chemicals');

    // ✅ 1. Add headers first
    const headers = Object.keys(parsedData[0]);
    sheet.addRow(headers);

    // ✅ 2. Add data rows
parsedData.forEach(record => {
    const rowData = headers.map(h => {
        let value = record[h] ?? '';
        if (Array.isArray(value)) {
            value = value.join('\n'); // ✅ array → multiline string
        }
        return value;
    });
    sheet.addRow(rowData);
});


    // ✅ 3. Style after data is inserted
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach(col => {
        col.width = 20;
    });

const hazardColIndex = headers.indexOf('pubChemHazardStatements') + 1;

sheet.columns.forEach((col, index) => {
    if (index + 1 === hazardColIndex) {
        // 🚫 No wrap for hazard statements
        col.alignment = { wrapText: false };
    } else {
        // ✅ Wrap for all other columns
        col.alignment = { wrapText: true };
    }
});



    // ✅ 4. Color code confidence score column if it exists
// ✅ Color entire row based on confidence score
const confidenceColIndex = headers.indexOf('sdsConfidenceScore') + 1;
if (confidenceColIndex > 0) {
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
            const score = Number(row.getCell(confidenceColIndex).value);
            let color = null;

            if (score >= 85) color = '28e482';      // green, extremely confident
            else if (score >= 70) color = '9fcf74'; // yellow-green, pass
            else if (score >= 40) color = 'fdf381'; // yellow, needs review
            else color = 'da5d4c';                  // red, fail

            // 🪄 Apply the fill to each cell in the row
            row.eachCell(cell => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: color }
                };
            });
        }
    });
}

sheet.eachRow(row => {
    row.eachCell(cell => {
        cell.border = {
            top:    { style: 'thin', color: { argb: 'FF000000' } },
            left:   { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right:  { style: 'thin', color: { argb: 'FF000000' } },
        };
    });
});


sheet.columns.forEach((col, i) => {
    let maxLength = 0;
    col.eachCell({ includeEmpty: true }, cell => {
        const cellLength = cell.value ? cell.value.toString().length : 0;
        if (cellLength > maxLength) {
            maxLength = cellLength;
        }
    });
    col.width = Math.min(maxLength + 2, 100); // +2 for padding, max cap to avoid crazy widths
});



    // ✅ 5. Save file
    await workbook.xlsx.writeFile(filepath);
    console.log(`✅ Excel file saved to ${filepath}`);

    // ✅ 6. Auto-open file
    exec(`start "" "${path.resolve(filepath)}"`);
}
