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

    let _owner = contract.owner();    
    let _counter = contract.counter();
    let _registered = contract.registered();
    let _publicKey = contract.publicKey();

    let _scoreHash = Array(2*N);
    for (let j=0; j<2*N; j++) {
        _scoreHash[j] = contract.scoreHash(j);
    }

    let _committer = Array(2*N);
    for (let j=0; j<2*N; j++) {
        _committer[j] = contract.committer(j);
    }        

    let _matchingHash = Array(2*N);
    for (let j=0; j<2*N; j++) {
        _matchingHash[j] = contract.matchingHash(j);
    }    
    
    let _ephemPublicKey = Array(2*N);
    for (let j=0; j<2*N; j++) {
        _ephemPublicKey[j] = contract.ephemPublicKey(j);
    }

    let _nonce = Array(2*N);
    for (let j=0; j<2*N; j++) {
        _nonce[j] = contract.nonce(j);
    } 

    let _encryptedSalt1 = Array(2*N);
    for (let j=0; j<2*N; j++) {
        _encryptedSalt1[j] = contract.encryptedSalt1(j);
    } 

    let _encryptedSalt2 = Array(2*N);
    for (let j=0; j<2*N; j++) {
        _encryptedSalt2[j] = contract.encryptedSalt2(j);
    }     
    

    // Resolve
    await Promise.all([_owner]).then((values) => { console.log(`owner ${values[0]}`) }); 
    await Promise.all([_counter]).then((values) => { console.log(`counter ${values[0]}`) }); 
    await Promise.all([_registered]).then((values) => { console.log(`registered ${values[0]}`) }); 
    await Promise.all([_publicKey]).then((values) => { console.log(`publicKey ${values[0]}`) }); 

    await Promise.all(_scoreHash).then((values) => {
         for (let j=0; j<2*N; j++) { console.log(`scoreHash ${j}: ${values[j]}`)};
    });    
    await Promise.all(_committer).then((values) => {
        for (let j=0; j<2*N; j++) { console.log(`committer ${j}: ${values[j]}`)};
    });
    await Promise.all(_matchingHash).then((values) => {
         for (let j=0; j<2*N; j++) { console.log(`matchingHash ${j}: ${values[j]}`)};
    });    
    await Promise.all(_ephemPublicKey).then((values) => {
        for (let j=0; j<2*N; j++) { console.log(`ephemPublicKey ${j}: ${values[j]}`)};
    });        
    await Promise.all(_nonce).then((values) => {
        for (let j=0; j<2*N; j++) { console.log(`nonce ${j}: ${values[j]}`)};
    });   
    await Promise.all(_encryptedSalt1).then((values) => {
        for (let j=0; j<2*N; j++) { console.log(`encryptedSalt1 ${j}: ${values[j]}`)};
    });   
    await Promise.all(_encryptedSalt2).then((values) => {
        for (let j=0; j<2*N; j++) { console.log(`encryptedSalt2 ${j}: ${values[j]}`)};
    });       
             
}

var main = async function(networkName, address, N) {    
    const contractName = `Matching${N}`
    
    let chainURL;
    if (networkName == 'hardhat' ) {
        chainURL = "http://localhost:8545";
    } else if (networkName == 'harmony-dev') {
        chainURL = "https://api.s0.ps.hmny.io";  // Harmony Dev Network (https://docs.harmony.one/home/developers/api)
    } else if (networkName == 'harmony-main') {
        //chainURL = "https://api.s0.t.hmny.io";
        //chainURL = "https://api.harmony.one";
        chainURL = "https://harmony-mainnet.chainstacklabs.com/";
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