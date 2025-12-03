export function cleanUpText(text) {
	const blacklistRegex = buildBlacklistRegex(filteredWords);

	let cleanedText = text
		// remove weird pdf spaces + zero width characters
		.replace(/[\u00A0\u1680\u180E\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
		.replace(/[\u200B-\u200D\uFEFF]/g, '')
		// collapse multiple spaces early so phrases match more reliably
		.replace(/\s{2,}/g, ' ')
		// apply blacklist
		.replace(blacklistRegex, '')
		.replace(/Page\s*\d+\s*(?:\/|of)\s*\d+/gi, '') //remove page numbers
		.replace(/_{3,}/g, '') //remove long underscore lines that can mess with parsing
		.replace(/^\s*\d+\s*$/gm, '') //remove lines that are just numbers
		.replace(/\f/g, '') //remove form-feed page breaks
		.replace(/\s{2,}/g, ' ') //remove extra spaces
		.replace(/\s+,/gi, '') //remove leftovers commas
		.replace(/\s+\//g, '') //remove leftover '/'
		.trim();

	return cleanedText;
}

export function splitBySections(text) {
	let cleanedText = text; // <-- start with input so replacements accumulate

	for (const { number, title } of sectionMap) {
		const pattern = new RegExp(
			`${number}\\s*\\.\\s*${
				title
					.replace(/[()]/g, '\\$&') // escape ( )
					.replace(/\s+/g, '[\\s\\u00A0]*') // match space OR non-breaking space
			}`,
			'i',
		);

		cleanedText = cleanedText.replace(
			pattern,
			`\n\n<<<SECTION_${number}_START>>>\n${number}\n\n`,
		);
	}

	return cleanedText;
}

export function removeNameAndRevisionDate(name, revisionDate, text) {
	const cleanedText = text
		.replace(new RegExp(escapeRegex(name), 'gi'), '')
		.replace(/Revision Date/gi, '')
		.replace(new RegExp(escapeRegex(revisionDate), 'gi'), '');

	return cleanedText;
}

export function cleanHazardBlock(text) {
	const blacklistRegex = buildBlacklistRegex(filteredWords);

	const cleanedText = (text || '')
		.replace(blacklistRegex, '')
		.split(/Precautionary/i)[0]
		.replace(/\+?\d[\d\s\-()]{6,}\d/g, '')
		.replace(
			/(\b(?:Causes|May(?:\s+cause|\s+form)?|Harmful|Fatal|Toxic|Flammable|H\d{3})\b|\()/gi,
			'\n$1',
		) // insert line break first
		// .replace(/^\s*\(\s*$/gm, "")        // NEW: remove standalone "(" lines
		// .replace(/\(\s*(?=\n|$)/gm, "")     // NEW: remove "(" trailing a hazard line
		.replace(/ +/g, ' ')
		.replace(/\n\s*/g, '\n')
		.trim();

	const HAZARD_STARTERS =
		/^(H\d{3}|Causes|May(?:\s+cause|\s+form)?|Harmful|Fatal|Toxic|Flammable)\b/i;

	let cleanedHazardBlock = cleanedText
		.split('\n')
		.filter((line) => HAZARD_STARTERS.test(line)) // <-- keep only real hazard lines
		.join('\n');

	cleanedHazardBlock = cleanedHazardBlock
		.split('\n')
		.map((line) => {
			let L = line.trim(); // ✅ trim FIRST

			L = L.replace(/^\($/, ''); // ✅ remove line that is EXACTLY "("
			L = L.replace(/\($/, ''); // ✅ remove trailing "("

			return L.replace(/\bAcute(\s+oral)?\s+toxicity\b/gi, '')
				.replace(/\bSpecific target organ toxicity[^\n]*/gi, '')
				.replace(/\bSkin\s+Corrosion\/Irritation\b/gi, '')
				.replace(/\bSerious\s+Eye\s+Damage\/Eye\s+Irritation\b/gi, '')
				.replace(/\bTarget organs?[^\n]*/gi, '')
				.replace(
					/\s*\(?\s*Combustible\s+dust\s*[:\-–—]?\s*Yes\s*\)?\s*$/i,
					'',
				)
				.replace(/\s{2,}/g, ' ') // collapse double spaces left behind
				.trim();
		})
		.filter(Boolean)
		.join('\n');

	return cleanedHazardBlock;
}

const filteredWords = [
	'Company',
	'Fisher Scientific',
	'One Reagent',
	'Inc.',
	'30 Bond Street',
	'Ward Hill',
	'MA 01835-8099',
	'Tel:',
	'800-343-0660',
	'Fax:',
	'800-322-4757',
	'Emergency Telephone Number',
	'For information US call:',
	'001-800-227-6701',
	'Europe call:',
	'+32 14 57 52 11',
	'Emergency Number US:',
	'001-201-796-7100',
	'Europe',
	'+32 14 57 52 99',
	'chemtrec tel. no. US',
	'001-800-424-9300',
	'001-703-527-3887',
	'Lane',
	'Fair',
	'Lawn',
	'NJ 07410',
	'(201) 796-7100',
	'Acros Organics',
	'Skin Sensitization',
	'Category 1',
	'Category 2',
	'Category 3',
	'Category 4',
	'Category 0',
	'Thermo Chemicals',
	'For more information',
	'For information US',
	'call:',
	'Emergency',
	'Number',
	'US:',
	'CHEMTREC',
	'Tel No.',
	'Tel. No.',
];

const sectionMap = [
	{ number: 1, title: 'Identification' },
	{ number: 2, title: 'Hazard(s) identification' },
	{ number: 3, title: 'Composition/Information on Ingredients' },
	{ number: 4, title: 'First-aid measures' },
	{ number: 5, title: 'Fire-fighting measures' },
	{ number: 6, title: 'Accidental release measures' },
	{ number: 7, title: 'Handling and storage' },
	{ number: 8, title: 'Exposure controls' },
	{ number: 9, title: 'Physical and chemical properties' },
	{ number: 10, title: 'Stability and reactivity' },
	{ number: 11, title: 'Toxicological information' },
	{ number: 12, title: 'Ecological information' },
	{ number: 13, title: 'Disposal considerations' },
	{ number: 14, title: 'Transport information' },
	{ number: 15, title: 'Regulatory information' },
	{ number: 16, title: 'Other information' },
];

function buildBlacklistRegex(phrases) {
	const patterns = phrases
		.map((p) => p.trim())
		.map((p) => p.split(/\s+/).map(escapeRegex).join('\\s+')) // allow flexible spaces
		.map((core) => `(?:^|\\b)${core}(?:[\\s,.:;\\-–—]*)`); // eat trailing punct/spaces
	return new RegExp(patterns.join('|'), 'gim');
}

function escapeRegex(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
