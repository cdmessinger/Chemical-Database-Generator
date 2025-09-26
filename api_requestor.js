export async function fetchFromPubChem(searchQuery) {

    try {
          //Step 1: search CAS/Chemical name to get the CID for the chemical
        const cidUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(searchQuery)}/synonyms/JSON`;
        const cidResponse = await fetch(cidUrl);

        if (!cidResponse.ok) {
            throw new Error(`Could not retrieve CID number: ${cidResponse.status}`)
        }

        const cidData = await cidResponse.json();
        const info = cidData?.InformationList?.Information?.[0];
        if (!info.CID) {
            throw new Error(`No CID number found for ${searchQuery}`);
        }

        const cidNumber = info.CID //the number we use now to find the data we need

        //Step 2: Grab Synonyms and Name - data is right here, we might as well grab it.
        const synonyms = info?.Synonym || [];
        const casRegex = /^\d{2,7}-\d{2}-\d$/; //cas template
        const cleanSynonyms = synonyms.filter(syn => !casRegex.test(syn)); //removes any CAS Numbers from the dataset

        const chemicalName = cleanSynonyms[0] || "Unknown"; //first index is the most common name
        const topSynonyms = cleanSynonyms.slice(1,6); //grabs the next 5 most common names

        //Step 3: Get chemical data from cidNumber
        const dataUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cidNumber}/JSON`
        const dataResponse = await fetch(dataUrl);

        if (!dataResponse.ok) {
            throw new Error(`Could not retrieve information from CID number: ${dataResponse.status}`);
        }
        const rawData = await dataResponse.json();

        return {
            searchQuery,
            cid: cidNumber,
            chemicalName,
            synonyms: topSynonyms,
            rawData
        } 
    } catch(err) {
        console.error(`Error fetching data for ${searchQuery}:`, err.message);
        return null;
    }
}
