//maybe refactor so you can have 1 lookup fuction and provide it a source to lookup? just cleaner code\

import { readFile, readFileSync } from 'fs';

const hCodeText = readFileSync('./data/hCodeMap.json', 'utf-8');
const nonHCodeText = readFileSync('./data/non_hCodeMap.json', 'utf-8');
const hCodeMap = JSON.parse(hCodeText);
const nonHCodeMap = JSON.parse(nonHCodeText);

const hazardBuckets = {
	acute: [
		// Skull & Crossbones (GHS06)
		'H300',
		'H301',
		'H302',
		'H310',
		'H311',
		'H312',
		'H330',
		'H331',
		'H332',
		// Also narcotic/respiratory irritation that falls under acute effects
		'H304',
		'H333',
		'H334',
		'H335',
		'H336',
	],

	corrosive: [
		// Corrosion pictogram (GHS05)
		'H290',
		'H314',
		'H318',
	],

	flammable: [
		// Flame pictogram (GHS02)
		'H220',
		'H221',
		'H222',
		'H223',
		'H224',
		'H225',
		'H226',
		'H227',
		'H228',
		'H229',
		'H241',
		'H242',
		'H250',
		'H251',
		'H252',
		'H260',
		'H261',
	],

	healthHazard: [
		// Chronic health hazards (GHS08)
		'H304',
		'H340',
		'H341',
		'H350',
		'H351',
		'H360',
		'H360F',
		'H360D',
		'H360FD',
		'H360Df',
		'H360Fd',
		'H361',
		'H361f',
		'H361d',
		'H361fd',
		'H362',
		'H370',
		'H371',
		'H372',
		'H373',
	],

	gas: [
		// Gas cylinder pictogram (GHS04)
		'H270',
		'H271',
		'H272', // oxidizing gases sometimes overlap
		'H280',
		'H281',
	],

	environmental: [
		// Environmental hazard (GHS09)
		'H400',
		'H401',
		'H402',
		'H410',
		'H411',
		'H412',
		'H413',
	],

	irritant: [
		// Exclamation mark pictogram (GHS07)
		'H303',
		'H313',
		'H315',
		'H316',
		'H317',
		'H319',
		'H335',
		'H336',
	],

	explosive: [
		// Exploding bomb pictogram (GHS01)
		'H200',
		'H201',
		'H202',
		'H203',
		'H204',
		'H205',
		'H230',
		'H231',
		'H240',
	],

	oxidizer: [
		// Flame over circle (GHS03)
		'H270',
		'H271',
		'H272',
	],
};

const keywordToHCodeLookup = {
	//Acute Toxicity
	toxic: 'acute',
	toxicity: 'acute',
	acute: 'acute',
	fatal: 'acute',
	poison: 'acute',
	organs: 'acute',
	//Corrosive
	corrosive: 'corrosive',
	corrosion: 'corrosive',
	acid: 'corrosive',
	base: 'corrosive',
	//Irritant
	irritant: 'irritant',
	irritation: 'irritant',
	sensitivity: 'irritant',
	allergic: 'irritant',
	//Flammable
	flammable: 'flammable',
	flame: 'flammable',
	combustible: 'flammable',
	combustion: 'flammable',
	combust: 'flammable',
	ignite: 'flammable',
	ignitable: 'flammable',
	//Oxidizer
	oxidizing: 'oxidizer',
	oxidizer: 'oxidizer',
	//Health Hazard
	health: 'healthHazard',
	'health hazard': 'healthHazard',
	healthhazard: 'healthHazard',
	carcinogenic: 'healthHazard',
	carcinogen: 'healthHazard',
	cancer: 'healthHazard',
	mutagenic: 'healthHazard',
	mutagen: 'healthHazard',
	reproductive: 'healthHazard',
	'target organ': 'healthHazard',
	targetorgan: 'healthHazard',
	//Environmental
	aquatic: 'environmental',
	environmental: 'environmental',
	environment: 'environmental',
	marine: 'environmental',
	water: 'environmental',
	ecosystem: 'environmental',
	//Gas
	gas: 'gas',
	compressed: 'gas',
	compress: 'gas',
	pressure: 'gas',
	pressurized: 'gas',
	//Explosive
	explosive: 'explosive',
	explosion: 'explosive',
	explode: 'explosive',
	reactive: 'explosive',
};

export function findHCodes(hazardArray) {
	console.log('====================================');
	console.log('INPUT HAZARDS: ', hazardArray);
	console.log('====================================');

	//if no hazards exist, return instantly with 'none' values
	if (hazardArray.length === 1 && hazardArray[0] === '') {
		console.log('TRIGGERED INSTANT RETURN BECAUSE OF NO HAZARDS');
		return {
			allHazardStatements: 'None Identified',
			allPictograms: '',
			allPictogramCodes: '',
			signalWord: 'None',
		};
	}

	const allResults = [];
	const allHazardStatements = [];
	const pictogramSet = new Set();
	const pictogramCodeSet = new Set();
	const hCodeSet = new Set();

	for (const hazard of hazardArray) {
		//convert sds statement into an array of words to check
		const wordArray = normalizeHazStatment(hazard);
		console.log('HAZARD STATEMENT: ', wordArray);

		for (let [keyword, label] of Object.entries(keywordToHCodeLookup)) {
			//ignores a weird parsing issue that sometimes returns "category" inside hazard statements --> just skips entry

			let lowerCaseHaz = hazard.toLowerCase();

			if (
				lowerCaseHaz.includes('category') ||
				lowerCaseHaz.includes('specific')
			) {
				console.log(
					'hazard contains "category" or "specific organ" --> ignored: ',
					hazard,
				);
				break;
			}

			if (wordArray.includes(keyword)) {
				//First check --> check the list of HCODES in the corresponding bucket based on a keyword match
				const data = hCodeLookup(wordArray, label);

				if (checkPercentMatch(data) === true) {
					allResults.push(data);
					break;
				}

				console.log('running check 2 on: ', hazard);
				const fallbackLookup = fallBackMapper(wordArray, label);

				if (checkPercentMatch(fallbackLookup) === true) {
					allResults.push(fallbackLookup);
					break;
				}

				console.log('running check 3 on: ', hazard);
				const nonHCodeData = nonHCodeLookup(wordArray);

				if (checkPercentMatch(nonHCodeData) === true) {
					allResults.push(nonHCodeData);
					break;
				} else {
					//return whatever we input
					console.log('NO CONFIDENT MATCHES FOUND FOR: ', hazard);
					allResults.push({
						bestMatch: hazard,
						hCode: 'None',
						pictogram: '',
						pictogramCode: '',
						percentMatch: 'No match found',
					});
					break;
				}
			} else {
				//run check on ALL hcodes and non-hcodes
				console.log('NO KEYWORD MATCH RUNNING BACKUP');
				const fallbackLookup = fallBackMapper(
					wordArray,
					(label = 'none'),
				);

				if (checkPercentMatch(fallbackLookup) === true) {
					allResults.push(fallbackLookup);
					break;
				}
				const nonHCodeData = nonHCodeLookup(wordArray);

				if (checkPercentMatch(nonHCodeData) === true) {
					allResults.push(nonHCodeData);
					break;
				} else {
					//return whatever we input
					console.log('NO CONFIDENT MATCHES FOUND FOR: ', hazard);
					allResults.push({
						bestMatch: hazard,
						hCode: 'None',
						pictogram: '',
						pictogramCode: '',
						percentMatch: 'No match found',
					});
					break;
				}
			}
		}
	}

	//determine signal word to be returned --> if "danger" > "warning" > none --> only return the highest we find
	const signalWord = determineSignalWord(allResults);

	//organize and return data
	for (const result of allResults) {
		allHazardStatements.push(result.bestMatch);
		if (result.pictogram !== '') {
			pictogramSet.add(result.pictogram);
		}
		if (result.pictogramCode !== '') {
			pictogramCodeSet.add(result.pictogramCode);
		}
		if (result.hCode !== 'None') {
			hCodeSet.add(result.hCode);
		}
	}

	let allPictograms = [...pictogramSet];
	let allPictogramCodes = [...pictogramCodeSet];
	const allHCodes = [...hCodeSet]; //currently not being returned but can be added if wanted

	//if no pictograms exist, return preset array to not break formating for excel sheet
	if (allPictograms.length === 0) {
		allPictograms = [' '];
	}
	if (allPictogramCodes.length === 0) {
		allPictogramCodes = [' '];
	}

	console.log('===================');
	console.log('hazards:', allHazardStatements);
	console.log('pictograms:', allPictograms);
	console.log('pictogram codes:', allPictogramCodes);
	console.log('HCodes: ', allHCodes);
	console.log(signalWord);
	console.log('===================');

	return {
		allHazardStatements,
		allPictograms,
		allPictogramCodes,
		signalWord,
	};
}

//First check --> matched a keyword and so we check all the hcodes in that bucket for a match
function hCodeLookup(wordArray, bucketLabel) {
	console.log('CHECK 1 RUNNING ON: ', wordArray);
	const bucket = hazardBuckets[bucketLabel];

	let bestMatchScore = 0;
	let bestMatch = null;
	let percentMatch = 0;
	let hCode = null;
	let pictogram = '';
	let pictogramCode = '';
	let signalWord = '';

	for (let i = 0; i < bucket.length; i++) {
		hCode = bucket[i];
		const currLookupStatement = hCodeMap[hCode].statement;
		pictogram = hCodeMap[hCode].pictogram;
		pictogramCode = hCodeMap[hCode].pictogramCode;
		signalWord = hCodeMap[hCode].signalWord;
		const tokens = hCodeMap[hCode].tokens;
		const totalWords = tokens.length;
		let wordMatches = totalWords; // score starts full and substracts on mismatches

		for (const word of tokens) {
			if (!wordArray.includes(word)) {
				wordMatches -= 1;
			}
		}
		if (wordMatches === totalWords) {
			//perfect match --> return immediately

			bestMatch = currLookupStatement;
			console.log('>>>perfect match found<<<');
			percentMatch = 100;

			return {
				bestMatch,
				hCode,
				pictogram,
				pictogramCode,
				percentMatch,
				signalWord,
			};
		}

		//tracks best partial match
		if (!bestMatch || bestMatchScore < wordMatches) {
			bestMatch = currLookupStatement;
			bestMatchScore = wordMatches;
			percentMatch = Math.round((bestMatchScore / totalWords) * 100);
		}
	}

	return { bestMatch, hCode, pictogram, pictogramCode, percentMatch };
}

function normalizeHazStatment(statement) {
	const returnedArray = [];

	//split on whitespace
	let words = statement.split(/\s+/);

	//normalizee
	for (let word of words) {
		word = word
			.toLowerCase()
			.trim()
			.replace(/[.,:;!?()]/g, '');

		if (word.length > 0) {
			returnedArray.push(word);
		}
	}

	return returnedArray;
}

function fallBackMapper(statementArray, label, mode) {
	console.log('RUNNING FALLBACK ON THIS STATEMENT: ', statementArray);

	console.log('THIS IS THE LABEL WE ARE REMOVING: ', label);

	//take out the hCodes we've already checked
	let search;

	if (label !== 'none') {
		search = { ...hazardBuckets };
		delete search[label];
	} else {
		search = hazardBuckets;
	}

	let bestMatchScore = 0;
	let bestMatch = null;
	let percentMatch = 0;
	let hCode = null;
	let pictogram = '';
	let pictogramCode = '';
	let signalWord = '';

	for (const [bucket, keys] of Object.entries(search)) {
		console.log('BUCKET:', bucket);
		for (let i = 0; i < keys.length; i++) {
			hCode = keys[i];
			const currLookupStatement = hCodeMap[hCode].statement;
			pictogram = hCodeMap[hCode].pictogram;
			pictogramCode = hCodeMap[hCode].pictogramCode;
			signalWord = hCodeMap[hCode].signalWord;
			const tokens = hCodeMap[hCode].tokens;
			const totalWords = tokens.length;
			let wordMatches = totalWords;

			for (const word of tokens) {
				if (!statementArray.includes(word)) {
					wordMatches -= 1;
				}
			}
			if (wordMatches === totalWords) {
				//perfect match --> return immediately

				bestMatch = currLookupStatement;
				console.log('>>>>>>SECOND PASS: PERF MATCH FOUND>>>>');
				percentMatch = 100;

				return {
					bestMatch,
					hCode,
					pictogram,
					pictogramCode,
					percentMatch,
					signalWord,
				};
			}
			if (!bestMatch || bestMatchScore < wordMatches) {
				bestMatch = currLookupStatement;
				bestMatchScore = wordMatches;
				percentMatch = Math.round((bestMatchScore / totalWords) * 100);
			}
		}
		console.log(
			'SECOUND PASS DIDNT FIND PERF MATCH:',
			bestMatch,
			percentMatch,
		);
	}
	return { bestMatch, hCode, pictogram, pictogramCode, percentMatch };
}

function nonHCodeLookup(wordArray) {
	//we input wordArray --> check against every phrase in non-hcode map

	let bestMatchScore = 0;
	let bestMatch = null;
	let percentMatch = 0;

	for (const [statement, tokens] of Object.entries(nonHCodeMap)) {
		console.log(statement, tokens);
		const totalWords = tokens.length;
		let wordMatches = totalWords; //score starts full and subtracts for every mismatch
		//for return formating
		const capitalizedStatement =
			statement.charAt(0).toUpperCase() +
			statement.slice(1).toLowerCase();

		for (const word of tokens) {
			if (!wordArray.includes(word)) {
				wordMatches -= 1;
			}
		}
		if (wordMatches === totalWords) {
			//perfect match --> return immediately

			bestMatch = capitalizedStatement;

			console.log('non-h-Code perfect match found');
			percentMatch = 100;

			return {
				bestMatch,
				hCode: '',
				pictogram: '',
				pictogramCode: '',
				percentMatch,
				signalWord: 'None',
			};
		}

		//tracks best partial match
		if (!bestMatch || bestMatchScore < wordMatches) {
			bestMatch = capitalizedStatement;
			bestMatchScore = wordMatches;
			percentMatch = Math.round((bestMatchScore / totalWords) * 100);
		}
		//now check wordarray against tokens, then return statement
	}
	return {
		bestMatch,
		hCode: '',
		pictogram: '',
		pictogramCode: '',
		percentMatch,
		signalWord: 'None',
	};
}

function checkPercentMatch(data) {
	const percentMatch = data.percentMatch;

	if (data && percentMatch >= 75) {
		return true;
	} else {
		return false;
	}
}

function determineSignalWord(allResults) {
	console.log('DETERMINING SIGNAL WORD NOW:');

	//initialize as "none", if we don't match any signal words we return it as 'none'
	let result = 'None';

	for (const hazard of allResults) {
		if (!hazard.signalWord) continue;

		const curr = hazard.signalWord.toLowerCase();

		if (curr === 'danger') return 'Danger';
		if (curr === 'warning') result = 'Warning';
	}

	return result;
}

// const test = [
// 	'Flammable solid',
// 	'May form combustible dust concentrations in air',
// 	'Causes skin irritation',
// 	'May react explosively even in the absence of air',
// 	'Causes serious eye irritation',
// ];

// findHCodes(test);
