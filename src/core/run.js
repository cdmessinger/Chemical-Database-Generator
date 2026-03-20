import { fsp, path, importExcel, exportToExcel } from '../utils/index.js';
import { chemicalLookup } from '../../../../SDS-Scraper/core/run.js';

export async function generateChemicalInfo(filePath) {
	const firstCell = 2; // for tracking cell number in "badMatches" for success report, we multiple index by 7 and add this

	//Import our data from excel sheet
	const importedList = await importExcel(filePath);

	if (!importedList) {
		throw new Error('Error: could not import chemical Data');
	}

	const chemicalList = [];

	for (let i = 0; i < importedList.length; i++) {
		const chemicalData = {};

		console.log(importedList[i]);

		chemicalData.name = importedList[i].importedProductName;
		chemicalData.casNumber = importedList[i].importedCasNumber;

		chemicalList.push(chemicalData);
	}

	console.log(chemicalList);

	//run SDS-Scraper
	const { allRecords, dataSummary } = await chemicalLookup(chemicalList);

	console.log('Data Summary:', dataSummary);

	//readd our imported values:
	const fullData = addImportedData(allRecords, importedList);

	console.log(fullData[0].sdsData.data);

	//Export our data to an excel file
	exportToExcel(fullData, 'chemical_database1.xlsx', dataSummary);
}

function addImportedData(allRecords, importedList) {
	//both have same index, since they were built off each other

	for (let i = 0; i < allRecords.length; i++) {
		const importedData = importedList[i];
		const record = allRecords[i];

		record.supplier = importedList[i].importedSupplier;
		record.quantity = importedList[i].importedQuantity;
		record.units = importedList[i].importedUnits;
		record.roomNumber = importedList[i].importedLocation;
		record.cabinet = importedList[i].importedCabinet;
		record.recievedDate = importedList[i].importedReceivedDate;

		console.log(record);
	}
	return allRecords;
}
