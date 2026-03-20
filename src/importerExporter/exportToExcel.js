import { exec, path, ExcelJS } from '../utils/index.js';

export async function exportToExcel(
	parsedData,
	filepath = 'chemical_data.xlsx',
	dataSummary,
) {
	if (!parsedData || parsedData.length === 0) {
		console.warn('No data to export');
		return;
	}

	const { workbook, summarySheet, dataSheet, exportSheet } =
		createWorkbookAndSheets();

	writedataSummary(summarySheet, dataSummary);

	//write all the data
	writeDataSheet(dataSheet, parsedData);

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
	const summarySheet = workbook.addWorksheet('Success Report');

	const exportSheet = workbook.addWorksheet('Export');
	return { workbook, summarySheet, dataSheet, exportSheet };
}

function writedataSummary(summarySheet, dataSummary) {
	const completed = generatedataSummary(dataSummary);
	const row = summarySheet.addRow(['']);
	row.getCell(1).value = completed;
	summarySheet.mergeCells(1, 1, 40, 5);

	// summarySheet.getCell(1, 7).value = 'FAILED CHEMICAL NAME';
	// summarySheet.getCell(1, 8).value = 'ROW NUMBER IN FULL DATA SHEET';
	// summarySheet.getCell(1, 7).font = { bold: true };
	// summarySheet.getCell(1, 8).font = { bold: true };

	// const badMatches = dataSummary.badMatches;
	// let rowCounter = 2; //start at row 2
	// for (const key in badMatches) {
	// 	const value = badMatches[key];
	// 	summarySheet.getCell(rowCounter, 7).value = value;
	// 	summarySheet.getCell(rowCounter, 8).value = key;
	// 	rowCounter += 1;
	// }

	summarySheet.getColumn(1).alignment = {
		wrapText: true,
		horizontal: 'center',
		vertical: 'center',
	};
	summarySheet.getColumn(2).alignment = {
		wrapText: true,
		horizontal: 'center',
		vertical: 'center',
	};
	summarySheet.getColumn(3).alignment = {
		wrapText: true,
		horizontal: 'center',
		vertical: 'center',
	};
}

function determineExportables(record) {
	//determine data to link to the export sheet, leaving 'missing' where we don't have something

	//name
	if (record.sdsProductName !== 'Product name not found') {
		record.exportableName = record.sdsData.data.sdsProductName;
	} else if (record.pubChemProductName !== 'Product name not found') {
		record.exportableName = record.pubChemData.data.pubChemProductName;
	} else {
		record.exportableName = record.name;
	}
	//synonyms
	if (record.sdsSynonyms !== 'Synonyms not found') {
		record.exportableSyn = record.sdsData.data.sdsSynonyms;
	} else if (record.pubChemSynonyms) {
		record.exportableSyn = record.pubChemData.data.pubChemSynonyms;
	} else {
		record.exportableSyn = 'Missing';
	}
	//CAS
	if (record.sdsCASNumber !== 'CAS Number not found in SDS') {
		record.exportableCAS = record.sdsData.data.sdsCASNumber;
	} else if (record.searchQuery) {
		record.exportableCAS = record.casNumber;
	} else {
		record.exportableCAS = 'Missing';
	}
	//hazards (only sds, if missing label it)
	if (
		record.sdsHazardStatements !==
			'Hazard Statements not found or are not identified for this SDS' &&
		record.sdsHazardStatements !==
			'No valid hazard statements found or are not identified for this SDS'
	) {
		record.exportableHaz = record.sdsData.data.sdsHazardStatements;
	} else {
		record.exportableHaz = 'Missing';
	}
	//signal word
	if (record.sdsSignalWord !== 'Signal word not found') {
		record.exportableSW = record.sdsData.data.sdsSignalWord;
	} else if (record.pubChemSignalWord) {
		record.exportableSW = record.pubChemData.data.pubChemSignalWord;
	} else {
		record.exportableSW = 'Missing';
	}
	//formula
	if (record.sdsMolecularFormula !== 'Formula not found') {
		record.exportableMF = record.sdsData.data.sdsMolecularFormula;
	} else if (record.pubChemMolecularFormula) {
		record.exportableMF = record.pubChemData.data.pubChemMolecularFormula;
	} else {
		record.exportableMF = 'Missing';
	}

	return record;
}

function writeDataSheet(dataSheet, parsedData) {
	if (!parsedData.length) return;

	//set Headers
	dataSheet.getCell(1, 1).value = 'SEARCHED';
	dataSheet.getCell(1, 2).value = 'SUMMARY';
	dataSheet.getCell(1, 3).value = '';
	dataSheet.getCell(1, 4).value = '';
	dataSheet.getCell(1, 5).value =
		'---------------------------------------------------------------------------------EXPORTS (LINKED TO EXPORT SHEET---------------------------------------------------------------------------------';
	dataSheet.getCell(1, 6).value = '';
	dataSheet.getCell(1, 7).value = '';
	dataSheet.getCell(1, 8).value = '';
	dataSheet.getCell(1, 9).value = '';
	dataSheet.getCell(1, 10).value = '';
	dataSheet.getCell(1, 11).value = '';
	dataSheet.getCell(1, 12).value = 'COMPARE';
	dataSheet.getCell(1, 13).value = 'IMPORTED';
	dataSheet.getCell(1, 14).value = 'PUBCHEM';
	dataSheet.getCell(1, 15).value = 'SDS SHEET';
	dataSheet.getCell(1, 16).value = 'HAZARDS';
	dataSheet.getCell(1, 17).value = 'PICTOGRAMS';
	dataSheet.getCell(1, 18).value = 'PICTOGRAM CODES';

	//merge headers
	dataSheet.mergeCells(1, 2, 1, 3);
	dataSheet.mergeCells(1, 5, 1, 10);

	let startRow = 2;

	for (let i = 0; i < parsedData.length; i++) {
		//determine what values we will use from our data to export
		const record = determineExportables(parsedData[i]);

		//row 1
		dataSheet.getCell(startRow, 1).value = record.name;
		dataSheet.getCell(startRow, 2).value = 'STATUS CODE:';
		dataSheet.getCell(startRow, 3).value = record.statusCode;
		dataSheet.getCell(startRow, 4).value = '----------->';
		dataSheet.getCell(startRow, 5).value = 'NAME:';
		dataSheet.getCell(startRow, 6).value = record.exportableName;
		dataSheet.getCell(startRow, 7).value = 'HAZARDS:';
		dataSheet.getCell(startRow, 8).value = formatCellValue(
			record.exportableHaz,
		);
		dataSheet.getCell(startRow, 9).value = 'UNITS';
		dataSheet.getCell(startRow, 10).value = record.units;
		dataSheet.getCell(startRow, 11).value = '<-----------';
		dataSheet.getCell(startRow, 12).value = 'NAME: ';
		dataSheet.getCell(startRow, 13).value = record.name;
		dataSheet.getCell(startRow, 14).value =
			record.pubChemData.data.pubChemProductName;
		dataSheet.getCell(startRow, 15).value =
			record.sdsData.data.sdsProductName;
		dataSheet.getCell(startRow, 16).value = formatCellValue(
			record.sdsData.data.sdsHazardStatements,
		);
		dataSheet.getCell(startRow, 17).value = formatCellValue(
			record.sdsData.data.sdsPictograms,
		);
		dataSheet.getCell(startRow, 18).value = formatCellValue(
			record.sdsData.data.sdsPictogramCodes,
		);

		//row 2
		dataSheet.getCell(startRow + 1, 1).value = '';
		dataSheet.getCell(startRow + 1, 2).value = 'CONFIDENCE SCORE:';
		dataSheet.getCell(startRow + 1, 3).value = record.confidenceScore;
		dataSheet.getCell(startRow + 1, 4).value = '----------->';
		dataSheet.getCell(startRow + 1, 5).value = 'SYNONYMS:';
		dataSheet.getCell(startRow + 1, 6).value = formatCellValue(
			record.exportableSyn,
		);
		dataSheet.getCell(startRow + 1, 7).value = '';
		dataSheet.getCell(startRow + 1, 8).value = '';
		dataSheet.getCell(startRow + 1, 9).value = 'QUANTITY';
		dataSheet.getCell(startRow + 1, 10).value = record.quantity;
		dataSheet.getCell(startRow + 1, 11).value = '<-----------';
		dataSheet.getCell(startRow + 1, 12).value = 'CAS NO.:';
		dataSheet.getCell(startRow + 1, 13).value = record.casNumber;
		dataSheet.getCell(startRow + 1, 14).value = formatCellValue(
			record.pubChemData.data.pubChemCASNumbers,
		);
		dataSheet.getCell(startRow + 1, 15).value =
			record.sdsData.data.sdsCASNumber;
		dataSheet.getCell(startRow + 1, 16).value = '';
		dataSheet.getCell(startRow + 1, 17).value = '';
		dataSheet.getCell(startRow + 1, 18).value = '';

		//row 3
		dataSheet.getCell(startRow + 2, 1).value = '';
		dataSheet.getCell(startRow + 2, 2).value = 'CONF. SCORE INFO:';
		dataSheet.getCell(startRow + 2, 3).value = formatCellValue(
			record.sdsData.data.sdsConfidenceInfo,
		);
		dataSheet.getCell(startRow + 2, 4).value = '----------->';
		dataSheet.getCell(startRow + 2, 5).value = 'SUPPLIER';
		dataSheet.getCell(startRow + 2, 6).value = record.supplier;
		dataSheet.getCell(startRow + 2, 7).value = 'PICTOGRAM CODES:';
		dataSheet.getCell(startRow + 2, 8).value =
			formatCellValue(record.sdsData.data.sdsPictogramCodes) || [];
		dataSheet.getCell(startRow + 2, 9).value = 'STORAGE NOTES';
		dataSheet.getCell(startRow + 2, 10).value =
			record.sdsData.data.sdsStorageNotes;
		dataSheet.getCell(startRow + 2, 11).value = '<-----------';
		dataSheet.getCell(startRow + 2, 12).value = 'SYNONYMS:';
		dataSheet.getCell(startRow + 2, 13).value = '';
		dataSheet.getCell(startRow + 2, 14).value = formatCellValue(
			record.pubChemData.data.pubChemSynonyms,
		);
		dataSheet.getCell(startRow + 2, 15).value = formatCellValue(
			record.sdsData.data.sdsSynonyms,
		);
		dataSheet.getCell(startRow + 2, 16).value = '';
		dataSheet.getCell(startRow + 2, 17).value = '';
		dataSheet.getCell(startRow + 2, 18).value = '';

		//row 4
		dataSheet.getCell(startRow + 3, 1).value = record.casNumber;
		dataSheet.getCell(startRow + 3, 2).value = '';
		dataSheet.getCell(startRow + 3, 3).value = '';
		dataSheet.getCell(startRow + 3, 4).value = '----------->';
		dataSheet.getCell(startRow + 3, 5).value = 'CAS NO:';
		dataSheet.getCell(startRow + 3, 6).value = record.exportableCAS;
		dataSheet.getCell(startRow + 3, 7).value = 'SDS LINK:';
		dataSheet.getCell(startRow + 3, 8).value = {
			text: record.linkToSDS,
			hyperlink: record.linkToSDS,
		};
		//make it look like a hyperlink
		dataSheet.getCell(startRow + 3, 8).font = {
			color: { argb: 'FF0000FF' },
			underline: true,
		};

		dataSheet.getCell(startRow + 3, 9).value = '';
		dataSheet.getCell(startRow + 3, 10).value = '';
		dataSheet.getCell(startRow + 3, 11).value = '<-----------';
		dataSheet.getCell(startRow + 3, 12).value = 'FORMULA:';
		dataSheet.getCell(startRow + 3, 13).value = '';
		dataSheet.getCell(startRow + 3, 14).value =
			record.pubChemData.data.pubChemMolecularFormula;
		dataSheet.getCell(startRow + 3, 15).value =
			record.sdsData.data.sdsMolecularFormula;
		dataSheet.getCell(startRow + 3, 16).value = formatCellValue(
			record.pubChemData.data.pubChemHazardStatements,
		);
		dataSheet.getCell(startRow + 3, 17).value = formatCellValue(
			record.pubChemData.data.pubChemPictograms,
		);
		dataSheet.getCell(startRow + 3, 18).value = formatCellValue(
			record.pubChemData.data.pubChemPictogramCodes,
		);

		//row 5
		dataSheet.getCell(startRow + 4, 1).value = '';
		dataSheet.getCell(startRow + 4, 2).value = '';
		dataSheet.getCell(startRow + 4, 3).value = '';
		dataSheet.getCell(startRow + 4, 4).value = '----------->';
		dataSheet.getCell(startRow + 4, 5).value = 'CLASS:';
		dataSheet.getCell(startRow + 4, 6).value =
			record.sdsData.data.sdsClassification;
		dataSheet.getCell(startRow + 4, 7).value = 'LOCATION:';
		dataSheet.getCell(startRow + 4, 8).value = record.roomNumber;
		dataSheet.getCell(startRow + 4, 9).value = 'FORMULA';
		dataSheet.getCell(startRow + 4, 10).value = record.exportableMF;
		dataSheet.getCell(startRow + 4, 11).value = '<-----------';
		dataSheet.getCell(startRow + 4, 12).value = 'MW:';
		dataSheet.getCell(startRow + 4, 13).value = '';
		dataSheet.getCell(startRow + 4, 14).value =
			record.pubChemData.data.pubChemMolecularWeight;
		dataSheet.getCell(startRow + 4, 15).value =
			record.sdsData.data.sdsMolecularWeight;
		dataSheet.getCell(startRow + 4, 16).value = '';
		dataSheet.getCell(startRow + 4, 17).value = '';
		dataSheet.getCell(startRow + 4, 18).value = '';

		//row 6
		dataSheet.getCell(startRow + 5, 1).value = '';
		dataSheet.getCell(startRow + 5, 2).value = 'ERRORS:';
		dataSheet.getCell(startRow + 5, 3).value =
			formatCellValue(record.errorStatements) || '';
		dataSheet.getCell(startRow + 5, 4).value = '----------->';
		dataSheet.getCell(startRow + 5, 5).value = 'SIGNAL WORD:';
		dataSheet.getCell(startRow + 5, 6).value = record.exportableSW;
		dataSheet.getCell(startRow + 5, 7).value = 'SHELF:';
		dataSheet.getCell(startRow + 5, 8).value = record.cabinet;
		dataSheet.getCell(startRow + 5, 9).value = 'SDS REV. DATE:';
		dataSheet.getCell(startRow + 5, 10).value =
			record.sdsData.data.sdsRevisionDate;
		dataSheet.getCell(startRow + 5, 11).value = '<-----------';
		dataSheet.getCell(startRow + 5, 12).value = 'SIGNAL WORD:';
		dataSheet.getCell(startRow + 5, 13).value = '';
		dataSheet.getCell(startRow + 5, 14).value =
			record.pubChemData.data.pubChemSignalWord;
		dataSheet.getCell(startRow + 5, 15).value =
			record.sdsData.data.sdsSignalWord;
		dataSheet.getCell(startRow + 5, 16).value = '';
		dataSheet.getCell(startRow + 5, 17).value = '';
		dataSheet.getCell(startRow + 5, 18).value = '';

		//Merge cells for formating

		//col 1
		dataSheet.mergeCells(startRow, 1, startRow + 2, 1);
		dataSheet.mergeCells(startRow + 3, 1, startRow + 5, 1);

		//col 2
		dataSheet.mergeCells(startRow + 2, 2, startRow + 4, 2);

		//col 3
		dataSheet.mergeCells(startRow + 2, 3, startRow + 4, 3);

		//col 4 - 6 NO MERGING

		//col 7
		dataSheet.mergeCells(startRow, 7, startRow + 1, 7);

		//col 8
		dataSheet.mergeCells(startRow, 8, startRow + 1, 8);

		//col 9
		dataSheet.mergeCells(startRow + 2, 9, startRow + 3, 9);

		//col 10
		dataSheet.mergeCells(startRow + 2, 10, startRow + 3, 10);

		//col 11 - 15 NO MERGING

		//col 16
		dataSheet.mergeCells(startRow, 16, startRow + 2, 16);
		dataSheet.mergeCells(startRow + 3, 16, startRow + 5, 16);

		//col 17
		dataSheet.mergeCells(startRow, 17, startRow + 2, 17);
		dataSheet.mergeCells(startRow + 3, 17, startRow + 5, 17);

		//col 18
		dataSheet.mergeCells(startRow, 18, startRow + 2, 18);
		dataSheet.mergeCells(startRow + 3, 18, startRow + 5, 18);

		confidenceScoreFormating(dataSheet, startRow);

		//add to the counter to keep in line
		startRow += 7;
	}
}

function confidenceScoreFormating(dataSheet, startRow) {
	const targetColumn = 3; //column C always
	const targetRow = dataSheet.getRow(startRow + 1);
	const targetCell = Number(targetRow.getCell(targetColumn).value);
	const endRow = startRow + 6;

	let color = null;

	//touches every cell to make sure it exists and can be colored.
	for (let i = startRow; i < endRow; i++) {
		const row = dataSheet.getRow(i);
		for (let j = 1; j <= dataSheet.columnCount; j++) {
			const cell = row.getCell(j);
			if (cell.value === undefined) cell.value = ''; // ensure it exists
			cell.fill = {
				type: 'pattern',
				pattern: 'solid',
				fgColor: { argb: color },
			};
		}
	}

	if (targetCell >= 85)
		color = '28e482'; // green, extremely confident
	else if (targetCell >= 70)
		color = '9fcf74'; // yellow-green, pass
	else if (targetCell >= 40)
		color = 'fdf381'; // yellow, needs review
	else color = 'da5d4c'; // red, fail

	for (let i = startRow; i < endRow; i++) {
		const row = dataSheet.getRow(i);
		row.eachCell((cell) => {
			cell.fill = {
				type: 'pattern',
				pattern: 'solid',
				fgColor: { argb: color },
			};
		});
	}
	//make error statements cell 'red' if they are present for visibility
	if (dataSheet.getCell(startRow + 5, 3).value !== '') {
		dataSheet.getCell(startRow + 5, 3).fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'FFFF0000' },
		};
	}
}

function formatCellValue(value) {
	if (Array.isArray(value)) {
		// Handle array of objects
		if (value.length && typeof value[0] === 'object' && value[0] !== null) {
			const sections = [];
			value.forEach((v, i) => {
				// Underlined message
				sections.push({
					text: v.message + '\n',
					font: { underline: true },
				});

				// SDS line
				sections.push({ text: 'SDS: ' });
				sections.push({
					text: (v.sdsValue || '') + '\n',
					font: { bold: true },
				});

				// PubChem line
				sections.push({ text: 'PubChem: ' });
				sections.push({
					text: (v.pubChemValue || '') + '\n',
					font: { bold: true },
				});

				// Penalty line
				sections.push({ text: 'Penalty: ' });
				sections.push({
					text: v.penalty != null ? String(v.penalty) : '',
					font: { bold: true },
				});

				// Divider between entries
				if (i < value.length - 1) {
					sections.push({ text: '\n────────────────────\n' });
				}
			});
			const cleaned = sections.filter(
				(s) => s && typeof s.text === 'string' && s.text.trim() !== '',
			);
			return { richText: cleaned };
		}

		// Handle array of strings/numbers
		// If all entries are short codes (2-letter values), join with commas
		const isShortCodes = value.every(
			(v) => typeof v === 'string' && /^[A-Za-z]{2}$/.test(v.trim()),
		);
		if (isShortCodes) {
			return value.map((v) => v.trim()).join(', ');
		}

		// Otherwise, join with newlines like before
		return value.map((v) => String(v)).join('\n');
	}

	if (typeof value === 'object' && value !== null) {
		return JSON.stringify(value);
	}

	return value;
}

function writeExportSheet(exportSheet, dataSheet) {
	const sheetName = `'${dataSheet.name}'`;
	const totalRows = dataSheet.rowCount;
	const cardHeight = 6;
	const startRow = 2;

	// Clear previous export
	exportSheet.spliceRows(1, exportSheet.rowCount);

	// Add headers
	exportSheet.addRow([
		'ChemicalName',
		'Formula',
		'Synonyms',
		'CatalogCode',
		'CompanyName',
		'Grade',
		'Disposal',
		'CAS',
		'Class',
		'CompatibleFamily',
		'SignalWord',
		'HazardStatement',
		'GHSCodes',
		'SDSURL',
		'School',
		'StoreRoom',
		'Shelf',
		'UOM',
		'LastUsed',
		'MinReorderAmount',
		'Amount',
		'Notes',
		'KitCatalog',
	]);

	// Loop through each card (each card = 6 rows of data)
	for (
		let referenceRow = startRow;
		referenceRow < totalRows;
		referenceRow += cardHeight + 1
	) {
		const row = exportSheet.addRow(new Array(23).fill('')); // create a new export row

		// ✅ Assign formulas as true live links
		row.getCell(1).value = {
			formula: `=${sheetName}!F${referenceRow}`,
			result: null,
		}; // ChemicalName
		row.getCell(2).value = {
			formula: `=${sheetName}!J${referenceRow + 4}`,
			result: null,
		}; // Formula
		row.getCell(3).value = {
			formula: `=${sheetName}!F${referenceRow + 1}`,
			result: null,
		}; // Synonyms
		row.getCell(4).value = ''; // CatalogCode
		row.getCell(5).value = {
			formula: `=${sheetName}!F${referenceRow + 2}`,
			result: null,
		}; // CompanyName
		row.getCell(6).value = ''; // Grade
		row.getCell(7).value = ''; // Disposal
		row.getCell(8).value = {
			formula: `=${sheetName}!F${referenceRow + 3}`,
			result: null,
		}; // CAS
		row.getCell(9).value = {
			formula: `=${sheetName}!F${referenceRow + 4}`,
			result: null,
		}; // Class
		row.getCell(10).value = ''; // CompatibleFamily
		row.getCell(11).value = {
			formula: `=${sheetName}!F${referenceRow + 5}`,
			result: null,
		}; // SignalWord
		row.getCell(12).value = {
			formula: `=${sheetName}!H${referenceRow}`,
			result: null,
		}; // HazardStatement
		row.getCell(13).value = {
			formula: `=${sheetName}!H${referenceRow + 2}`,
			result: null,
		}; // GHSCodes
		row.getCell(14).value = {
			formula: `=${sheetName}!H${referenceRow + 3}`,
			result: null,
		}; // SDSUrl
		row.getCell(15).value = 'CSCC TUNXIS'; // School
		row.getCell(16).value = {
			formula: `=${sheetName}!H${referenceRow + 4}`,
			result: null,
		}; // StoreRoom
		row.getCell(17).value = {
			formula: `=${sheetName}!H${referenceRow + 5}`,
			result: null,
		}; // Shelf
		row.getCell(18).value = {
			formula: `=${sheetName}!J${referenceRow}`,
			result: null,
		}; // UOM
		row.getCell(19).value = ''; // LastUsed
		row.getCell(20).value = ''; // MinReorderAmount
		row.getCell(21).value = {
			formula: `=${sheetName}!J${referenceRow + 1}`,
			result: null,
		}; // Amount
		row.getCell(22).value = {
			formula: `=${sheetName}!J${referenceRow + 2}`,
			result: null,
		}; // Notes
		row.getCell(23).value = ''; // KitCatalog
	}

	// Make sure Excel recalculates all formulas when opened
	exportSheet.workbook.calcProperties.fullCalcOnLoad = true;

	// Optional: basic styling for readability
	exportSheet.getRow(1).font = { bold: true };

	console.log(`✅ Export sheet successfully linked to ${dataSheet.name}`);
}

function addBasicFormating(sheet) {
	const MIN_COL_WIDTH = 10;
	const MAX_COL_WIDTH = 60;
	const LABEL_COL_WIDTH = 18;
	const PADDING = 2;

	sheet.columns.forEach((col, index) => {
		let maxLength = 0;

		col.eachCell({ includeEmpty: true }, (cell) => {
			let cellText = '';

			if (cell.value == null) {
				cellText = '';
			} else if (
				typeof cell.value === 'string' ||
				typeof cell.value === 'number'
			) {
				cellText = cell.value.toString();
			} else {
				cellText = String(cell.value);
			}

			maxLength = Math.max(maxLength, cellText.length);
		});

		// Adjusted for 0-indexed loop
		const columnNumber = index + 1;

		// Fix width for label columns (B, D, F, H, J)
		if ([2, 4, 5, 7, 9, 11, 12].includes(columnNumber)) {
			col.width = LABEL_COL_WIDTH;
		} else {
			const calculatedWidth = maxLength + PADDING;
			col.width = Math.min(
				Math.max(calculatedWidth, MIN_COL_WIDTH),
				MAX_COL_WIDTH,
			);
		}
	});
}

function dataSheetFormating(dataSheet) {
	//FREEZE top row and first column
	dataSheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

	dataSheet.getColumn(1).alignment = {
		wrapText: true,
		horizontal: 'center',
		vertical: 'middle',
	};
	dataSheet.getColumn(2).alignment = {
		wrapText: true,
		horizontal: 'right',
		vertical: 'middle',
	};
	dataSheet.getColumn(3).alignment = {
		wrapText: true,
		horizontal: 'left',
		vertical: 'middle',
	};
	dataSheet.getColumn(4).alignment = {
		wrapText: true,
		horizontal: 'right',
		vertical: 'middle',
	};
	//separator column
	dataSheet.getColumn(6).alignment = {
		wrapText: true,
		horizontal: 'left',
		vertical: 'middle',
	};
	dataSheet.getColumn(7).alignment = {
		wrapText: true,
		horizontal: 'right',
		vertical: 'middle',
	};
	dataSheet.getColumn(8).alignment = {
		wrapText: true,
		horizontal: 'left',
		vertical: 'middle',
	};
	dataSheet.getColumn(9).alignment = {
		wrapText: true,
		horizontal: 'right',
		vertical: 'bottom',
	};
	dataSheet.getColumn(10).alignment = {
		wrapText: true,
		horizontal: 'left',
		vertical: 'bottom',
	};
	//separator column
	dataSheet.getColumn(12).alignment = {
		wrapText: true,
		horizontal: 'right',
		vertical: 'middle',
	};
	dataSheet.getColumn(13).alignment = {
		wrapText: true,
		horizontal: 'left',
		vertical: 'middle',
	};
	dataSheet.getColumn(14).alignment = {
		wrapText: true,
		horizontal: 'left',
		vertical: 'middle',
	};
	dataSheet.getColumn(15).alignment = {
		wrapText: true,
		horizontal: 'left',
		vertical: 'middle',
	};
	dataSheet.getColumn(16).alignment = {
		wrapText: true,
		horizontal: 'left',
		vertical: 'middle',
	};
	dataSheet.getColumn(17).alignment = {
		wrapText: true,
		horizontal: 'left',
		vertical: 'middle',
	};
	dataSheet.getColumn(18).alignment = {
		wrapText: true,
		horizontal: 'left',
		vertical: 'middle',
	};

	const labelColumns = [2, 4, 5, 7, 9, 11, 12];

	for (const column of labelColumns)
		dataSheet.getColumn(column).eachCell({ includeEmpty: true }, (cell) => {
			cell.fill = {
				type: 'pattern',
				pattern: 'solid',
				fgColor: { argb: 'FF686B69' },
			};
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
				fgColor: { argb: 'FF000000' },
			};
		}
		rowCount += 7;
	}

	//set headers
	dataSheet.getRow(1).alignment = {
		horizontal: 'center',
		vertical: 'middle',
	};
	dataSheet.getRow(1).font = {
		bold: true,
		size: 16,
		color: { argb: 'FFDDDDDD' },
	};
	dataSheet.getRow(1).eachCell({ includeEmpty: true }, (cell) => {
		cell.fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'FF000000' }, //black background
		};
	});
	const dataColumns = [6, 8, 10, 14, 15, 16, 17, 18];

	for (const column of dataColumns) {
		const currCol = dataSheet.getColumn(column);
		currCol.eachCell({ includeEmpty: true }, (cell) => {
			if (
				cell.value === '' ||
				cell.value === 'Not Found' ||
				cell.value === 'Missing'
			) {
				cell.fill = {
					type: 'pattern',
					pattern: 'solid',
					fgColor: { argb: 'FFFF0000' }, // red
				};
			}
		});
	}

	dataSheet.eachRow((row, rowNumber) => {
		row.eachCell((cell, colNumber) => {
			// Medium gray border
			cell.border = {
				top: { style: 'medium', color: { argb: 'FFDDDDDD' } },
				left: { style: 'medium', color: { argb: 'FFDDDDDD' } },
				bottom: { style: 'medium', color: { argb: 'FFDDDDDD' } },
				right: { style: 'medium', color: { argb: 'FFDDDDDD' } },
			};

			// Black fill in column 4 and 11 (except header)
			if (rowNumber !== 1 && colNumber === 4) {
				cell.fill = {
					type: 'pattern',
					pattern: 'solid',
					fgColor: { argb: 'FF000000' },
				};
			}
			if (rowNumber !== 1 && colNumber === 11) {
				cell.fill = {
					type: 'pattern',
					pattern: 'solid',
					fgColor: { argb: 'FF000000' },
				};
			}

			// Light gray-blue fill in column 12 if empty
			if (
				rowNumber !== 1 &&
				colNumber === 13 &&
				(!cell.value || cell.value === '')
			) {
				cell.fill = {
					type: 'pattern',
					pattern: 'solid',
					fgColor: { argb: 'FFBFD1D6' },
				};
			}
		});
	});
}

function generateSummary(record) {
	const richRuns = [];

	richRuns.push(
		{ text: 'Summary\n', font: { bold: true, underline: true } },
		{ text: 'Name Comparison\n', font: { bold: true } },
		{ text: 'Inventory: ' },
		{
			text: String(record.name || 'N/A'),
			font: { bold: true },
		},
		{ text: '\nSDS: ' },
		{
			text: String(record.sdsData.data.sdsProductName || 'N/A'),
			font: { bold: true },
		},
		{ text: '\nPubChem: ' },
		{
			text: String(record.pubChemData.data.pubChemName || 'N/A'),
			font: { bold: true },
		},
		{ text: '\n────────────────────\n' },
		{ text: 'CAS Comparison\n', font: { bold: true } },
		{ text: 'Inventory: ' },
		{ text: String(record.casNumber || 'N/A'), font: { bold: true } },
		{ text: '\nSDS: ' },
		{
			text: String(record.sdsData.data.sdsCASNumber || 'N/A'),
			font: { bold: true },
		},
		{ text: '\nPubChem: ' },
		{
			text: String(record.pubChemData.data.pubChemCASNumber || 'N/A'),
			font: { bold: true },
		},
	);

	const cleaned = richRuns.filter(
		(s) => s && typeof s.text === 'string' && s.text.trim() !== '',
	);
	return { richText: cleaned };
}

function generatedataSummary(dataSummary) {
	const richRuns = [];

	const successPercent =
		(dataSummary.passedSDSCount / dataSummary.totalSearches) * 100;
	const reviewPercent =
		(dataSummary.reviewSDSCount / dataSummary.totalSearches) * 100;
	const failedPercent =
		(dataSummary.failedSDSCount / dataSummary.totalSearches) * 100;
	const errorPercent =
		(dataSummary.errorsEncountered / dataSummary.totalSearches) * 100;

	richRuns.push(
		{
			text: 'Summary and Success Report\n',
			font: { bold: true, size: 16, underline: true },
		},
		{ text: '\nDate:\n' },
		{
			text: String(dataSummary.runDate),
			font: { bold: true, underline: true },
		},
		{ text: '\n_______________________________\n' },
		{ text: 'Runtime:\n' },
		{
			text: String(dataSummary.runTime),
			font: { bold: true, underline: true },
		},
		{ text: '\n_______________________________\n' },
		{ text: 'Total Chemicals ran:\n' },
		{
			text: String(dataSummary.totalSearches),
			font: { bold: true, underline: true },
		},
		{ text: '\n_______________________________\n' },
		{ text: 'Successful SDS Sheets' },
		{ text: '\nTotal: ', font: { bold: true, underline: true } },
		{
			text: String(dataSummary.passedSDSCount),
			font: { bold: true, underline: true },
		},
		{ text: '\nPercentage: ', font: { bold: true, underline: true } },
		{ text: String(successPercent), font: { bold: true, underline: true } },
		{ text: '%', font: { bold: true, underline: true } },
		{ text: '\n_______________________________\n' },
		{ text: 'SDS Sheets that need review' },
		{ text: '\nTotal: ', font: { bold: true, underline: true } },
		{
			text: String(dataSummary.reviewSDSCount),
			font: { bold: true, underline: true },
		},
		{ text: '\nPercentage: ', font: { bold: true, underline: true } },
		{ text: String(reviewPercent), font: { bold: true, underline: true } },
		{ text: '%', font: { bold: true, underline: true } },
		{ text: '\n_______________________________\n' },
		{ text: 'Failed SDS Sheets' },
		{ text: '\nTotal: ', font: { bold: true, underline: true } },
		{
			text: String(dataSummary.failedSDSCount),
			font: { bold: true, underline: true },
		},
		{ text: '\nPercentage: ', font: { bold: true, underline: true } },
		{ text: String(failedPercent), font: { bold: true, underline: true } },
		{ text: '%', font: { bold: true, underline: true } },
		{ text: '\n_______________________________\n' },
		{ text: 'Errors encountered' },
		{ text: '\nTotal: ', font: { bold: true, underline: true } },
		{
			text: String(dataSummary.errorsEncountered),
			font: { bold: true, underline: true },
		},
		{ text: '\nPercentage: ', font: { bold: true, underline: true } },
		{ text: String(errorPercent), font: { bold: true, underline: true } },
		{ text: '%', font: { bold: true, underline: true } },
	);

	const cleaned = richRuns.filter(
		(s) => s && typeof s.text === 'string' && s.text.trim() !== '',
	);
	return { richText: cleaned };
}
