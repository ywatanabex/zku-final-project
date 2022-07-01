const { readFileSync } = require('fs');

function getContractArtifact(contractName) {   
    const nameToPath = {
        "Matching3": "artifacts/contracts/Matching3.sol/Matching3.json",
        "Matching4": "artifacts/contracts/Matching4.sol/Matching4.json",
        "Matching5": "artifacts/contracts/Matching5.sol/Matching5.json",
        "Matching3Factory": "artifacts/contracts/Matching3Factory.sol/Matching3Factory.json",
        "Matching4Factory": "artifacts/contracts/Matching4Factory.sol/Matching4Factory.json",
        "Matching5Factory": "artifacts/contracts/Matching5Factory.sol/Matching5Factory.json",
    }
    const contractArtifact = JSON.parse(readFileSync(nameToPath[contractName], {'encoding': 'utf-8'}));
    return contractArtifact;
}

module.exports = { getContractArtifact };  