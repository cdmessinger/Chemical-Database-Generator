import {
    exec,
    path, 
    ExcelJS 
} from './index.js';

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


export async function exportToExcel(parsedData, filepath = 'chemical_data.xlsx') {
    if (!parsedData || parsedData.length === 0) {
        console.warn('No data to export');
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const dataSheet = workbook.addWorksheet('Full Data'); //ALL DATA
    const summarySheet = workbook.addWorksheet('Export'); //main sheet for uploading
    
    // ✅ 1. Add headers first
    dataSheet.addRow(headerMap.map(h => h.label));

    // ✅ 2. Add data rows
    parsedData.forEach(record => {
        console.log(record)
        const rowData = headerMap.map(h => {

        if (h.key === 'null') {
            return '';
        }

        let value = record[h.key] ?? '';

        // Formating confidence info cells
        if (h.key === 'sdsConfidenceInfo' && Array.isArray(value)) {
            const richRuns = [];
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
                );
                } else {
                    richRuns.push({ text: String(err) });
                }
            });
                return { richText: richRuns };
            }


        // Default formatting
        if (Array.isArray(value)) {
            value = value.join('\n');
        }
        return value;
    });

    const row = dataSheet.addRow(rowData);

    row.getCell(3).value = generateSummary(record);
});



    // ✅ 3. Style after data is inserted
    dataSheet.getRow(1).font = { bold: true };
    dataSheet.columns.forEach(col => {
        col.width = 20;
    });

const hazardColIndex = headerMap.findIndex(h => h.key === 'pubChemHazardStatements') + 1;

dataSheet.columns.forEach((col, index) => {
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

const confidenceColIndex = headerMap.findIndex(h => h.key === 'sdsConfidenceScore') + 1;
if (confidenceColIndex > 0) {
    dataSheet.eachRow((row, rowNumber) => {
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

dataSheet.eachRow(row => {
    row.eachCell(cell => {
        cell.border = {
            top:    { style: 'thin', color: { argb: 'FF000000' } },
            left:   { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right:  { style: 'thin', color: { argb: 'FF000000' } },
        };
    });
});


dataSheet.columns.forEach(col => {
  let maxLength = 0;

  col.eachCell({ includeEmpty: true }, cell => {
    const cellValue = cell.value;

    let text = '';
    if (typeof cellValue === 'string') {
      text = cellValue;
    } else if (cellValue && cellValue.richText) {
      text = cellValue.richText.map(rt => rt.text).join('');
    } else if (cellValue != null) {
      text = cellValue.toString();
    }

    maxLength = Math.max(maxLength, text.length);
  });

  col.width = Math.min(maxLength + 2, 100);
});

// 🪄 After you've added all rows and before saving the file
dataSheet.columns.forEach((col, index) => {
  const header = headerMap[index];

  if (header.key === 'null') {
    col.eachCell({ includeEmpty: true }, cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '000000' }  // black background
      };
      cell.font = { color: { argb: 'FFFFFF' } }; // white text (optional)
    });
  }
});




    // ✅ 5. Save file
    await workbook.xlsx.writeFile(filepath);
    console.log(`✅ Excel file saved to ${filepath}`);

    // ✅ 6. Auto-open file
    exec(`start "" "${path.resolve(filepath)}"`);
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