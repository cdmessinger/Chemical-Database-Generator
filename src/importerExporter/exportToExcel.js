import {
    exec,
    path, 
    ExcelJS 
} from '../utils/index.js';


export async function exportToExcel(parsedData, filepath = 'chemical_data.xlsx', successReport) {
    if (!parsedData || parsedData.length === 0) {
        console.warn('No data to export');
        return;
    }

    const { workbook, summarySheet, dataSheet, exportSheet } =  createWorkbookAndSheets();
    
    writeSuccessReport(summarySheet, successReport);

    // writeDataSheet(dataSheet, parsedData);
    writeDataSheet(dataSheet, parsedData)

    //writes a linked export sheet
    writeExportSheet(exportSheet, dataSheet);

    //specific sheet formating
    dataSheetFormating(dataSheet);

    //add basic formating to all sheets (fitting cells)
    addBasicFormating(summarySheet);
    addBasicFormating(dataSheet);
    addBasicFormating(exportSheet);



    // ✅ 5. Save file
    await workbook.xlsx.writeFile(filepath);
    console.log(`✅ Excel file saved to ${filepath}`);

    // ✅ 6. Auto-open file
    exec(`start "" "${path.resolve(filepath)}"`);
}

function createWorkbookAndSheets() {
    const workbook = new ExcelJS.Workbook();

    const dataSheet = workbook.addWorksheet('Full Data');
    const summarySheet = workbook.addWorksheet('Success Report')
    
    const exportSheet = workbook.addWorksheet('Export');
    return { workbook, summarySheet, dataSheet, exportSheet };
}

function writeSuccessReport(summarySheet, successReport) {
    const completed = generateSuccessReport(successReport);
    const row = summarySheet.addRow(['']);
    row.getCell(1).value = completed;
}

function writeDataSheet(dataSheet, parsedData) {
    if (!parsedData.length) return;

    //set Headers
    dataSheet.getCell(1,1).value = 'SEARCHED';
    dataSheet.getCell(1,2).value = 'SUMMARY';
    dataSheet.getCell(1,3).value = '';
    dataSheet.getCell(1,4).value = 'COMPARE';
    dataSheet.getCell(1,5).value = 'IMPORTED';
    dataSheet.getCell(1,6).value = 'PUBCHEM';
    dataSheet.getCell(1,7).value = 'SDS SHEET';
    dataSheet.getCell(1,8).value = 'HAZARDS';
    dataSheet.getCell(1,9).value = 'PICTOGRAMS';
    dataSheet.getCell(1,10).value = 'MISC 1';
    dataSheet.getCell(1,11).value = '';
    dataSheet.getCell(1,12).value = 'MISC 2';
    dataSheet.getCell(1,13).value = '';
    
    //merge headers
    dataSheet.mergeCells(1, 2, 1, 3);
    dataSheet.mergeCells(1, 10, 1, 11);
    dataSheet.mergeCells(1, 12, 1, 13);

    let startRow = 2

    for (let i = 0; i < parsedData.length; i++) {
        const record = parsedData[i];

        //row 1
        dataSheet.getCell(startRow, 1).value = record.importedProductName;
        dataSheet.getCell(startRow, 2).value = 'STATUS CODE:';
        dataSheet.getCell(startRow, 3).value = record.sdsStatusCode;
        dataSheet.getCell(startRow, 4).value = 'NAME: ';
        dataSheet.getCell(startRow, 5).value = record.importedProductName;
        dataSheet.getCell(startRow, 6).value = record.pubChemProductName;
        dataSheet.getCell(startRow, 7).value = record.sdsProductName;
        dataSheet.getCell(startRow, 8).value = formatCellValue(record.sdsHazardStatements);
        dataSheet.getCell(startRow, 9).value = formatCellValue(record.pubChemPictograms);
        dataSheet.getCell(startRow, 10).value = 'CLASS:';
        dataSheet.getCell(startRow, 11).value = record.classification;
        dataSheet.getCell(startRow, 12).value = 'RECEIVED DATE';
        dataSheet.getCell(startRow, 13).value = record.importedReceivedDate;
        
        //row 2
        dataSheet.getCell(startRow + 1, 1).value = '';
        dataSheet.getCell(startRow + 1, 2).value = 'CONFIDENCE SCORE:';
        dataSheet.getCell(startRow + 1, 3).value = record.sdsConfidenceScore;
        dataSheet.getCell(startRow + 1, 4).value = 'CAS NO.:';
        dataSheet.getCell(startRow + 1, 5).value = record.searchQuery;
        dataSheet.getCell(startRow + 1, 6).value = formatCellValue(record.pubChemCASNumbers);
        dataSheet.getCell(startRow + 1, 7).value = record.sdsCASNumber;
        dataSheet.getCell(startRow + 1, 8).value = '';
        dataSheet.getCell(startRow + 1, 9).value = '';
        dataSheet.getCell(startRow + 1, 10).value = 'SUPPLIER:';
        dataSheet.getCell(startRow + 1, 11).value = record.importedSupplier;
        dataSheet.getCell(startRow + 1, 12).value = 'SDS LINK: ';
        dataSheet.getCell(startRow + 1, 13).value = { text: 'Click for SDS.', hyperlink: record.sdsLink };
        dataSheet.getCell(startRow + 1, 13).font = { color: { argb: 'FF0000FF'}, underline: true}

        

        //row 3
        dataSheet.getCell(startRow + 2, 1).value = '';
        dataSheet.getCell(startRow + 2, 2).value = 'CONF. SCORE INFO:';
        dataSheet.getCell(startRow + 2, 3).value = formatCellValue(record.sdsConfidenceInfo);
        dataSheet.getCell(startRow + 2, 4).value = 'SYNONYMS:';
        dataSheet.getCell(startRow + 2, 5).value = '';
        dataSheet.getCell(startRow + 2, 6).value = formatCellValue(record.pubChemSynonyms);
        dataSheet.getCell(startRow + 2, 7).value = formatCellValue(record.sdsSynonyms);
        dataSheet.getCell(startRow + 2, 8).value = '';
        dataSheet.getCell(startRow + 2, 9).value = '';
        dataSheet.getCell(startRow + 2, 10).value = 'QUANTITY:';
        dataSheet.getCell(startRow + 2, 11).value = record.importedQuantity;
        dataSheet.getCell(startRow + 2, 12).value = 'STORAGE NOTES:';
        dataSheet.getCell(startRow + 2, 13).value = record.sdsStorageNotes;

        //row 4
        dataSheet.getCell(startRow + 3, 1).value = record.searchQuery;
        dataSheet.getCell(startRow + 3, 2).value = '';
        dataSheet.getCell(startRow + 3, 3).value = '';
        dataSheet.getCell(startRow + 3, 4).value = 'FORMULA:';
        dataSheet.getCell(startRow + 3, 5).value = '';
        dataSheet.getCell(startRow + 3, 6).value = record.pubChemMolecularFormula;
        dataSheet.getCell(startRow + 3, 7).value = record.sdsMolecularFormula;
        dataSheet.getCell(startRow + 3, 8).value = formatCellValue(record.pubChemHazardStatements);
        dataSheet.getCell(startRow + 3, 9).value = formatCellValue(record.pictogramCodes);
        dataSheet.getCell(startRow + 3, 10).value = 'UNITS:';
        dataSheet.getCell(startRow + 3, 11).value = record.importedUnits;
        dataSheet.getCell(startRow + 3, 12).value = '';
        dataSheet.getCell(startRow + 3, 13).value = '';

        //row 5
        dataSheet.getCell(startRow + 4, 1).value = '';
        dataSheet.getCell(startRow + 4, 2).value = '';
        dataSheet.getCell(startRow + 4, 3).value = '';
        dataSheet.getCell(startRow + 4, 4).value = 'MW:';
        dataSheet.getCell(startRow + 4, 5).value = '';
        dataSheet.getCell(startRow + 4, 6).value = record.pubChemMolecularWeight;
        dataSheet.getCell(startRow + 4, 7).value = record.sdsMolecularWeight;
        dataSheet.getCell(startRow + 4, 8).value = '';
        dataSheet.getCell(startRow + 4, 9).value = '';
        dataSheet.getCell(startRow + 4, 10).value = 'LOCATION:';
        dataSheet.getCell(startRow + 4, 11).value = record.importedLocation;
        dataSheet.getCell(startRow + 4, 12).value = '';
        dataSheet.getCell(startRow + 4, 13).value = '';

        //row 6
        dataSheet.getCell(startRow + 5, 1).value = '';
        dataSheet.getCell(startRow + 5, 2).value = 'ERRORS:';
        dataSheet.getCell(startRow + 5, 3).value = formatCellValue(record.errorStatements);
        dataSheet.getCell(startRow + 5, 4).value = 'SIGNAL WORD:';
        dataSheet.getCell(startRow + 5, 5).value = '';
        dataSheet.getCell(startRow + 5, 6).value = record.pubChemSignalWord;
        dataSheet.getCell(startRow + 5, 7).value = record.sdsSignalWord;
        dataSheet.getCell(startRow + 5, 8).value = '';
        dataSheet.getCell(startRow + 5, 9).value = '';
        dataSheet.getCell(startRow + 5, 10).value = 'CABINET:';
        dataSheet.getCell(startRow + 5, 11).value = record.importedCabinet;
        dataSheet.getCell(startRow + 5, 12).value = '';
        dataSheet.getCell(startRow + 5, 13).value = '';

        //Merge cells for formating

        //row 1
        dataSheet.mergeCells(startRow, 1, startRow + 2, 1);
        dataSheet.mergeCells(startRow + 3, 1, startRow + 5, 1);

        //row 2
        dataSheet.mergeCells(startRow + 2, 2, startRow + 4, 2);

        //row 3
        dataSheet.mergeCells(startRow + 2, 3, startRow + 4, 3);

        //row 4 - 7 NO MERGING

        //row 8
        dataSheet.mergeCells(startRow, 8, startRow + 2, 8);
        dataSheet.mergeCells(startRow + 3, 8, startRow + 5, 8);

        //row 9
        dataSheet.mergeCells(startRow, 9, startRow + 2, 9);
        dataSheet.mergeCells(startRow + 3, 9, startRow + 5, 9);
        
        //row 10 - 11 NO MERGING

        //row 12
        dataSheet.mergeCells(startRow+2, 12, startRow+5, 12)

        //row 13
        dataSheet.mergeCells(startRow+2, 13, startRow+5, 13)

        confidenceScoreFormating(dataSheet, startRow);

        //add to the counter to keep in line
        startRow +=7
    };
};



function confidenceScoreFormating(dataSheet, startRow) {

    const targetColumn = 3; //column C always
    const targetRow = dataSheet.getRow(startRow+1);
    const targetCell = Number(targetRow.getCell(targetColumn).value);
    const endRow = startRow + 6;

    let color = null;
    
    if (targetCell >= 85) color = '28e482';      // green, extremely confident
    else if (targetCell >= 70) color = '9fcf74'; // yellow-green, pass
    else if (targetCell >= 40) color = 'fdf381'; // yellow, needs review
    else color = 'da5d4c';                  // red, fail

    for (let i=startRow; i < endRow; i++) {
        const row = dataSheet.getRow(i)
        row.eachCell(cell => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: color }
            };
        });
    };
};

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
    sheet.columns.forEach(col => {
    let maxLength = 0;

    col.eachCell({ includeEmpty: true }, (cell) => {
        let cellText = '';

        if (cell.value == null) {
            cellText = '';
        } else if (typeof cell.value === 'string' || typeof cell.value === 'number') {
            cellText = cell.value.toString();
        } else {
            cellText = cell.value.toString();
        }

        maxLength = Math.max(maxLength, cellText.length);
    });

    col.width = Math.min(maxLength + 2, 60); // add padding, cap at 60
});

};



function dataSheetFormating(dataSheet) {

    //FREEZE top row and first column
    dataSheet.views = [
        { state: 'frozen', xSplit: 1, ySplit: 1 }
    ];

    dataSheet.getColumn(1).alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
    dataSheet.getColumn(2).alignment = { wrapText: true, horizontal: 'right', vertical: 'middle' };
    dataSheet.getColumn(3).alignment = { wrapText: true, horizontal: 'left', vertical: 'middle' };
    dataSheet.getColumn(4).alignment = { wrapText: true, horizontal: 'right', vertical: 'middle' };
    dataSheet.getColumn(5).alignment = { wrapText: true, horizontal: 'left', vertical: 'middle' };
    dataSheet.getColumn(6).alignment = { wrapText: true, horizontal: 'left', vertical: 'middle' };
    dataSheet.getColumn(7).alignment = { wrapText: true, horizontal: 'left', vertical: 'middle' };
    dataSheet.getColumn(8).alignment = { wrapText: true, horizontal: 'left', vertical: 'bottom' };
    dataSheet.getColumn(9).alignment = { wrapText: true, horizontal: 'left', vertical: 'bottom' };
    dataSheet.getColumn(10).alignment = { wrapText: true, horizontal: 'right', vertical: 'middle' };
    dataSheet.getColumn(11).alignment = { wrapText: true, horizontal: 'left', vertical: 'middle' };
    dataSheet.getColumn(12).alignment = { wrapText: true, horizontal: 'right', vertical: 'middle' };
    dataSheet.getColumn(13).alignment = { wrapText: true, horizontal: 'left', vertical: 'middle' };

    const labelColumns = [2,4,10,12];

    for(const column of labelColumns) 
        dataSheet.getColumn(column).eachCell({ includeEmpty: true }, cell => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF686B69' }
            }
            cell.font = { bold: true, color: { argb: 'FFDDDDDD' } };
    });


    let rowCount = 8;
    const cardCount = Math.floor(dataSheet.rowCount / 7);

    for (let i = 0; i < cardCount; i++) {
        const row = dataSheet.getRow(rowCount);
        for (let col = 1; col <= dataSheet.columnCount; col++) {
            const cell = row.getCell(col);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF000000' }
            };
        }
        rowCount += 7;
    }

    //set headers
    dataSheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
    dataSheet.getRow(1).font = { bold: true, size: 16, color: { argb: 'FFDDDDDD'} };   
    dataSheet.getRow(1).eachCell({ includeEmpty: true }, cell => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF000000' } //black background
            }
    });
    dataSheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
            // Default thin black border
            cell.border = {
                top:    { style: 'medium', color: { argb: 'FFDDDDDD' } },
                left:   { style: 'medium', color: { argb: 'FFDDDDDD' } },
                bottom: { style: 'medium', color: { argb: 'FFDDDDDD' } },
                right:  { style: 'medium', color: { argb: 'FFDDDDDD' } },
            };
            if (rowNumber !== 1 && colNumber === 5 && (!cell.value || cell.value === '')) {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'bfd1d6' }
                };
            }
        });    
    });
 };
   



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
