import ExcelJS from 'exceljs';

const headerKey = {
'Chemical Name': 'chemicalName',
'Supplier': 'supplier',
'CAS #': 'casNumber',
'Quantity (Container Size)': 'quantity',
'Location (Room)': 'location',
'Cabinet': 'cabinet',
'Date Received': 'dateReceived'
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
                if (header === 'Quantity (Container Size)') {
                    const separatedUnits = separateUnits(value);
                    rowData.quantity = parseFloat(separatedUnits.quantity);
                    rowData.units = separatedUnits.units;
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
    const tempVar = [ rows[0] ];
    console.log(tempVar)
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
