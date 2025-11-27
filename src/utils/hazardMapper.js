import { readFileSync } from 'fs';

const jsonText = readFileSync('./data/hCodeMap.json', 'utf-8');
const hCodeMap = JSON.parse(jsonText);

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

//pictograms
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
	const results = [];

	for (const hazard of hazardArray) {
		const lowerCaseHaz = hazard.toLowerCase();

		for (const [keyword, label] of Object.entries(keywordToHCodeLookup)) {
			if (lowerCaseHaz.includes(keyword)) {
				console.log(label);
				const match = hCodeLookup(hazard, label);
				console.log(match);
				if (match && match.percentMatch >= 75) {
					results.push(match.bestMatch);
				} else if (match && match.percentMatch < 75) {
					results.push(hazard); //if percent match isnt confident, return what was originally put in, rather than a bad match
				}
				break;
			}
		}
	}

	console.log('===================');
	console.log(results);
	console.log('===================');
	return results;
}

function hCodeLookup(sdsStatement, label) {
	const bucket = hazardBuckets[label];
	const sdsStatementArray = normalizeHazStatment(sdsStatement);

	const wordCount = sdsStatementArray.length;
	let bestMatchScore = 0;
	let bestMatch = null;
	let percentMatch = 0;

	for (let i = 0; i < bucket.length; i++) {
		let counter = wordCount; //score starts full and subtracts for each mismatch

		const hCode = bucket[i];
		const currLookupStatement = hCodeMap[hCode].statement;
		const lookupArray = normalizeHazStatment(currLookupStatement);

		for (const word of sdsStatementArray) {
			if (!lookupArray.includes(word)) {
				counter -= 1;
			}
		}
		if (counter === wordCount) {
			//perfect match --> return immediately
			bestMatch = currLookupStatement;
			percentMatch = 100;
			return { bestMatch, hCode, percentMatch };
		}

		//tracks best partial match
		if (!bestMatch || bestMatchScore < counter) {
			bestMatch = currLookupStatement;
			bestMatchScore = counter;
			percentMatch = Math.round((bestMatchScore / wordCount) * 100);
		}
	}

	return { bestMatch, percentMatch };
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

const test = [
	'Flammable solid',
	'May form combustible dust concentrations in air',
	'Causes skin irritation',
	'Causes serious eye irritation',
];

findHCodes(test);
