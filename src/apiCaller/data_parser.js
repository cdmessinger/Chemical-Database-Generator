export async function parsePubChemData(apiRawData) {

    let rawData = apiRawData?.rawData?.Record?.Section;

    if (!rawData) {
        console.error('No data retrieved from API')
        return null;
    }

    const errorStatements = [];

    const casNumbers = findCASNumbers(rawData);
    if (casNumbers.length === 0) {
        errorStatements.push('Pubchem parsing error: Could not retrieve CAS numbers');
    }
    const molecularFormula = findFormula(rawData);
    if (!molecularFormula) {
        errorStatements.push('Pubchem parsing error: Could not retrieve Molecular Formula');
    }
    const molecularWeight = findWeight(rawData);
    if (!molecularWeight) {
        errorStatements.push('Pubchem parsing error: Could not retrieve Molecular Weight');
    }
    const hazardInformation = findHazardInformation(rawData);
    if (hazardInformation?.errorStatements) {
        for (const hazardError of hazardInformation.errorStatements) {
        errorStatements.push(hazardError);
        }
    }

    const parsedData = {};

    parsedData.pubChemCASNumbers = casNumbers;
    parsedData.pubChemMolecularFormula = molecularFormula;
    parsedData.pubChemMolecularWeight = molecularWeight;
    parsedData.pubChemSignalWord = hazardInformation.signalWord;
    parsedData.pubChemPictograms = hazardInformation.pictograms;
    parsedData.pictogramCodes = hazardInformation.pictogramCodes;
    parsedData.pubChemHazardStatements = hazardInformation.hazardStatements;
    parsedData.errorStatements = errorStatements;


    return parsedData;
}

function findSection(sections, heading) {
    //recursive function for finding TOC heading we want
    for (const section of sections) {
        if (section.TOCHeading === heading) {
            return section;
        }
        if (Array.isArray(section.Section)) {
            const found = findSection(section.Section, heading);
            if (found) return found;
        }
    }
    return null;
}

function findCASNumbers(rawData) {
    try {
    const casSection = findSection(rawData, "CAS");

    if (!casSection) {
        throw new Error('Error: Could not find CAS section in dataset.');
    }
    
    const casInfo = casSection.Information;
    const casNumberSet = new Set();

    for (let i=0; i < casInfo.length; i++) {
        const searchQuery = casInfo[i].Value?.StringWithMarkup?.[0]?.String;
        if (searchQuery) {
            casNumberSet.add(searchQuery);
        }
    }
    const casNumbers = [...casNumberSet];
    return casNumbers;
    }
    catch (err) {
        console.error('Error parsing CAS numbers:', err.message);
        return [];
    }
    
}

function findFormula(rawData) {
    try {
        const formulaSection = findSection(rawData, "Molecular Formula")

        if (!formulaSection) {
            throw new Error('Error: Could not find Molecular Formula in dataset.')
        }
        
        const molecularFormula = formulaSection.Information?.[0]?.Value?.StringWithMarkup?.[0]?.String || 'Not found';
        return molecularFormula;

    }
    catch(err) {
        console.error('Error parsing Molecular Formula:', err.message);
        return "Not found";
    }
}

function findWeight(rawData) {
    try {
        const weightSection = findSection(rawData, "Molecular Weight")

        if (!weightSection) {
            throw new Error('Could not find Molecular Weight in dataset');
        }

        const molecularWeight = weightSection.Information?.[0]?.Value?.StringWithMarkup?.[0]?.String || 'Not Found';
        return molecularWeight;
    } catch(err) {
        console.error('Error parsing molecular weight');
        return 'Not found';
    }
}

function findHazardInformation(rawData) {
    try {

        const errorStatements = [];
        const hazardSection = findSection(rawData, "GHS Classification");

        const ghsSection = hazardSection?.Information || [];

        let signalWord = null;
        for (let i = 0; i < ghsSection.length; i++) {
            const item = ghsSection[i];
            if (item.Name === "Signal") {
                signalWord = item?.Value?.StringWithMarkup?.[0]?.String;
                break;
            }
        }

        if (!signalWord) {
            errorStatements.push('Pubchem parsing error: Signal Word not found')
        }

        //get pictograms
        const pictogramList =[];
        let pictogramReferences = 0;
        for (let i = 0; i < ghsSection.length; i++) {
            const item = ghsSection[i];
            if (item.Name === "Pictogram(s)") {
                const pictogramSection = item?.Value?.StringWithMarkup[0]?.Markup || [];
                for (let j = 0; j < pictogramSection.length; j++) {
                    let currPictogram = pictogramSection[j];
                    pictogramList.push(currPictogram.Extra);
                }
                pictogramReferences += 1;
            }
        }

        let counts = {};
        const pictograms = [];

        for (const p of pictogramList) {
            counts[p] = (counts[p] || 0) + 1;
        }

        for (const key in counts) {
            const refCount = pictogramReferences.length || 1;
            const frequency = counts[key]/refCount;
            if (frequency > 0.5) {
                pictograms.push(key);
            }
        }
        
        if (pictograms.length === 0) {
            errorStatements.push('Pubchem parsing error: Pictograms not found')
        }
        
        //setting pictogram codes for exporting (Uses GHS codes)

        const pictogramCodes = [];
        for (let i=0; i < pictograms.length; i++) {
            const currPictogram = pictograms[i].toLowerCase().trim();

            if (currPictogram.includes('acute')) {
                pictogramCodes.push('AC');
            } else if (currPictogram.includes('corrosive')) {
                pictogramCodes.push('CO');
            } else if (currPictogram.includes('explosive')) {
                pictogramCodes.push('EX');
            } else if (currPictogram.includes('gas')) {
                pictogramCodes.push('GA');
            } else if (currPictogram.includes('oxidizer')) {
                pictogramCodes.push('OX');
            } else if (currPictogram.includes('carcinogen') || currPictogram.includes('health hazard')) {
                pictogramCodes.push('CA');
            } else if (currPictogram.includes('environmental')) {
                pictogramCodes.push('EN');
            } else if (currPictogram.includes('flammable')) {
                pictogramCodes.push('FL');
            } else if (currPictogram.includes('irritant')) {
                pictogramCodes.push('IR');
            } else (
                errorStatements.push('Error: could not identify one or more pictogram codes')
            )
        }

        if (pictogramCodes.length === 0) {
            errorStatements.push('Pubchem parsing error: Pictograms could not be converted to Codes')
        }


        //find Hazard Statements (just for manual auditing later if needed)
        const hazardStatements = [];
        const seenCodes = new Set(); // track H-codes we've seen

        for (let i = 0; i < ghsSection.length; i++) {
            const item = ghsSection[i];
            if (item.Name === "GHS Hazard Statements") {
                const hazardSection = item?.Value?.StringWithMarkup || [];
                for (let j = 0; j < hazardSection.length; j++) {
                    let currHazard = hazardSection[j].String;
                    const codeMatch = currHazard.match(/H\d{3}/); // find H-code

                    if (!codeMatch || !seenCodes.has(codeMatch[0])) {
                        if (codeMatch) seenCodes.add(codeMatch[0]);
                        hazardStatements.push(currHazard.trim()); // add full text
                    }
                    
                }
            }
        }

        if (hazardStatements.length === 0) {
            errorStatements.push('Pubchem parsing error: Hazard Statements not found');
        }

        return { signalWord, pictograms, pictogramCodes, hazardStatements, errorStatements };

    } catch (err) {
        console.error("Error parsing pubchem information", err.message) 
        return { signalWord: null, pictograms: [], pictogramCodes: [], hazardStatements: [], errorStatements: [`Fatal parser error: ${err.message}`] };
    }
}
