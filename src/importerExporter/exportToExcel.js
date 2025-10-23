import {
    exec,
    path, 
    ExcelJS 
} from '../utils/index.js';

const headerMap = [
    { key: 'importedProductName', label: 'Searched Chemical Name' },
    { key: 'searchQuery', label: 'Searched CAS Number' },
    { key: 'summary', label: 'Summary Report' },
    { key: 'sdsStatusCode', label: 'SDS Status' },
    { key: 'sdsConfidenceScore', label: 'SDS Confidence Score' },
    { key: 'sdsConfidenceInfo', label: 'SDS Confidence Score Information' },
    { key: 'sdsLink', label: 'SDS Link' },
    { key: 'sdsStorageNotes', label: 'Storage Notes' },
    { key: 'sdsRevisionDate', label: 'SDS Revision Date' }, 
    { key: 'errorStatements', label: 'Errors' },


    //blank column break
    { key: 'null', label: '' },

    { key: 'importedProductName', label: 'Searched Chemical Name'},
    { key: 'sdsProductName', label: 'SDS Chemical Name'},
    { key: 'pubChemProductName', label: 'PubChem Chemical Name'},

    //blank column break
    { key: 'null', label: '' },

    { key: 'searchQuery', label: 'Searched CAS Number' },
    { key: 'sdsCASNumber', label: 'SDS CAS Number' },
    { key: 'pubChemCASNumbers', label: 'Pub Chem CAS Number(s)'},

    //blank column break
    { key: 'null', label: '' },

    { key: 'sdsSynonyms', label: 'SDS Synonyms' },
    { key: 'pubChemSynonyms', label: 'PubChem Synonyms' },

    //blank column break
    { key: 'null', label: '' },

    { key: 'sdsMolecularFormula', label: 'SDS Molecular Formula' },
    { key: 'pubChemMolecularFormula', label: 'PubChem Molecular Formula' },

    //blank column break
    { key: 'null', label: '' },

    { key: 'sdsMolecularWeight', label: 'SDS Molecular Weight' },
    { key: 'pubChemMolecularWeight', label: 'PubChem Molecular Weight' },

    //blank column break
    { key: 'null', label: '' },

    { key: 'sdsSignalWord', label: 'SDS Signal Word' },
    { key: 'pubChemSignalWord', label: 'PubChem Signal Word' },

    //blank column break
    { key: 'null', label: '' },

    { key: 'sdsHazardStatements', label: 'SDS Hazard Statments' },
    { key: 'pubChemHazardStatements', label: 'PubChem Hazard Statements' },

    { key: 'pubChemPictograms', label: 'Pub Chem Pictograms' },
    { key: 'pictogramCodes', label: 'Pictogram Codes (for export)' },

    { key: 'classification', label: 'Generated Classification (Class)' },

    //column break for misc info
    { key: 'null', label: '' },

    { key: 'pubChemCidNumber', label: 'PubChem CID Number' },
    { key: 'importedSupplier', label: 'Supplier' },
    { key: 'importedQuantity', label: 'Quantity' },
    { key: 'importedUnits', label: 'Units' },
    { key: 'importedLocation', label: 'Location' },
    { key: 'importedCabinet', label: 'Cabinet' },
    { key: 'importedReceivedDate', label: 'Received Date' },

]


export async function exportToExcel(parsedData, filepath = 'chemical_data.xlsx', successReport) {
    if (!parsedData || parsedData.length === 0) {
        console.warn('No data to export');
        return;
    }

    const { workbook, summarySheet, dataSheet, exportSheet } =  createWorkbookAndSheets();
    
    writeSuccessReport(summarySheet, successReport);

    writeDataSheet(dataSheet, parsedData);

    //writes a linked export sheet
    writeExportSheet(exportSheet, dataSheet);

    //add basic formating to all sheets (fitting cells)
    addBasicFormating(summarySheet);
    addBasicFormating(dataSheet);
    addBasicFormating(exportSheet);

    confidenceScoreFormating(dataSheet);


    // ✅ 5. Save file
    await workbook.xlsx.writeFile(filepath);
    console.log(`✅ Excel file saved to ${filepath}`);

    // ✅ 6. Auto-open file
    exec(`start "" "${path.resolve(filepath)}"`);
}

function createWorkbookAndSheets() {
    const workbook = new ExcelJS.Workbook();
    const summarySheet = workbook.addWorksheet('Success Report')
    const dataSheet = workbook.addWorksheet('Full Data');
    const exportSheet = workbook.addWorksheet('Export');
    return { workbook, summarySheet, dataSheet, exportSheet };
}

function writeSuccessReport(summarySheet, successReport) {
    const completed = generateSuccessReport(successReport);
    const row = summarySheet.addRow(['']);
    row.getCell(1).value = completed;
}

function writeDataSheet(dataSheet, parsedData) {
    dataSheet.addRow(headerMap.map(h => h.label));
    parsedData.forEach(record => {
        const rowData = headerMap.map(h => {
            if (h.key === 'null') {
                return '';
            }

            let value = record[h.key] ?? '';

            //formating confidence info cell
            if (h.key === 'sdsConfidenceInfo' && Array.isArray(value)) {
                const richRuns = []
                value.forEach((err, i) => {
                    if (i > 0) {
                        richRuns.push({ text: '\n────────────────────────────────\n', font: { bold: false } });
                    }

                    if (typeof err === 'object') {
                        richRuns.push(
                            { text: `${err.message}\n` },  // 🪄 newline after message
                            { text: 'SDS: ' },
                            { text: String(err.sdsValue), font: { bold: true } },
                            { text: '\nPubChem: ' },
                            { text: String(err.pubChemValue), font: { bold: true } },
                            { text: '\nPenalty: ' },
                            { text: ` ${err.penalty}`, font: { bold: true } }
                    )} else {
                        richRuns.push({ text: String(err) });
                    };
                    return { richText: richRuns };
                });
            }
            //Add lines between array values
            value = formatCellValue(value);
            return value;
        });
        const row = dataSheet.addRow(rowData);
        row.getCell(3).value = generateSummary(record)
    })
}

function formatCellValue(value) {
    if (Array.isArray(value)) {
        // Handle array of objects (like your error objects)
        if (value.length && typeof value[0] === 'object' && value[0] !== null) {
        return value.map(v => 
            `${v.message}\nSDS: ${v.sdsValue}\nPubChem: ${v.pubChemValue}\nPenalty: ${v.penalty}`
        ).join('\n────────────────────\n');
        }
        // Handle array of strings/numbers
        return value.map(v => String(v)).join('\n');
    }

    // Handle single object
    if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value);
    }

    // Primitive fallback
    return value;
}


function writeExportSheet(exportSheet, dataSheet) {
  // clear sheet
  exportSheet.spliceRows(1, exportSheet.rowCount);

  const rowCount = dataSheet.rowCount;
  const columnCount = dataSheet.columnCount;

  // add headers
  const headerRow = dataSheet.getRow(1).values;
  exportSheet.addRow(headerRow);

  // add linked cells
  for (let r = 2; r <= rowCount; r++) {
    const newRow = [];
    for (let c = 1; c <= columnCount; c++) {
      const colLetter = dataSheet.getColumn(c).letter;
      const sheetName = `'${dataSheet.name}'`;
      newRow.push({ formula: `=${sheetName}!${colLetter}${r}` });
    }
    exportSheet.addRow(newRow);
  }
}

function addBasicFormating(sheet) {
    sheet.getRow(1).font = { bold: true };
    sheet.columns.forEach(col => {
        col.width = 20;
    });

    //Adds wrap text to everything except PubChem Hazard Statements, since thats a HUGE block
    const hazardColIndex = headerMap.findIndex(h => h.key === 'pubChemHazardStatements') + 1;
    sheet.columns.forEach((col, index) => {
        if (index + 1 === hazardColIndex) {
            // 🚫 No wrap for hazard statements
            col.alignment = { wrapText: false };
        } else {
            // ✅ Wrap for all other columns
            col.alignment = { wrapText: true };
        }
    });

    //Add black outlines to every cell
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

    //Make columns fit all text
    sheet.columns.forEach(col => {
        let maxLength = 0;

        col.eachCell(cell => {
            const cellValue = cell.value;
            let text = '';
            if (typeof cellValue === 'string') {
                text = cellValue;
            } else if (cellValue && cellValue.richText) {
                text = cellValue.richText.map(rt => rt.text).join('');
            } else if (cellValue != null) {
                text = cellValue.toString();
            }
            maxLength = Math.max(maxLength, text.length)
        });
        col.width = Math.min(maxLength + 2, 100);
    });
  


    //Add a black background for separating sections
    sheet.columns.forEach((col, index) => {
        const header = headerMap[index];
        if (header.key === 'null') {
            col.eachCell({ includeEmpty: true }, cell => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: '000000' }  // black background
                };
            });
        }
    });

}


function confidenceScoreFormating(sheet) {
    const confidenceColIndex = headerMap.findIndex(h => h.key === 'sdsConfidenceScore') + 1;
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
}

function generateSummary(record) {
  const richRuns = [];

  richRuns.push(
        { text: 'Summary\n', font: { bold: true, underline: true } },
        { text: 'Name Comparison\n', font: { bold: true } },
        { text: 'Inventory: ' },
        { text: String(record.knownProductName || 'N/A'), font: { bold: true } },
        { text: '\nSDS: ' },
        { text: String(record.sdsProductName || 'N/A'), font: { bold: true } },
        { text: '\nPubChem: ' },
        { text: String(record.pubChemName || 'N/A'), font: { bold: true } },
        { text: '\n────────────────────\n' },
        { text: 'CAS Comparison\n', font: { bold: true } },
        { text: 'Inventory: ' },
        { text: String(record.searchQuery || 'N/A'), font: { bold: true } },
        { text: '\nSDS: ' },
        { text: String(record.sdsCASNumber || 'N/A'), font: { bold: true } },
        { text: '\nPubChem: ' },
        { text: String(record.pubChemCASNumber || 'N/A'), font: { bold: true } }
    );

    return { richText: richRuns };
};


function generateSuccessReport(successReport) {
    const richRuns = [];

    const successPercent = (successReport.passedSDS/successReport.totalChemicals) * 100
    const reviewPercent = (successReport.reviewSDS/successReport.totalChemicals) * 100
    const failedPercent = (successReport.failedSDS/successReport.totalChemicals) * 100
    const errorPercent = (successReport.errors/successReport.totalChemicals) * 100

    richRuns.push(
        { text: 'Summary and Success Report\n', font: { bold: true, underline: true } },
        { text: 'Total Chemicals ran:\n' },
        { text: String(successReport.totalChemicals), font: { bold: true, underline: true } },
        { text: '\n_______________________________\n' },
        { text: 'Successful SDS Sheets' },
        { text: '\nTotal: ', font: { bold: true, underline: true } },
        { text: String(successReport.passedSDS), font: { bold: true, underline: true } },
        { text: '\nPercentage: ', font: { bold: true, underline: true } },
        { text: String(successPercent), font: { bold: true, underline: true } },
        { text: '%', font: { bold: true, underline: true } },
        { text: '\n_______________________________\n' },
        { text: 'SDS Sheets that need review' },
        { text: '\nTotal: ', font: { bold: true, underline: true } },
        { text: String(successReport.reviewSDS), font: { bold: true, underline: true } },
        { text: '\nPercentage: ', font: { bold: true, underline: true } },
        { text: String(reviewPercent), font: { bold: true, underline: true } },
        { text: '%', font: { bold: true, underline: true } },
        { text: '\n_______________________________\n' },
        { text: 'Failed SDS Sheets' },
        { text: '\nTotal: ', font: { bold: true, underline: true } },
        { text: String(successReport.failedSDS), font: { bold: true, underline: true } },
        { text: '\nPercentage: ', font: { bold: true, underline: true } },
        { text: String(failedPercent), font: { bold: true, underline: true } },
        { text: '%', font: { bold: true, underline: true } },
        { text: '\n_______________________________\n' },
        { text: 'Errors encountered' },
        { text: '\nTotal: ', font: { bold: true, underline: true } },
        { text: String(successReport.errors), font: { bold: true, underline: true } },
        { text: '\nPercentage: ', font: { bold: true, underline: true } },
        { text: String(failedPercent), font: { bold: true, underline: true } },
        { text: '%', font: { bold: true, underline: true } },
    );

     return { richText: richRuns };
};