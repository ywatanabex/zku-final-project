// Deploy Contract to Harmony Testnet
// e.g. % node scripts/deploy-contracts.js --network hardhat
//      % node scripts/deploy-contracts.js --network harmony-dev
const { ethers } = require("ethers");
const { program } = require('commander');

var deploy = async function(contractName, chainURL, key) {    
    if (key === undefined) {console.log("key is not set"); return}
    const { getContractArtifact } = require('../src/contract-utils.js');  // this cannot be at the top

    const provider = new ethers.providers.JsonRpcProvider(chainURL);
    const signer = new ethers.Wallet(key, provider);
    const contractArtifact  = getContractArtifact(contractName);
    const factory = new ethers.ContractFactory(contractArtifact.abi, contractArtifact.bytecode, signer);
    const contract = await factory.deploy();
    console.log(`${contractName} deployed to:`, contract.address);
    return contract.address;
}

var main = async function (networkName) {
    const contractInfoList = [];
    for (let N=3; N <=5; N++) { 
        const contractName = `Matching${N}Factory`

        let chainURL;
        if (networkName == 'hardhat' ) {
            chainURL = "http://localhost:8545";
        } else if (networkName == 'harmony-dev') {
            chainURL = "https://api.s0.ps.hmny.io";  // Harmony Dev Network (https://docs.harmony.one/home/developers/api)
        } else if (networkName == 'harmony-main') {
            chainURL = "https://api.s0.t.hmny.io";
        } else {
            console.log(`Unknown network name: ${networkName}`);
            return;
        }

        const key = process.env.privateKey0;  
        const contractAddress = await deploy(contractName, chainURL, key);
        const info = {"name": contractName, "address": contractAddress, "url": chainURL}
        contractInfoList.push(info);
    }
    for (let info of contractInfoList) {
        console.log(JSON.stringify(info))
    }
    console.log(`Copy these JSONs to ../deployed-contracts/${networkName}.json`)
}

program.option('--network <name>');
program.parse();
const options = program.opts();
main(options.network)