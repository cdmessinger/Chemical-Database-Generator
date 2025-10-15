import puppeteer from "puppeteer";
import fs, { stat } from "fs";
import path from "path";
import * as pdfjsLibRaw from "pdfjs-dist/legacy/build/pdf.js";
const pdfjsLib = pdfjsLibRaw.default || pdfjsLibRaw;
import fetch from 'node-fetch';
import { resourceLimits } from "worker_threads";



export function pdfParse(chemicalData, textPath) {
    const text = fs.readFileSync(textPath, 'utf-8');
    const sdsInformation = { errorCode: [] };
    const searchedCAS = chemicalData.searchQuery;
    sdsInformation.searchedCAS = searchedCAS;
    let normalizedDate = null;


    try {
        // Grab revision date
        const revision = text.match(/Revision Date[:\s]*([\s\S]*?)(?=Revision Number|Product Name|$)/i);

        if (revision && revision[1]) {
            let rawDate = revision[1].trim();

            // Strictly match only the date (e.g., "14-Nov-2014")
            const dateMatch = rawDate.match(/(\d{2})-(\w{3})-(\d{4})/);

            if (dateMatch) {
                const [, day, month, year] = dateMatch;
                const months = {
                    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
                    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12"
                };

                const formattedDate = `${year}-${months[month]}-${day}`;
                const parsedDate = new Date(formattedDate);

                if (!isNaN(parsedDate.getTime())) {
                    sdsInformation.revisionDate = dateMatch[0]; // Original format
                    sdsInformation.normalizedDate = formattedDate; // ISO format
                } else {
                    sdsInformation.revisionDate = `Invalid Date Format: ${rawDate}`;
                    sdsInformation.errorCode.push('Could not check Revision Date Automatically');
                    sdsInformation.normalizedDate = null;
                }
            } else {
                sdsInformation.revisionDate = `Invalid or missing date: ${rawDate}`;
                sdsInformation.errorCode.push('Could not find valid Revision Date');
                sdsInformation.normalizedDate = null;
            }
        } else {
            sdsInformation.revisionDate = "Revision date not found";
            sdsInformation.errorCode.push("Error: could not retrieve revision date");
            sdsInformation.normalizedDate = null;
        }


        //Grab Product Name
        const productName = text.match(/Product Name[:\s]*([\s\S]*?)(?=Cat)/i); //stops at "cat" for catalog number. If chemical contains "cat" it will break, unlikely.
        if (productName && productName[1]) {
            sdsInformation.productName = productName[1].trim();
        }
        else {
            sdsInformation.productName = 'Product name not found';
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
            sdsInformation.errorCode.push("Error: could not retrieve synonyms from SDS");
        }

        //Grab Signal Word
        const signalWord = cleanedText.match(/Signal Word[:\s]*([\s\S]*?)(?=Hazard)/i);
        if (signalWord && signalWord[1]) {
            sdsInformation.signalWord = signalWord[1].trim();
        }
        else {
            sdsInformation.signalWord = 'Signal word not found';
            sdsInformation.errorCode.push("Error: could not retrieve Signal Word from SDS");
        }

        //Grab Hazard Statements and separate them for csv exporter later
        const unfilteredHazards = cleanedText.match(/Hazard Statements[:\s]*([\s\S]*?)(?=Precautionary|$)/i);

        if (unfilteredHazards && unfilteredHazards[1]) {
            const hazardBlock = unfilteredHazards[1].trim();

            // 🧪 Only capture hazard statements that *start* with Causes, May, Harmful, H###
            const hazardArray = hazardBlock.match(/\b(?:Causes|May|Harmful|H\d{3})[\s\S]*?(?=\b(?:Causes|May|Harmful|H\d{3})\b|$)/gi) || [];


            sdsInformation.hazardStatements = hazardArray.length > 0
                ? hazardArray
                : 'No valid hazard statements found';
        } else {
            sdsInformation.hazardStatements = 'Hazard Statements not found';
            sdsInformation.errorCode.push("Error: could not retrieve Hazard Statements from SDS");
        }

        
        //Grab Class
            const dotClass = cleanedText.match(/Hazard\s*Class[:\s]*([^\s]+)/i);
            if (dotClass && dotClass[1]) {
                sdsInformation.class = dotClass[1].trim();
            }
            else {
                sdsInformation.class = 'Hazard Class not found';
                sdsInformation.errorCode.push("Error: could not retrieve Hazard Class from SDS");
            }


        //Grab molecular formula

        const molecularFormula = text.match(/Molecular Formula[:\s]*([\s\S]*?)(?=Molecular)/i); 
        if (molecularFormula && molecularFormula[1]) {
            sdsInformation.molecularFormula = molecularFormula[1].trim();
        }
        else {
            sdsInformation.molecularFormula = 'Molecular Formula not found';
            sdsInformation.errorCode.push("Error: could not retrieve molecular formula from SDS");
        }

        //Grab molecular Weight
        const molecularWeight = text.match(/Molecular\s*Weight[:\s]*([0-9.,]+\s*(?:g\/mol)?)/i); 
        if (molecularWeight && molecularWeight[1]) {
            sdsInformation.molecularWeight = molecularWeight[1].trim();
        }
        else {
            sdsInformation.molecularWeight = 'Molecular Formula not found';
            sdsInformation.errorCode.push("Error: could not retrieve molecular weight from SDS");
        }


        // //validating data
        validateData(chemicalData, sdsInformation);   
        

    } catch (err) {
        console.error("Error parsing SDS data:", err.message)
        console.log('partial SDS info:', sdsInformation);
        sdsInformation.errorCode.push(`ERROR parsing ALL sds information. ${err.message}`)
    }
    return sdsInformation;
  }

function validateData(chemicalData, sdsData) {
    let confidenceScore = 100;
    let statusCode = '';
    const confidenceScoreInfo = [];
    const normalizedDate = new Date(sdsData.normalizedDate);
    const cutoffDate = new Date('2020-01-01');

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
    const normalizedSDSName = normalizeChemicalName(sdsData.productName || '');
    const normalizedPubChemName = normalizeChemicalName(chemicalData.chemicalName || '');

    if (normalizedSDSName.includes(normalizedPubChemName) || normalizedPubChemName.includes(normalizedSDSName)) {
        console.log(`Chemical names (normalized) loosely match, -0, SDS: ${normalizedSDSName}, PubChem: ${normalizedPubChemName}`, `Confidence Score: ${confidenceScore}`);
    } else {
        confidenceScore -= 5;
        console.log(`Chemical names (normalized) do not match, -0, SDS: ${normalizedSDSName}, PubChem: ${normalizedPubChemName}, -5`, `Confidence Score: ${confidenceScore}`);
        confidenceScoreInfo.push(`Chemical names (normalized) do not match, -0, SDS: ${normalizedSDSName}, PubChem: ${normalizedPubChemName}, -5`);
    }

    //check signal word
    if (chemicalData.pubChemSignalWord.toLowerCase().trim() === sdsData.signalWord.toLowerCase().trim()) {
        console.log(`Signal words match, SDS: ${sdsData.signalWord}, PubChem: ${chemicalData.pubChemSignalWord} -0`, `Confidence Score: ${confidenceScore}`);
    } else {
        confidenceScore -= 5;
        console.log(`Signal words do not match, SDS: ${sdsData.signalWord}, PubChem: ${chemicalData.pubChemSignalWord} -5`, `Confidence Score: ${confidenceScore}`);
        confidenceScoreInfo.push(`Signal words do not match, SDS: ${sdsData.signalWord}, PubChem: ${chemicalData.pubChemSignalWord} -5`)
    }

    //check molecular formula (filtered)
    const normalizedSDSFormula = normalizeMolecularFormula(sdsData.molecularFormula);
    const normalizedPubChemFormula = normalizeMolecularFormula(chemicalData.pubChemMolecularFormula);

    if (normalizedSDSFormula === normalizedPubChemFormula) {
        console.log(`SDS Formula (normalized: ${normalizedSDSFormula}) matches Pubchem Formula (normalized: ${normalizedPubChemFormula}), -0`, `Confidence Score: ${confidenceScore}`);
    } else {
        confidenceScore -=10;
        console.log(`SDS Formula (normalized: ${normalizedSDSFormula}) DOES NOT match Pubchem Formula (normalized: ${normalizedPubChemFormula}), -10`, `Confidence Score: ${confidenceScore}`);
        confidenceScoreInfo.push(`SDS Formula (normalized: ${normalizedSDSFormula}) DOES NOT match Pubchem Formula (normalized: ${normalizedPubChemFormula}), -10`);
    }


    //check molecular weight
    const sdsMW = Number(sdsData.molecularWeight);
    const pubchemMW = Number(chemicalData.pubChemMolecularWeight);

    if (isNaN(sdsMW)) {
        confidenceScore -= 20;
        confidenceScoreInfo.push('No molecular weight found in SDS (-20)');
        console.log('No molecular weight found in SDS (-20)', `Confidence Score: ${confidenceScore}`);
    } else if (!isNaN(pubchemMW)) {
        if (sdsMW >= pubchemMW - 1 && sdsMW <= pubchemMW + 1) {
            console.log(`Molecular weight within +/- 1 g/mol, SDS: ${sdsMW}, PubChem: ${pubchemMW}`, `Confidence Score: ${confidenceScore}`);
        } else {
            confidenceScore -= 20;
            confidenceScoreInfo.push(`Molecular weight NOT within +/- 1 g/mol, SDS: ${sdsMW}, PubChem: ${pubchemMW} (-20)`);
            console.log(`Molecular weight NOT within +/- 1 g/mol`, `Confidence Score: ${confidenceScore}`);
        }
    }

    //check revision date

    if (normalizedDate && normalizedDate > cutoffDate) {
        console.log(`SDS revision date (${normalizedDate.toISOString().split('T')[0]}) is after cutoff: (${cutoffDate.toISOString().split('T')[0]}), -0`, `Confidence Score: ${confidenceScore}`)

    } else {
        confidenceScore -= 40;
        console.log(`SDS revision date (${normalizedDate.toISOString().split('T')[0]}) is BEFORE cutoff: (${cutoffDate.toISOString().split('T')[0]}), -40`, `Confidence Score: ${confidenceScore}`)
        confidenceScoreInfo.push(`SDS revision date (${normalizedDate.toISOString().split('T')[0]}) is BEFORE cutoff: (${cutoffDate.toISOString().split('T')[0]}), -40`);
    }


    //Confidence Scoring
    if (confidenceScore >= 85) {
        statusCode = '✅✅ Extremely Confident';
    }
    else if (confidenceScore >= 70 && confidenceScore <= 84) {
        statusCode = '✅ Pass';
    }
    else if (confidenceScore > 40 && confidenceScore <= 69) {
        statusCode = '⚠️  Needs Review';
    } else {
        statusCode = '❌ Fail';
    }
    if (confidenceScore < 0) {
        confidenceScore = 0;
    }

    sdsData.statusCode = statusCode;
    sdsData.confidenceScore = confidenceScore;
    sdsData.confidenceScoreInfo = confidenceScoreInfo;

    return sdsData;
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
