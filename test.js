import puppeteer from "puppeteer";
import fs, { stat } from "fs";
import path from "path";
import * as pdfjsLibRaw from "pdfjs-dist/legacy/build/pdf.js";
const pdfjsLib = pdfjsLibRaw.default || pdfjsLibRaw;
import fetch from 'node-fetch';
import { resourceLimits } from "worker_threads";

//test file so I don't have to call the API 800000 times

const searchedCAS = '75-09-2'
const textPath = "C:/Users/cd02m/OneDrive/Desktop/Chem_Database/Chemical-Database-Generator/temp_pdf/temp.txt";
const cutoffDate = new Date('2020-01-01')


  function pdfExtract(textPath) {
    const text = fs.readFileSync(textPath, 'utf-8');

    const sdsInformation = { errorCode: [] };
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

        //grab CAS No
        const casNumber = text.match(/CAS[\s\-]*No\.?[:\s]*([\d\s\-]+)/i);
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
        const synonyms = text.match(/Synonyms[:\s]*([\s\S]*?)(?=Recommended)/i); //stops at "recommended" which is next section
        if (synonyms && synonyms[1]) {
            sdsInformation.synonyms = synonyms[1].trim();
        }
        else {
            sdsInformation.synonyms = 'Synonyms not found';
            validateInformation = false;
            sdsInformation.errorCode.push("Error: could not retrieve synonyms from SDS");
        }

        //Grab Signal Word
        const signalWord = text.match(/Signal Word[:\s]*([\s\S]*?)(?=Hazard)/i);
        if (signalWord && signalWord[1]) {
            sdsInformation.signalWord = signalWord[1].trim();
        }
        else {
            sdsInformation.signalWord = 'Signal word not found';
            validateInformation = false;
            sdsInformation.errorCode.push("Error: could not retrieve Signal Word from SDS");
        }

        //Grab Hazard Statements and separate them for csv exporter later
        const unfilteredHazards = text.match(/Hazard Statements[:\s]*([\s\S]*?)(?=Precautionary|$)/i);
        if (unfilteredHazards && unfilteredHazards[1]) {
            const hazardBlock = unfilteredHazards[1].trim();
            const hazardArray = hazardBlock.split(/(?=\b(?:Causes|May|H\d{3})\b)/);
            const formattedHazards = hazardArray.map(h => h.trim()).join('|||SEP|||')
            sdsInformation.hazardStatements = formattedHazards
        }
        else {
            sdsInformation.hazardStatements = 'Hazard Statements not found';
            validateInformation = false;
            sdsInformation.errorCode.push("Error: could not retrieve Hazard Statements from SDS");
        }
        
        //Grab Class
        const transportSection = text.match(/(?:14\.\s*)?Transport\s+Information[:\s]*([\s\S]*?)(?=(?:15\.\s*)?Regulatory\s+Information)/i);
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

  const result = pdfExtract(textPath);

  console.log(result);