const chai = require("chai");
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(assertArrays);
const { ethers } = require("hardhat");
const { groth16 } = require("snarkjs");
const { poseidonContract, buildPoseidon } = require("circomlibjs");
const { rankingToScore, computeStableMatching, matchingToArray } = require('../src/stable-matching');
const { unstringifyBigInts, decodeMatchingHash } = require('../src/utils');

//const scenarioPathList = ['./scenario01.json', './scenario02.json', './scenario03.json']
const scenarioPathList = ['./scenario01.json']

for (let scenarioPath of scenarioPathList) {
    scenario = require(scenarioPath);
    let N = scenario.length / 2;

    describe(`Matching${N}`, function () {
        let scenario;
        let factoryContract;
        let Matching;
        let signers;
        let poseidon;
        let F;

        beforeEach(async function () {
            scenario = require(scenarioPath);
            const MatchingFactory= await ethers.getContractFactory(`Matching${N}Factory`);        
            factoryContract = await MatchingFactory.deploy();
            await factoryContract.deployed();

            Matching= await ethers.getContractFactory(`Matching${N}`);   
            signers = await ethers.getSigners();     
            poseidon = await buildPoseidon();
            F = poseidon.F;
        });

        it("Follow zkMatching protocol under scenario", async function () {
            // Validate scenario data
            const scenarioMan = scenario.filter(d => d['group'] == 'Man');
            const scenarioWoman = scenario.filter(d => d['group'] == 'Woman');
            expect(scenarioMan.map(d => d['index'])).to.be.equalTo([...Array(N).keys()]);   // scenario data is sorted by index
            expect(scenarioWoman.map(d => d['index'])).to.be.equalTo([...Array(N).keys()]);
            signerDev = signers[0];
            signerOrganizer = signers[1];
            for (let i=0; i < N; i++) {
                scenarioMan[i]['signer'] = signers[2+i];
                scenarioWoman[i]['signer'] = signers[2+N+i];
            }

            // Step 0. Start Matching Event
            const createTx = await factoryContract.createMatching();
            const createFrom = createTx.from;
            const createReceipt = await createTx.wait();
            const createEventList = createReceipt.logs.map((log) => factoryContract.interface.parseLog(log))
            expect(createEventList.length).to.be.equal(1);
            expect(createEventList[0].args[0]).to.be.equal(createFrom);  // address who requested the creation
            const contractAddress = createEventList[0].args[1];  // createReceipt.to is not the created contract address
            
            // Step 1. Each participant commit scoreHash to the contract
            for ( let i = 0; i < N; i++ ) {
                // Man
                contract = new ethers.Contract(contractAddress, Matching.interface, scenarioMan[i]['signer']);
                sHash = F.toObject(poseidon([scenarioMan[i]['secretSalt'], ...rankingToScore(scenarioMan[i]['ranking'])]));
                await contract.commitScoreHash(i.toString(), sHash.toString());
                expect(await contract.scoreHash(i)).to.be.equal(sHash);

                // Woman
                let j = N + i;
                contract = new ethers.Contract(contractAddress, Matching.interface, scenarioWoman[i]['signer']);
                sHash = F.toObject(poseidon([scenarioWoman[i]['secretSalt'], ...rankingToScore(scenarioWoman[i]['ranking'])]));
                await contract.commitScoreHash(j.toString(), sHash.toString());
                expect(await contract.scoreHash(j)).to.be.equal(sHash);
            }

            // Step 2. Organizer computes matching, generate proof, and register
            const stableMatching = computeStableMatching(scenarioMan.map(d => d['ranking']), scenarioWoman.map(d => d['ranking']));

            Input = {
                "matching": matchingToArray(stableMatching),
                "privateKeyM": scenarioMan.map(d => d['secretSalt']),
                "privateKeyF": scenarioWoman.map(d => d['secretSalt']),
                "scoreMF": scenarioMan.map(d => rankingToScore(d['ranking'])),
                "scoreFM": scenarioWoman.map(d => rankingToScore(d['ranking']))
            }
            const { proof, publicSignals } = await groth16.fullProve(Input, 
                `public/artifacts/Matching${N}/Matching${N}_js/Matching${N}.wasm`,
                `public/artifacts/Matching${N}/circuit_final.zkey`);
            
            const editedPublicSignals = unstringifyBigInts(publicSignals);
            const editedProof = unstringifyBigInts(proof);
            const calldata = await groth16.exportSolidityCallData(editedProof, editedPublicSignals);
        
            const argv = calldata.replace(/["[\]\s]/g, "").split(',').map(x => BigInt(x).toString());

            const a = [argv[0], argv[1]];
            const b = [[argv[2], argv[3]], [argv[4], argv[5]]];
            const c = [argv[6], argv[7]];
            const input = argv.slice(8);  // public signals (12 hashes)

            contract = new ethers.Contract(contractAddress, Matching.interface, signerOrganizer);
            expect(await contract.registered()).to.be.false;        
            tx = await contract.register(a, b, c, input);  // not view function
            expect(await contract.registered()).to.be.true;   

            receipt = await tx.wait();
            eventNames = receipt.logs.map((log) => contract.interface.parseLog(log).name)
            eventArgs = receipt.logs.map((log) => contract.interface.parseLog(log).args)
            expect(eventNames).to.include("Register");


            // Step 3. Each participants acquire the result and acknowledge
            // Man
            for ( let i = 0; i < N; i++ ) {
                contract = new ethers.Contract(contractAddress, Matching.interface, scenarioMan[i]['signer']);

                // decode matchingHash
                const mHash = await contract.matchingHash(i);
                const secretSalt = scenarioMan[i]['secretSalt'];
                const partnerIndex = decodeMatchingHash(poseidon, secretSalt, mHash, N);
                expect(partnerIndex).to.be.equal(scenarioMan[i]['partner']);
                expect(Input["matching"][i][partnerIndex]).to.be.equal(1);
                
                // check scoreHash has not been changed 
                const sHash = await contract.scoreHash(i);
                expect(poseidon.F.toObject(poseidon([secretSalt, ...rankingToScore(scenarioMan[i]['ranking'])]))).to.be.equal(sHash)            
            }
        
            // Woman
            for ( let j = 0; j < N; j++ ) {
                contract = new ethers.Contract(contractAddress, Matching.interface, scenarioWoman[j]['signer']);

                // decode matchingHash
                const mHash = await contract.matchingHash(N+j);
                const secretSalt = scenarioWoman[j]['secretSalt'];
                const partnerIndex = decodeMatchingHash(poseidon, secretSalt, mHash, N);
                expect(partnerIndex).to.be.equal(scenarioWoman[j]['partner']);
                expect(Input["matching"][partnerIndex][j]).to.be.equal(1);
                
                // check scoreHash has not been changed 
                const sHash = await contract.scoreHash(N+j);
                expect(poseidon.F.toObject(poseidon([secretSalt, ...rankingToScore(scenarioWoman[j]['ranking'])]))).to.be.equal(sHash)       
            }        

        }); 
    });
}
