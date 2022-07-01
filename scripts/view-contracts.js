// e.g. % node scripts/view-contracts.js --network harmony-dev --size 3 --address 0x9f99af641CE232B53C51014D04006182bf9005ac
const { ethers } = require("ethers");
const { program } = require('commander');
const { getContractArtifact } = require('../src/contract-utils.js'); 

var view = async function(contractName, contractAddress, N, chainURL, key)   {
    console.log(contractName)
    console.log(`contractAddress=${contractAddress}`)
    const provider = new ethers.providers.JsonRpcProvider(chainURL);
    const signer = new ethers.Wallet(key, provider);
    const contractArtifact  = getContractArtifact(contractName);
    const contract = new ethers.Contract(contractAddress, contractArtifact['abi'], signer);

    //eventsRegister = await contract.queryFilter('Register')
    //console.log(`Register: ${eventsRegister}`)

    let counter = await contract.counter();
    console.log(`counter ${counter}`);

    let registered = await contract.registered();
    console.log(`registered ${registered}`);

    for (let j=0; j<2*N; j++) {
        let sHash = await contract.scoreHash(j);
        console.log(`scoreHash ${j} = ${sHash}`)
    }

    for (let j=0; j<2*N; j++) {
        let address = await contract.committer(j);
        console.log(`committer ${j} = ${address}`)
    }    

    for (let j=0; j<2*N; j++) {
        let mHash = await contract.matchingHash(j);
        console.log(`matchingHash ${j} = ${mHash}`)
    }

}

var main = async function(networkName, address, N) {    
    const contractName = `Matching${N}`
    
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
    await view(contractName, address, N, chainURL, key)
}

program.option('--network <name>');
program.option('--address <address>');
program.option('--size <size>');
program.parse();
const options = program.opts();       
const networkName = options.network
const address = options.address
const N = parseInt(options.size)
main(networkName, address, N)