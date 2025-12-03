import {
	puppeteer,
	fs,
	stat,
	path,
	pdfjsLib,
	fetch,
	resourceLimits,
	removeNameAndRevisionDate,
	cleanHazardBlock,
	findHCodes,
} from '../utils/index.js';

export function pdfParse(chemicalData, textPath) {
	const text = fs.readFileSync(textPath, 'utf-8');
	const sdsData = { errorCode: [] };
	const searchedCAS = chemicalData.searchQuery;
	let sdsNormalizedDate = null;

	try {
		// Grab revision date
		const revision = text.match(
			/Revision Date[:\s]*([\s\S]*?)(?=Revision Number|Product Name|$)/i,
		);

		if (revision && revision[1]) {
			let rawDate = revision[1].trim();

			// Strictly match only the date (e.g., "14-Nov-2014")
			const dateMatch = rawDate.match(/(\d{2})-(\w{3})-(\d{4})/);

			if (dateMatch) {
				const [, day, month, year] = dateMatch;
				const months = {
					Jan: '01',
					Feb: '02',
					Mar: '03',
					Apr: '04',
					May: '05',
					Jun: '06',
					Jul: '07',
					Aug: '08',
					Sep: '09',
					Oct: '10',
					Nov: '11',
					Dec: '12',
				};

				const formattedDate = `${year}-${months[month]}-${day}`;
				const parsedDate = new Date(formattedDate);

				if (!isNaN(parsedDate.getTime())) {
					sdsData.sdsRevisionDate = dateMatch[0]; // Original format
					sdsData.sdsNormalizedDate = formattedDate; // ISO format
				} else {
					sdsData.sdsRevisionDate = `Invalid Date Format: ${rawDate}`;
					sdsData.errorCode.push(
						'Could not check Revision Date Automatically',
					);
					sdsData.sdsNormalizedDate = null;
				}
			} else {
				sdsData.sdsRevisionDate = `Invalid or missing date: ${rawDate}`;
				sdsData.errorCode.push('Could not find valid Revision Date');
				sdsData.sdsNormalizedDate = null;
			}
		} else {
			sdsData.sdsRevisionDate = 'Revision date not found';
			sdsData.errorCode.push('Error: could not retrieve revision date');
			sdsData.sdsNormalizedDate = null;
		}

		//Grab Product Name
		const productName = text.match(/Product Name[:\s]*([\s\S]*?)(?=Cat)/i); //stops at "cat" for catalog number. If chemical contains "cat" it will break, unlikely.
		if (productName && productName[1]) {
			sdsData.sdsProductName = productName[1].trim();
		} else {
			sdsData.sdsProductName = 'Product name not found';
			sdsData.errorCode.push(
				'Error: could not retrieve product name from SDS',
			);
		}

		//Remove page headers - Fisher has page breaks with name/revision date headers, we want to filter out all of these to not get parsing issues.
		const cleanedText = removeNameAndRevisionDate(
			sdsData.sdsProductName,
			sdsData.sdsRevisionDate,
			text,
		);

		//grab CAS No
		const casNumber = cleanedText.match(
			/CAS[\s\-]*No\.?[:\s]*([\d\s\-]+)/i,
		);
		if (casNumber && casNumber[1]) {
			sdsData.sdsCASNumber = casNumber[1].trim();
		} else {
			sdsData.sdsCASNumber = 'CAS Number not found in SDS';
			sdsData.errorCode = sdsData.errorCode || [];
			sdsData.errorCode.push(
				'Error: could not retrieve CAS number from SDS',
			);
		}

		//Grab Synonyms
		const synonyms = cleanedText.match(
			/Synonyms[:\s]*([\s\S]*?)(?=Recommended)/i,
		); //stops at "recommended" which is next section
		if (synonyms && synonyms[1]) {
			sdsData.sdsSynonyms = synonyms[1]
				.split(';')
				.map((s) => s.trim())
				.filter((s) => s.length > 0);
		} else {
			sdsData.sdsSynonyms = 'Synonyms not found';
			sdsData.errorCode.push(
				'Error: could not retrieve synonyms from SDS',
			);
		}

		//Grab Signal Word
		const signalWord = cleanedText.match(
			/Signal Word[:\s]*([\s\S]*?)(?=Hazard)/i,
		);
		if (signalWord && signalWord[1]) {
			if (signalWord[1].includes('Danger')) {
				sdsData.sdsSignalWord = 'Danger';
			} else if (signalWord[1].includes('Warning')) {
				sdsData.sdsSignalWord = 'Warning';
			} else {
				sdsData.sdsSignalWord = 'Not Found';
			}
		} else {
			sdsData.sdsSignalWord =
				'Signal word not found - nothing found from PDF';
			sdsData.errorCode.push(
				'Error: could not retrieve Signal Word from SDS, might not exist',
			);
		}

		//Grab Hazard Statements and separate them for csv exporter later

		let unfilteredHazards = cleanedText.match(
			/<<<SECTION_2_START>>>([\s\S]*?)<<<SECTION_3_START>>>/,
		);

		if (unfilteredHazards && unfilteredHazards[1]) {
			let hazardBlock = unfilteredHazards[1];

			const cleanedHazardBlock = cleanHazardBlock(hazardBlock);
			const hazardArray = cleanedHazardBlock.split('\n');

			// normalize for dedupe — remove plural "s" at end of words like "solid/solids"
			const uniqueHazards = [];
			const seen = new Set();

			for (const line of hazardArray) {
				const normalized = line
					.trim()
					.toLowerCase()
					.replace(/([a-z]{3,})s\b/, '$1'); // removes trailing plural

				if (!seen.has(normalized)) {
					seen.add(normalized);
					uniqueHazards.push(line); // keep the original version (correct casing, punctuation)
				}
			}

			//attempt to map hazards to actual H Code statements
			const { allHazardStatements, allPictograms, allPictogramCodes } =
				findHCodes(uniqueHazards);

			sdsData.sdsHazardStatements = allHazardStatements;
			sdsData.sdsPictograms = allPictograms;
			sdsData.sdsPictogramCodes = allPictogramCodes;
		} else {
			sdsData.sdsHazardStatements = 'Hazard Statements not found';
			sdsData.sdsPictograms = 'Pictograms not found';
			sdsData.sdsPictogramCodes = 'Pictogram codes not found';

			sdsData.errorCode.push(
				'"Error: could not retrieve Hazard Statements or pictograms from SDS"',
			);
		}

		//Grab Storage Notes
		let storageMatch = cleanedText.match(
			/<<<SECTION_7_START>>>([\s\S]*?)<<<SECTION_8_START>>>/,
		);
		let storageSection = storageMatch ? storageMatch[1] : '';

		const storageNotes = storageSection.match(
			/[Ss]torage\s*[.:–-]*\s*([\s\S]*)/i,
		);
		if (storageNotes && storageNotes[1]) {
			sdsData.sdsStorageNotes = storageNotes[1].trim();
		} else {
			sdsData.sdsStorageNotes = '';
			sdsData.errorCode.push('Error: No Storage Notes Found from SDS');
		}

		//No longer grabbing this, leaving for now.
		// //Grab Class
		//     const dotClass = cleanedText.match(/Hazard\s*Class[:\s]*([^\s]+)/i);
		//     if (dotClass && dotClass[1]) {
		//         sdsData.class = dotClass[1].trim();
		//     }
		//     else {
		//         sdsData.class = 'Hazard Class not found';
		//         sdsData.errorCode.push("Error: could not retrieve Hazard Class from SDS");
		//     }

		//Grab molecular formula
		const molecularFormulaRegex =
			/Molecular Formula[:\s]*([A-Za-z0-9·\-\+\(\)\.\s]+?)(?=\r?\n|$|Molecular Weight|MolecularWeight|Component|CAS|Section|\d+\s*mg)/;

		const molecularFormula = text.match(molecularFormulaRegex);

		if (molecularFormula && molecularFormula[1]) {
			sdsData.sdsMolecularFormula = molecularFormula[1]
				.trim()
				.replace(/\s+/g, '');
		} else {
			sdsData.sdsMolecularFormula = 'Molecular Formula not found';
			sdsData.errorCode.push(
				'Error: could not retrieve molecular formula from SDS',
			);
		}

		//Grab molecular Weight
		const molecularWeight = text.match(
			/Molecular\s*Weight[:\s]*([0-9.,]+\s*(?:g\/mol)?)/i,
		);
		if (molecularWeight && molecularWeight[1]) {
			sdsData.sdsMolecularWeight = molecularWeight[1].trim();
		} else {
			sdsData.sdsMolecularWeight = 'Molecular Formula not found';
			sdsData.errorCode.push(
				'Error: could not retrieve molecular weight from SDS',
			);
		}

		const classification = generateClassification(chemicalData, sdsData);
		if (classification) {
			sdsData.classification = classification;
		} else {
			sdsData.classification = 'Classification not found';
			sdsData.errorCode.push(
				'Error: could not classify chemical via name/formula',
			);
		}

		// //validating data
		validateData(chemicalData, sdsData);
	} catch (err) {
		console.error('Error parsing SDS data:', err.message);
		console.log('partial SDS info:', sdsData);
		sdsData.errorCode.push(
			`ERROR parsing ALL sds information. ${err.message}`,
		);
	}
	return sdsData;
}

function validateData(chemicalData, sdsData) {
	let confidenceScore = 100;
	let statusCode = '';
	const confidenceScoreInfo = [];
	const sdsNormalizedDate = new Date(sdsData.sdsNormalizedDate);
	const cutoffDate = new Date('2020-01-01');

	//check CAS Numbers
	if (sdsData.sdsCASNumber !== chemicalData.searchQuery) {
		console.log('CAS does not match searchQuery, checking PubChem numbers');

		const matchInPubChem = chemicalData.pubChemCASNumbers.includes(
			sdsData.sdsCASNumber,
		);

		if (matchInPubChem) {
			confidenceScore -= 20;
			console.log(
				`SDS CAS (${sdsData.sdsCASNumber}) matches a PubChem CAS number (${chemicalData.pubChemCASNumbers}) but not searchQuery(${chemicalData.searchQuery}), -20`,
				confidenceScore,
			);
			confidenceScoreInfo.push(
				`SDS CAS (${sdsData.sdsCASNumber}) matches a PubChem CAS number (${chemicalData.pubChemCASNumbers}) but not searchQuery(${chemicalData.searchQuery}), -20`,
			);
			confidenceScoreInfo.push({
				message:
					'SDS CAS number matches a pubchem CAS number but not searched CAS',
				sdsValue: sdsData.sdsCASNumber,
				pubChemValue: chemicalData.searchQuery,
				penalty: '-20',
			});
		} else {
			confidenceScore -= 40;
			console.log(
				`SDS CAS (${sdsData.sdsCASNumber}) does not match PubChem CAS numbers (${chemicalData.pubChemCASNumbers}) or searchQuery (${chemicalData.searchQuery}), -40`,
				confidenceScore,
			);
			confidenceScoreInfo.push({
				message:
					'SDS CAS number does not match seached CAS OR a PubChem CAS number',
				sdsValue: sdsData.sdsCASNumber,
				pubChemValue: chemicalData.pubChemCASNumbers,
				penalty: '-40',
			});
		}
	}

	//check Name (filtered)
	const normalizedSDSName = normalizeChemicalName(
		sdsData.sdsProductName || '',
	);
	const normalizedPubChemName = normalizeChemicalName(
		chemicalData.pubChemProductName || '',
	);

	if (!normalizedSDSName || !normalizedPubChemName) {
		confidenceScore -= 5;
		confidenceScoreInfo.push({
			message: 'Missing chemical name from SDS or Pubchem',
			sdsValue: normalizedSDSName,
			pubChemValue: normalizedPubChemName,
			penalty: '-5',
		});
	} else if (
		normalizedSDSName.includes(normalizedPubChemName) ||
		normalizedPubChemName.includes(normalizedSDSName)
	) {
		console.log(
			`Chemical names (normalized) loosely match, -0, SDS: ${normalizedSDSName}, PubChem: ${normalizedPubChemName}`,
			`Confidence Score: ${confidenceScore}`,
		);
	} else {
		confidenceScore -= 5;
		console.log(
			`Chemical names (normalized) do not match, -0, SDS: ${normalizedSDSName}, PubChem: ${normalizedPubChemName}, -5`,
			`Confidence Score: ${confidenceScore}`,
		);
		confidenceScoreInfo.push({
			message: 'Chemical Names (normalized) do not match',
			sdsValue: normalizedSDSName,
			pubChemValue: normalizedPubChemName,
			penalty: '-5',
		});
	}

	//check signal word
	if (
		chemicalData.pubChemSignalWord.toLowerCase().trim() ===
		sdsData.sdsSignalWord.toLowerCase().trim()
	) {
		console.log(
			`Signal words match, SDS: ${sdsData.sdsSignalWord}, PubChem: ${chemicalData.pubChemSignalWord} -0`,
			`Confidence Score: ${confidenceScore}`,
		);
	} else {
		confidenceScore -= 5;
		console.log(
			`Signal words do not match, SDS: ${sdsData.sdsSignalWord}, PubChem: ${chemicalData.pubChemSignalWord} -5`,
			`Confidence Score: ${confidenceScore}`,
		);
		confidenceScoreInfo.push({
			message: 'Signal words do not match',
			sdsValue: sdsData.sdsSignalWord,
			pubChemValue: chemicalData.pubChemSignalWord,
			penalty: '-5',
		});
	}

	//check molecular formula (filtered)
	const normalizedSDSFormula = normalizeMolecularFormula(
		sdsData.sdsMolecularFormula,
	);
	const normalizedPubChemFormula = normalizeMolecularFormula(
		chemicalData.pubChemMolecularFormula,
	);

	if (normalizedSDSFormula === normalizedPubChemFormula) {
		console.log(
			`SDS Formula (normalized: ${normalizedSDSFormula}) matches Pubchem Formula (normalized: ${normalizedPubChemFormula}), -0`,
			`Confidence Score: ${confidenceScore}`,
		);
	} else {
		confidenceScore -= 10;
		console.log(
			`SDS Formula (normalized: ${normalizedSDSFormula}) DOES NOT match Pubchem Formula (normalized: ${normalizedPubChemFormula}), -10`,
			`Confidence Score: ${confidenceScore}`,
		);
		confidenceScoreInfo.push({
			message: 'Molecular Formulas (normalized) do not match',
			sdsValue: normalizedSDSFormula,
			pubChemValue: normalizedPubChemFormula,
			penalty: '-10',
		});
	}

	//check molecular weight
	const sdsMW = Number(sdsData.sdsMolecularWeight);
	const pubchemMW = Number(chemicalData.pubChemMolecularWeight);

	if (isNaN(sdsMW)) {
		confidenceScore -= 20;
		confidenceScoreInfo.push('No molecular weight found in SDS (-20)');
		console.log(
			'No molecular weight found in SDS (-20)',
			`Confidence Score: ${confidenceScore}`,
		);
	} else if (!isNaN(pubchemMW)) {
		if (sdsMW >= pubchemMW - 1 && sdsMW <= pubchemMW + 1) {
			console.log(
				`Molecular weight within +/- 1 g/mol, SDS: ${sdsMW}, PubChem: ${pubchemMW}`,
				`Confidence Score: ${confidenceScore}`,
			);
		} else {
			confidenceScore -= 20;
			console.log(
				`Molecular weight NOT within +/- 1 g/mol`,
				`Confidence Score: ${confidenceScore}`,
			);
			confidenceScoreInfo.push({
				message: 'Molecular Weight NOT within +/- 1 g/mol',
				sdsValue: sdsMW,
				pubChemValue: pubchemMW,
				penalty: '-20',
			});
		}
	}

	//check revision date

	if (sdsNormalizedDate && sdsNormalizedDate > cutoffDate) {
		console.log(
			`SDS revision date (${
				sdsNormalizedDate.toISOString().split('T')[0]
			}) is after cutoff: (${
				cutoffDate.toISOString().split('T')[0]
			}), -0`,
			`Confidence Score: ${confidenceScore}`,
		);
	} else {
		confidenceScore -= 40;
		console.log(
			`SDS revision date (${
				sdsNormalizedDate.toISOString().split('T')[0]
			}) is BEFORE cutoff: (${
				cutoffDate.toISOString().split('T')[0]
			}), -40`,
			`Confidence Score: ${confidenceScore}`,
		);
		confidenceScoreInfo.push(
			`SDS revision date (${
				sdsNormalizedDate.toISOString().split('T')[0]
			}) is BEFORE cutoff: (${
				cutoffDate.toISOString().split('T')[0]
			}), -40`,
		);
		confidenceScoreInfo.push({
			message: 'SDS Revision Date is before Cutoff Date',
			sdsValue: sdsNormalizedDate.toISOString().split('T')[0],
			pubChemValue: cutoffDate.toISOString().split('T')[0],
			penalty: '-40',
		});
	}

	//Confidence Scoring
	if (confidenceScore >= 85) {
		statusCode = '✅✅ Extremely Confident';
	} else if (confidenceScore >= 70 && confidenceScore <= 84) {
		statusCode = '✅ Pass';
	} else if (confidenceScore > 40 && confidenceScore <= 69) {
		statusCode = '⚠️  Needs Review';
	} else {
		statusCode = '❌ Fail';
	}
	if (confidenceScore < 0) {
		confidenceScore = 0;
	}

	sdsData.sdsStatusCode = statusCode;
	sdsData.sdsConfidenceScore = confidenceScore;
	sdsData.sdsConfidenceInfo = confidenceScoreInfo;

	return sdsData;
}

function normalizeChemicalName(name) {
	if (!name) return '';

	return name
		.toLowerCase() // lowercase everything
		.replace(/[^a-z0-9]/gi, ' ') // remove all non-alphanumeric characters
		.replace(/\s+/g, ' ') // collapse multiple spaces into one
		.trim(); // trim leading and trailing spaces
}

function normalizeMolecularFormula(formula) {
	if (!formula) return '';

	return formula
		.toUpperCase() // standardize casing (C not c)
		.replace(/\s+/g, '') // remove spaces
		.trim();
}

function generateClassification(chemicalData, sdsData) {
	let n = (sdsData.sdsProductName || chemicalData.pubChemProductName || '')
		.toLowerCase()
		.trim(); //name
	let f = (
		sdsData.sdsMolecularFormula !== 'Molecular Formula not found'
			? sdsData.sdsMolecularFormula
			: chemicalData.pubChemMolecularFormula || ''
	)
		.toUpperCase()
		.trim(); //formula
	f = f.replace(/[·\*]\s*\d*H2O/i, ''); //remove hydrate reclassification

	const metals = /(na|k|mg|ca|fe|cu|zn|al|ba|pb|ag|ni|co|mn|cr)/i;

	const classificationRules = [
		{
			test: (n, f) => n.includes('acid') || f.startsWith('H'),
			result: 'Inorganic acid',
		},
		{
			test: (n, f) => n.includes('hydroxide') || f.endsWith('OH'),
			result: 'Base',
		},
		{
			test: (n, f) => /acetone|ethanol|hexane|methanol|toluene/i.test(n),
			result: 'Solvent',
		},
		{
			test: (n, f) =>
				f.includes('C') && f.includes('H') && n.includes('acid'),
			result: 'Organic acid',
		},
		{
			test: (n, f) =>
				f.includes('C') && f.includes('H') && !metals.test(f),
			result: 'Organic compound',
		},
		{
			test: (n, f) => n.includes('peroxide') || f.includes('O-O'),
			result: 'Oxidizer',
		},
		{
			test: (n, f) =>
				/(nitrate|sulfate|chloride|carbonate|phosphate|bromide|iodide|fluoride|acetate|permanganate|chromate)/i.test(
					n,
				) ||
				/(NO3|SO4|CL|BR|I|F|CO3|PO4|MNO4|CRO4|CH3COO|C2H3O2)/i.test(f),
			result: 'Inorganic salt',
		},
		{
			test: (n, f) => !f.includes('C'),
			result: 'Inorganic (other)',
		},
	];

	//check each rule
	for (const rule of classificationRules) {
		if (rule.test(n, f)) {
			return rule.result;
		}
	}
	return 'Unknown';
}
