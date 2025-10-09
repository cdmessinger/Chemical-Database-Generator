import puppeteer from "puppeteer";
import fs, { stat } from "fs";
import path from "path";
import * as pdfjsLibRaw from "pdfjs-dist/legacy/build/pdf.js";
const pdfjsLib = pdfjsLibRaw.default || pdfjsLibRaw;
import fetch from 'node-fetch';
import { resourceLimits } from "worker_threads";

//test file so I don't have to call the API 800000 times

const chemicalData = {
  searchQuery: '75-09-2',
  searchQueryViaParser: '75-09-2',
  cidNumber: 6344,
  chemicalName: 'DICHLOROMETHANE',
  synonyms: [
    'Methylene chloride',
    'Methylene dichloride',
    'Methane, dichloro-',
    'Methylene bichloride',
    'Methane dichloride'
  ],
  pubChemCasNumbers: [ '75-09-2', '1605-72-7' ],
  pubChemMolecularFormula: 'CH2Cl2',
  pubChemMolecularWeight: '84.93',
  pubChemSignalWord: 'Warning',
  pubChemPictograms: [ 'Health Hazard', 'Irritant' ],
  pubChemHazardStatements: [
    'H351: Suspected of causing cancer [Warning Carcinogenicity]',
    'H302 (24.1%): Harmful if swallowed [Warning Acute toxicity, oral]',
    'H315 (30.4%): Causes skin irritation [Warning Skin corrosion/irritation]',
    'H319 (53.2%): Causes serious eye irritation [Warning Serious eye damage/eye irritation]',
    'H336 (29.9%): May cause drowsiness or dizziness [Warning Specific target organ toxicity, single exposure; Narcotic effects]',
    'H341 (22.9%): Suspected of causing genetic defects [Warning Germ cell mutagenicity]',
    'H373 (12.7%): May causes damage to organs through prolonged or repeated exposure [Warning Specific target organ toxicity, repeated exposure]',        
    'H370: Causes damage to organs [Danger Specific target organ toxicity, single exposure]',
    'H372: Causes damage to organs through prolonged or repeated exposure [Danger Specific target organ toxicity, repeated exposure]',
    'H402: Harmful to aquatic life [Hazardous to the aquatic environment, acute hazard]',
    'H332: Harmful if inhaled [Warning Acute toxicity, inhalation]',
    'H350: May cause cancer [Danger Carcinogenicity]',
    'H361: Suspected of damaging fertility or the unborn child [Warning Reproductive toxicity]',
    'H412: Harmful to aquatic life with long lasting effects [Hazardous to the aquatic environment, long-term hazard]',
    'H335: May cause respiratory irritation [Warning Specific target organ toxicity, single exposure; Respiratory tract irritation]'
  ]
}

const textPath = "C:/Users/cd02m/OneDrive/Desktop/Chem_Database/Chemical-Database-Generator/temp_pdf/temp.txt";
const cutoffDate = new Date('2020-01-01');


  function pdfExtract(chemicalData, textPath) {
    const text = fs.readFileSync(textPath, 'utf-8');
    const sdsInformation = { errorCode: [] };
    const searchedCAS = chemicalData.searchQuery;
    sdsInformation.searchedCAS = searchedCAS;
    let validateInformation = true;
    let normalizedDate = null;

    try {
        //Grab revision date
        const revision = text.match(/Revision Date[:\s]*([\s\S]*?)(?=Revision Number|Product Name|$)/i);
        if (revision && revision[1]) {
            let rawDate = revision[1].trim();
            sdsInformation.revisionDate = rawDate;

            const formattedDate = rawDate.replace(
                /(\d{2})-(\w{3})-(\d{4})/,
                (match, day, month, year) => {
                    const months = {
                        Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
                        Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12"
                    };
                    return `${year}-${months[month]}-${day}`;
                }
            );
            normalizedDate = new Date(formattedDate);

            if (isNaN(normalizedDate.getTime())) {
                sdsInformation.revisionDate = `Invalid Date Format: ${rawDate}`;
                sdsInformation.errorCode.push('Could not check Revision Date Automatically');
            }
        } 
        else {
                sdsInformation.revisionDate = "Revision date not found";
                sdsInformation.errorCode.push("Error: could not retrieve revision date");
        }


        //Grab Product Name
        const productName = text.match(/Product Name[:\s]*([\s\S]*?)(?=Cat)/i); //stops at "cat" for catalog number. If chemical contains "cat" it will break, unlikely.
        if (productName && productName[1]) {
            sdsInformation.productName = productName[1].trim();
        }
        else {
            sdsInformation.productName = 'Product name not found';
            validateInformation = false;
            sdsInformation.errorCode.push("Error: could not retrieve product name from SDS");
        }


        //Remove page headers - Fisher has page breaks with name/revision date headers, we want to filter out all of these to not get parsing issues.
        
            const escapeRegex = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape any special regex characters in the product name and revision date

            const cleanedText = text
            .replace(new RegExp(escapeRegex(sdsInformation.productName), 'gi'), '')
            .replace(/Revision Date/gi, '')
            .replace(new RegExp(escapeRegex(sdsInformation.revisionDate), 'gi'), '');



        //grab CAS No
        const casNumber = cleanedText.match(/CAS[\s\-]*No\.?[:\s]*([\d\s\-]+)/i);
        if (casNumber && casNumber[1]) {
            sdsInformation.casNumber = casNumber[1].trim();
        }
        else {
            sdsInformation.casNumber = 'CAS Number not found in SDS';
            validateInformation = false;
            sdsInformation.errorCode = sdsInformation.errorCode || [];
            sdsInformation.errorCode.push("Error: could not retrieve CAS number from SDS");
        }

        //Grab Synonyms
        const synonyms = cleanedText.match(/Synonyms[:\s]*([\s\S]*?)(?=Recommended)/i); //stops at "recommended" which is next section
        if (synonyms && synonyms[1]) {
            sdsInformation.synonyms = synonyms[1].trim();
        }
        else {
            sdsInformation.synonyms = 'Synonyms not found';
            validateInformation = false;
            sdsInformation.errorCode.push("Error: could not retrieve synonyms from SDS");
        }

        //Grab Signal Word
        const signalWord = cleanedText.match(/Signal Word[:\s]*([\s\S]*?)(?=Hazard)/i);
        if (signalWord && signalWord[1]) {
            sdsInformation.signalWord = signalWord[1].trim();
        }
        else {
            sdsInformation.signalWord = 'Signal word not found';
            validateInformation = false;
            sdsInformation.errorCode.push("Error: could not retrieve Signal Word from SDS");
        }

        //Grab Hazard Statements and separate them for csv exporter later
        const unfilteredHazards = cleanedText.match(/Hazard Statements[:\s]*([\s\S]*?)(?=Precautionary|$)/i);

        if (unfilteredHazards && unfilteredHazards[1]) {
            const hazardBlock = unfilteredHazards[1].trim();

            // 🧪 Only capture hazard statements that *start* with Causes, May, Harmful, H###
            const hazardArray = hazardBlock.match(/\b(?:Causes|May|Harmful|H\d{3})[\s\S]*?(?=\b(?:Causes|May|Harmful|H\d{3})\b|$)/gi) || [];

            const formattedHazards = hazardArray.map(h => h.trim()).join('|||SEP|||'); //this allows us to parse it later for csv easier

            sdsInformation.hazardStatements = formattedHazards.length > 0
                ? formattedHazards
                : 'No valid hazard statements found';
        } else {
            sdsInformation.hazardStatements = 'Hazard Statements not found';
            validateInformation = false;
            sdsInformation.errorCode.push("Error: could not retrieve Hazard Statements from SDS");
        }

        
        //Grab Class
        const transportSection = cleanedText.match(/(?:14\.\s*)?Transport\s+Information[:\s]*([\s\S]*?)(?=(?:15\.\s*)?Regulatory\s+Information)/i);
        if (transportSection && transportSection[1]) {
            const dotClass = transportSection[1].match(/Class[:\s]*([\s\S]*?)(?=Packing)/i);
            if (dotClass && dotClass[1]) {
                sdsInformation.class = dotClass[1].trim();
            }
            else {
                sdsInformation.class = 'Hazard Class not found';
                validateInformation = false;
                sdsInformation.errorCode.push("Error: could not retrieve Hazard Class from SDS");
            }
        } 
        else {
            sdsInformation.class = 'Transportation Section not found: could not get Hazard Class';
            validateInformation = false;
            sdsInformation.errorCode.push("Error: could not retrieve Hazard Class from SDS");
        }

        //validating data

        let statusCode = 'green';
        
        const casRegex = /^\d{2,7}-\d{2}-\d$/;
        if (!casRegex.test(sdsInformation.casNumber)) {
            sdsInformation.errorCode.push("Check CAS number, it looks weird");
        }
        
        const normalizeCAS = str => str.replace(/\s+/g, "");

        if (normalizeCAS(searchedCAS) !== normalizeCAS(sdsInformation.casNumber)) {
            statusCode = 'red';
            sdsInformation.errorCode.push('CAS numbers do not match - verify SDS sheet')
        } else if (validateInformation === false) {
            statusCode = 'orange';
        }

        if (normalizedDate && normalizedDate < cutoffDate) {
            statusCode = 'red';
            sdsInformation.errorCode.push(`SDS revision date (${normalizedDate.toISOString().split('T')[0]}) is before cutoff (${cutoffDate.toISOString().split('T')[0]})`);
        }

        
        sdsInformation.statusCode = statusCode;  

    } catch (err) {
        console.error("Error parsing SDS data:", err.message)
        console.log('partial SDS info:', sdsInformation);
        sdsInformation.errorCode.push(`ERROR parsing ALL sds information. ${err.message}`)
    }
    return sdsInformation;
  }

  const result = pdfExtract(chemicalData, textPath);

  console.log(result);

function validateData(chemicalData, sdsData) {
    let confidenceScore = 100;
    const confidenceScoreInfo = [];

    //check CAS Numbers
    if (sdsData.casNumber !== chemicalData.searchQuery) {
        console.log('CAS does not match searchQuery, checking PubChem numbers');

        const matchInPubChem = chemicalData.pubChemCasNumbers.includes(sdsData.casNumber);

        if (matchInPubChem) {
            confidenceScore -= 20;
            console.log(`SDS CAS (${sdsData.casNumber}) matches a PubChem CAS number (${chemicalData.pubChemCasNumbers}) but not searchQuery(${chemicalData.searchQuery}), -20`, confidenceScore);
            confidenceScoreInfo.push(`SDS CAS (${sdsData.casNumber}) matches a PubChem CAS number (${chemicalData.pubChemCasNumbers}) but not searchQuery(${chemicalData.searchQuery}), -20`)
        } else {
            confidenceScore -= 40;
            console.log(`SDS CAS (${sdsData.casNumber}) does not match PubChem CAS numbers (${chemicalData.pubChemCasNumbers}) or searchQuery (${chemicalData.searchQuery}), -40`, confidenceScore);
            confidenceScoreInfo.push(`SDS CAS (${sdsData.casNumber}) does not match PubChem CAS numbers (${chemicalData.pubChemCasNumbers}) or searchQuery (${chemicalData.searchQuery}), -40`)
        }
    }

    //check Name (filtered)
    const normalizedSDSName = normalizeChemicalName(sdsData.productName);
    const normalizedPubChemName = normalizeChemicalName(chemicalData.chemicalName);

    if (normalizedSDSName.includes(normalizedPubChemName) || normalizedPubChemName.includes(normalizedSDSName)) {
        console.log(`Chemical names (normalized) loosely match, -0, SDS: ${normalizedSDSName}, PubChem: ${normalizedPubChemName}`, confidenceScore);
    } else {
        confidenceScore -= 5;
        console.log(`Chemical names (normalized) do not match, -0, SDS: ${normalizedSDSName}, PubChem: ${normalizedPubChemName}, -5`, confidenceScore);
        confidenceScoreInfo.push(`Chemical names (normalized) do not match, -0, SDS: ${normalizedSDSName}, PubChem: ${normalizedPubChemName}, -5`);
    }

    //check signal word
    if (chemicalData.pubChemSignalWord.toLowerCase().trim() === sdsData.signalWord.toLowerCase().trim()) {
        console.log(`Signal words match, SDS: ${sdsData.signalWord}, PubChem: ${chemicalData.pubChemSignalWord} -0`, confidenceScore);
    } else {
        chemicalData -= 5
        console.log(`Signal words match, SDS: ${sdsData.signalWord}, PubChem: ${chemicalData.pubChemSignalWord} -5`);
    }

    //check molecular formula (filtered)
    const normalizedSDSFormula = normalizeMolecularFormula(sdsData.molecularFormula);
    const normalizedPubChemFormula = normalizeMolecularFormula(chemicalData.pubChemMolecularFormula);

    if (normalizedSDSFormula === normalizedPubChemFormula) {
        console.log(`SDS Formula (normalized: ${normalizedSDSFormula}) matches Pubchem Formula (normalized: ${normalizedPubChemFormula}, -0`, confidenceScore);
    } else {
        confidenceScore -=10;
        console.log(`SDS Formula (normalized: ${normalizedSDSFormula}) DOES NOT match Pubchem Formula (normalized: ${normalizedPubChemFormula}, -10`, confidenceScore);
        confidenceScoreInfo.push(`SDS Formula (normalized: ${normalizedSDSFormula}) DOES NOT match Pubchem Formula (normalized: ${normalizedPubChemFormula}, -10`);
    }


    //check molecular weight
    const sdsMW = Number(sdsData.molecularWeight);
    const pubchemMW = Number(chemicalData.pubChemMolecularWeight);

    if (!isNaN(pubchemMW) && !isNaN(sdsMW)) {
        if (sdsMW >= pubchemMW-1 && sdsMW <= pubChemMW+1) {
            console.log(`Molecular weight within +/- 1 g/mol, SDS: ${sdsMw}, PubChem: ${pubchemMW} -0`, confidenceScore);
        } else {
            confidenceScore -= 20;
            console.log(`Molecular weight NOT within +/- 1 g/mol, SDS: ${sdsMw}, PubChem: ${pubchemMW} -20`, confidenceScore);
            confidenceScoreInfo.push(`Molecular weight NOT within +/- 1 g/mol, SDS: ${sdsMw}, PubChem: ${pubchemMW} -20`)
        }
    }

    //need to get MW and formula from sds still
    //need to write confidence scoring pass/review/fail etc + logic to save highest confidence score & check a diff sds if under a 70
    //need to remove old status code logic
    //test scoring
    //integrate it into big code (maybe refactor cleaner)
}


function normalizeChemicalName(name) {
    if (!name) return '';

    return name
        .toLowerCase()                       // lowercase everything
        .replace(/[^a-z0-9]/gi, ' ')          // remove all non-alphanumeric characters
        .replace(/\s+/g, ' ')                 // collapse multiple spaces into one
        .trim();                              // trim leading and trailing spaces
}

function normalizeMolecularFormula(formula) {
    if (!formula) return '';

    return formula
        .toUpperCase()       // standardize casing (C not c)
        .replace(/\s+/g, '')  // remove spaces
        .trim();
}
