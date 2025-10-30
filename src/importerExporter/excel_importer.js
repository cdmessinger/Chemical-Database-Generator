import { ExcelJS } from '../utils/index.js';


const headerKey = {
'Chemical Name': 'importedProductName',
'Supplier': 'importedSupplier',
'CAS #': 'searchQuery',
'Quantity (Container Size)': 'importedQuantity',
'Location (Room)': 'importedLocation',
'Cabinet': 'importedCabinet',
'Date Received': 'importedReceivedDate'
};


export async function importExcel(filepath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filepath);
    const sheet = workbook.worksheets[0]; //assume first sheet in excel file

    const rows = [];
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; //skip headers

        const rowData = {};
        row.eachCell((cell, colNumber) => {
            const header = sheet.getRow(1).getCell(colNumber).value;
            const key = headerKey[header];
            let value = cell.value
            if (value) {
                if (header === 'Quantity (Container Size)' || header === 'Quantity') {
                    const separatedUnits = separateUnits(value);
                    rowData.importedQuantity = parseFloat(separatedUnits.quantity);
                    rowData.importedUnits = separatedUnits.units;
                } else if (key) {
                    rowData[key] = value;
                }
                if (value instanceof Date) {
                    value = value.toISOString().split('T')[0];
                }
                
            }
        });
        rows.push(rowData);
    })
   
    // return rows;


    // quick searching only 1 REMOVE AFTER TESTING
    const tempVar = rows.slice(19,21);
    console.log(tempVar);
    return tempVar;
}


function separateUnits(value) {

    const cleanvalue = String(value).replace(/\s+/g, '');  //removes all spaces in value
    const valueRegex = cleanvalue.match(/^([\d.,eE+-]+)\s*([a-zA-Zμµ%]+)$/);

    let quantity = '';
    let units = '';

    if (valueRegex) {
        quantity = valueRegex[1];
        units = valueRegex[2];
    } else {
        console.log('Error separating units');
        quantity = value;
    }
    return { quantity, units }
}
