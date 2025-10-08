export async function parsePubChemData(apiRawData) {

    let rawData = apiRawData?.rawData?.Record?.Section;

    if (!rawData) {
        console.error('No data retrieved from API')
        return null;
    }

    const errorStatements = [];

    const casNumbers = findCASNumbers(rawData);
    if (casNumbers.length === 0) {
        errorStatements.push('Pubchem parsing Error: Could not retrieve CAS numbers');
    }
    const molecularFormula = findFormula(rawData);
    if (!molecularFormula) {
        errorStatements.push('Pubchem parsing Error: Could not retrieve Molecular Formula');
    }
    const molecularWeight = findWeight(rawData);
    if (!molecularWeight) {
        errorStatements.push('Pubchem parsing Error: Could not retrieve Molecular Weight');
    }
    const hazardInformation = findHazardInformation(rawData);
    if (hazardInformation?.errorStatements) {
        for (const hazardError of hazardInformation.errorStatements) {
        errorStatements.push(hazardError);
        }
    }

    const chemicalData = {};

    chemicalData.casNumbers = casNumbers;
    chemicalData.molecularFormula = molecularFormula;
    chemicalData.molecularWeight = molecularWeight;
    chemicalData.signalWord = hazardInformation.signalWord;
    chemicalData.pictograms = hazardInformation.pictograms;
    chemicalData.hazardStatements = hazardInformation.hazardStatements;
    chemicalData.errorStatements = errorStatements;

    return chemicalData;
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
        const currentCAS = casInfo[i].Value?.StringWithMarkup?.[0]?.String;
        if (currentCAS) {
            casNumberSet.add(currentCAS);
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
            errorStatements.push('Pubchem parsing Error: Signal Word not found')
        }

        //get pictograms
        const pictogramSet = new Set(); 
        for (let i = 0; i < ghsSection.length; i++) {
            const item = ghsSection[i];
            if (item.Name === "Pictogram(s)") {
                const pictogramSection = item?.Value?.StringWithMarkup[0]?.Markup || [];
                for (let j = 0; j < pictogramSection.length; j++) {
                    let currPictogram = pictogramSection[j];
                    pictogramSet.add(currPictogram.Extra);
                }
            }
        }
        const pictograms = [...pictogramSet]
        if (pictograms.length === 0) {
            errorStatements.push('Pubchem parsing Error: Pictograms not found')
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
                    const codeMatch = currHazard.match(/H\d{3}/); // 👈 find H-code

                    if (!codeMatch || !seenCodes.has(codeMatch[0])) {
                        if (codeMatch) seenCodes.add(codeMatch[0]);
                        hazardStatements.push(currHazard.trim()); // 👈 add full text
                    }
                    
                }
            }
        }

        if (hazardStatements.length === 0) {
            errorStatements.push('Pubchem parsing Error: Hazard Statements not found');
        }

        return { signalWord, pictograms, hazardStatements, errorStatements };

    } catch (err) {
        console.error("Error parsing pubchem information", err.message) 
        return { signalWord: null, pictograms: [], hazardStatements: [], errorStatements: [`Fatal parser error: ${err.message}`] };
    }
}
