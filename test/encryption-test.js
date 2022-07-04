const chai = require("chai");
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(assertArrays);
const { ethers } = require("hardhat");
const { groth16 } = require("snarkjs");
const { poseidonContract, buildPoseidon } = require("circomlibjs");
const { rankingToScore, computeStableMatching, matchingToArray } = require('../src/stable-matching');
const { unstringifyBigInts, decodeMatchingHash } = require('../src/utils');
const { uint8ArrayToBase64, base64ToUint8Array, bigIntToUint8Array, uint8ArrayToBigInt } = require('../src/binary-utils');
const { encrypt, decrypt, getEncryptionPublicKey } = require('@metamask/eth-sig-util')


for (let N=3; N <= 5; N++) {
    describe(`Test Matching${N}Factory`, function () {
        let signers;
        let factoryContract; 
        let Matching;

        beforeEach(async function () {
            signers = await ethers.getSigners();    
            const MatchingFactory= await ethers.getContractFactory(`Matching${N}Factory`, signers[0]);        
            factoryContract = await MatchingFactory.deploy();
            await factoryContract.deployed();

            Matching= await ethers.getContractFactory(`Matching${N}`);   
        });

        it(`Check owner of created Matching${N} contract`, async function () {
            const createTx = await factoryContract.createMatching();
            const createFrom = createTx.from;
            const createReceipt = await createTx.wait();
            const createEventList = createReceipt.logs.map((log) => factoryContract.interface.parseLog(log))
            expect(createEventList.length).to.be.equal(1);
            expect(createEventList[0].args[0]).to.be.equal(createFrom);  // address who requested the creation
            const contractAddress = createEventList[0].args[1];  // createReceipt.to is not the created contract address

            const contract = new ethers.Contract(contractAddress, Matching.interface, signers[1]);
            let owner = await contract.owner();
            expect(owner).to.be.equal(signers[0].address);
        });
    });
    describe(`Store encrypted data in Matching${N} contract`, function () {
        let signers; 
        let contract;
        //const secretSalt = 1234n;
        const secretSalt = 7414231717174750794300032619171286606889616317210963838766006185586667290625n;
        const uid = 0;

        // hardhat0 account
        const account = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'
        const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

        beforeEach(async function () {
            signers = await ethers.getSigners();     
            const contractFactory= await ethers.getContractFactory(`Matching${N}`, signers[0]);        
            contract = await contractFactory.deploy();
            await contract.deployed();
        });

        it("Encrypt and decrypt secretSalt", async function () {
            expect(BigInt(signers[0].address)).to.be.equal(BigInt(account));

            // Step 1. Write publicKey to the contract
            const privateKeyUint8Array = bigIntToUint8Array(privateKey, 32);
            const publicKeyBase64 = getEncryptionPublicKey(privateKeyUint8Array);
            const publicKeyBigInt = uint8ArrayToBigInt(base64ToUint8Array(publicKeyBase64));

            let tx1 = await contract.setPublicKey(base64ToUint8Array(publicKeyBase64)); // pass Uint8Array
            let _publicKeyHex = await contract.publicKey();  // hex string
            expect(BigInt(_publicKeyHex)).to.be.equal(publicKeyBigInt);


            // Step 2. Enctypt secretSalt using the publicKey
            const secretSaltBase64 = uint8ArrayToBase64(bigIntToUint8Array(secretSalt, 32));
            const enc = encrypt({publicKey: publicKeyBase64, data: secretSaltBase64,  version: 'x25519-xsalsa20-poly1305'});
            const encryptedSaltUint8Array = base64ToUint8Array(enc.ciphertext);
            const encryptedSaltUint8Array1 = encryptedSaltUint8Array.slice(0, 32);
            const encryptedSaltUint8Array2 = encryptedSaltUint8Array.slice(32);
            expect(encryptedSaltUint8Array2.length).to.be.equal(28);
            let tx2 = await contract.commitScoreHashAndSetEncryptedSalt(
                uid, 
                999, // commit dummy hash value
                base64ToUint8Array(enc.ephemPublicKey),              // 32 bytes
                base64ToUint8Array(enc.nonce),                       // 24 bytes
                encryptedSaltUint8Array1, encryptedSaltUint8Array2   // 32 + 28 = 60 bytes (for 32 bytes data)
                );

            // Step 3 Decrypt
            let _ephemPublicKeyHex = await contract.ephemPublicKey(uid);
            let _nonceHex = await contract.nonce(uid);
            let _encryptedSalt1Hex = await contract.encryptedSalt1(uid);
            let _encryptedSalt2Hex = await contract.encryptedSalt2(uid);
            let _encryptedSaltUint8Array = new Uint8Array([ ...bigIntToUint8Array(BigInt(_encryptedSalt1Hex), 32), ...bigIntToUint8Array(BigInt(_encryptedSalt2Hex), 28)])
            let encryptedData = { 
                version: 'x25519-xsalsa20-poly1305',                
                ephemPublicKey: uint8ArrayToBase64(bigIntToUint8Array(BigInt(_ephemPublicKeyHex), 32)), 
                nonce: uint8ArrayToBase64(bigIntToUint8Array(BigInt(_nonceHex), 24)), 
                ciphertext: uint8ArrayToBase64(_encryptedSaltUint8Array),
            }
            const decryptedString = decrypt({ encryptedData: encryptedData, privateKey: privateKeyUint8Array});
            expect(uint8ArrayToBigInt(base64ToUint8Array(decryptedString))).to.be.equal(secretSalt);
            
        }); 

        it("Non-owner cannot call publicKey", async function () {
            // Calling setPublicKey from Hardhat account 1 must fail
            const contract1 = new ethers.Contract(contract.address, contract.interface, signers[1]);
            const publicKeyUint8Array = new Uint8Array(32);
            await expect(contract1.setPublicKey(publicKeyUint8Array)).to.be.revertedWith('Assertion error')
        });
    });
}
