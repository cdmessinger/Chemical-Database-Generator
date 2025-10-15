import ExcelJS from 'exceljs';

const headerKey = {
'Chemical Name': 'chemicalName',
'Supplier': 'supplier',
'CAS #': 'casNumber',
'Quantity (Container Size)': 'quantity',
'Location (Room)': 'location',
'Cabinet': 'cabinet',
'Date Recieved': 'dateRecieved'
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
            if (key) {
                rowData[key] = cell.value;
            }
        });
        rows.push(rowData);
    })
    console.log(rows)
    return rows;
}
