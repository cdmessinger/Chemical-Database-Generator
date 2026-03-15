import { ExcelJS } from '../utils/index.js';

const headerKey = {
	'Chemical Name': 'importedProductName',
	Supplier: 'importedSupplier',
	'CAS #': 'importedCasNumber',
	'Quantity (Container Size)': 'importedQuantity',
	'Location (Room)': 'importedLocation',
	Cabinet: 'importedCabinet',
	'Date Received': 'importedReceivedDate',
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
			let value = getCellText(cell.value);
			if (value) {
				if (
					header === 'Quantity (Container Size)' ||
					header === 'Quantity'
				) {
					const separatedUnits = separateUnits(value);
					rowData.importedQuantity = parseFloat(
						separatedUnits.quantity,
					);
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
	});

	// return rows;

	// // FOR TESTING only
	const tempVar = rows.slice(0, 5);
	return tempVar;
}

function separateUnits(value) {
	const cleanvalue = String(value).trim(); // keep spaces for splitting

	// split into "numberPart" + "unitPart"
	const m = cleanvalue.match(/^(.+?)\s*([a-zA-Zμµ%]+)$/);
	if (!m) {
		console.log('Error separating units');
		console.log('Value:', cleanvalue);
		return { quantity: cleanvalue, units: '' };
	}

	let numberPart = m[1].trim();
	const units = m[2];

	// 1) mixed number: "1 1/2"
	let mixed = numberPart.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
	if (mixed) {
		const whole = Number(mixed[1]);
		const num = Number(mixed[2]);
		const den = Number(mixed[3]);
		return { quantity: String(whole + num / den), units };
	}

	// 2) simple fraction: "1/2"
	let fraction = numberPart.match(/^(\d+)\s*\/\s*(\d+)$/);
	if (fraction) {
		const num = Number(fraction[1]);
		const den = Number(fraction[2]);
		return { quantity: String(num / den), units };
	}

	// 3) normal numbers (including scientific)
	numberPart = numberPart.replace(/,/g, ''); // optional: drop thousands separators
	return { quantity: numberPart, units };
}

//protects against weird formating with richText when importing from excel
function getCellText(value) {
	if (!value) return '';

	if (typeof value === 'string') return value;

	if (value.richText) {
		return value.richText.map((t) => t.text).join('');
	}

	return String(value);
}
