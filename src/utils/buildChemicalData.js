const keyMap = {
	// Imported Values
	importedProductName: { key: 'importedProductName', default: 'Missing' },
	importedSupplier: { key: 'importedSupplier', default: 'Missing' },
	searchQuery: { key: 'searchQuery', default: 'Missing' },
	importedQuantity: { key: 'importedQuantity', default: 'Missing' },
	importedUnits: { key: 'importedUnits', default: 'Missing' },
	importedLocation: { key: 'importedLocation', default: 'Missing' },
	importedCabinet: { key: 'importedCabinet', default: 'Missing' },
	importedReceivedDate: { key: 'importedReceivedDate', default: 'Missing' },

	// PubChem API Values 1
	pubChemCidNumber: { key: 'cid', default: 'Not Found' },
	pubChemProductName: { key: 'pubChemProductName', default: 'Not Found' },
	pubChemSynonyms: { key: 'pubChemSynonyms', default: [] },

	// PubChem API Values 2
	pubChemCASNumbers: { key: 'pubChemCASNumbers', default: [] },
	pubChemMolecularFormula: {
		key: 'pubChemMolecularFormula',
		default: 'Not Found',
	},
	pubChemMolecularWeight: {
		key: 'pubChemMolecularWeight',
		default: 'Not Found',
	},
	pubChemSignalWord: { key: 'pubChemSignalWord', default: 'Not Found' },
	pubChemPictograms: { key: 'pubChemPictograms', default: [] },
	pubChemPictogramCodes: { key: 'pubChemPictogramCodes', default: [] },
	pubChemHazardStatements: { key: 'pubChemHazardStatements', default: [] },

	// SDS Parser Values
	sdsRevisionDate: { key: 'sdsRevisionDate', default: 'Not Found' },
	sdsProductName: { key: 'sdsProductName', default: 'Not Found' },
	sdsCASNumber: { key: 'sdsCASNumber', default: 'Not Found' },
	sdsSynonyms: { key: 'sdsSynonyms', default: [] },
	sdsSignalWord: { key: 'sdsSignalWord', default: 'Not Found' },
	sdsHazardStatements: { key: 'sdsHazardStatements', default: [] },
	classification: { key: 'classification', default: 'Not Found' },
	sdsMolecularFormula: { key: 'sdsMolecularFormula', default: 'Not Found' },
	sdsMolecularWeight: { key: 'sdsMolecularWeight', default: 'Not Found' },
	sdsStorageNotes: { key: 'sdsStorageNotes', default: 'Not Found' },
	sdsPictograms: { key: 'sdsPictograms', default: 'Not Found' },
	sdsPictogramCodes: { key: 'sdsPictogramCodes', default: 'Not Found' },

	// Validation Values
	sdsStatusCode: { key: 'sdsStatusCode', default: 'Not Found' },
	sdsConfidenceScore: { key: 'sdsConfidenceScore', default: 'Not Found' },
	sdsConfidenceInfo: { key: 'sdsConfidenceInfo', default: [] },
	sdsLink: { key: 'sdsLink', default: 'Not Found' },
};

export function buildChemicalData(chemicalData, sourceData) {
	if (!sourceData || !keyMap) {
		console.error('buildChemicalData called with bad arguments:', {
			chemicalData,
			sourceData,
			keyMap,
		});
		return chemicalData;
	}

	for (const [targetKey, { key, default: defVal }] of Object.entries(
		keyMap,
	)) {
		const value = sourceData[key];
		if (value !== undefined && value !== null) {
			chemicalData[targetKey] = value;
		} else if (chemicalData[targetKey] === undefined) {
			chemicalData[targetKey] = defVal;
		}
	}
	return chemicalData;
}
