// Deploy Contract to Harmony Testnet
const { ethers } = require("ethers");

var deploy = async function(contractFile, chainURL, key) {    
    if (key === undefined) {console.log("key is not set"); return}

    const provider = new ethers.providers.JsonRpcProvider(chainURL);
    const signer = new ethers.Wallet(key, provider);    
    const contractArtifact  = require(contractFile)
    const factory = new ethers.ContractFactory(contractArtifact.abi, contractArtifact.bytecode, signer);
    const contract = await factory.deploy();
    console.log(`${contractFile} deployed to:`, contract.address);
}

var main = async function () {
    for (let N=3; N <=5; N++) {
        const contractFile = `../artifacts/contracts/Matching${N}.sol/Matching${N}.json`;
        const chainURL = "https://api.s0.ps.hmny.io";  // Harmony Dev Network (https://docs.harmony.one/home/developers/api)
        const key = process.env.privateKey0;  
        await deploy(contractFile, chainURL, key)
    }
}

main()