const chai = require("chai");
const assertArrays = require('chai-arrays');
const expect = chai.expect;
chai.use(assertArrays);
const { ethers } = require("hardhat");
const { groth16 } = require("snarkjs");
const { poseidonContract, buildPoseidon } = require("circomlibjs");
const { rankingToScore, computeStableMatching, matchingToArray } = require('../src/stable-matching');
const { unstringifyBigInts, decodeMatchingHash } = require('../src/utils');

const scenarioPathList = ['./scenario01.json', './scenario02.json', './scenario03.json']

for (let scenarioPath of scenarioPathList) {
    scenario = require(scenarioPath);
    let N = scenario.length / 2;

    describe(`Matching${N}`, function () {
        let scenario;
        let contract;
        let poseidon;
        let F;

        beforeEach(async function () {
            scenario = require(scenarioPath);
            const Matching= await ethers.getContractFactory(`Matching${N}`);        
            contract = await Matching.deploy();
            await contract.deployed();
            poseidon = await buildPoseidon();
            F = poseidon.F;
        });

        it("Follow zkMatching protocol under scenario", async function () {
            // Check scenario data
            const scenarioMan = scenario.filter(d => d['group'] == 'Man');
            const scenarioWoman = scenario.filter(d => d['group'] == 'Woman');
            expect(scenarioMan.map(d => d['index'])).to.be.equalTo([...Array(N).keys()]);
            expect(scenarioWoman.map(d => d['index'])).to.be.equalTo([...Array(N).keys()]);

            // Step 1. Each participant commit scoreHash to the contract
            for ( let i = 0; i < N; i++ ) {
                // Man
                sHash = F.toObject(poseidon([scenarioMan[i]['secretSalt'], ...rankingToScore(scenarioMan[i]['ranking'])]));
                await contract.commitScoreHash(i.toString(), sHash.toString());
                expect(await contract.scoreHash(i)).to.be.equal(sHash);

                // Woman
                let j = N + i;
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
                `contracts/circuits/Matching${N}/Matching${N}_js/Matching${N}.wasm`,
                `contracts/circuits/Matching${N}/circuit_final.zkey`);
            
            const editedPublicSignals = unstringifyBigInts(publicSignals);
            const editedProof = unstringifyBigInts(proof);
            const calldata = await groth16.exportSolidityCallData(editedProof, editedPublicSignals);
        
            const argv = calldata.replace(/["[\]\s]/g, "").split(',').map(x => BigInt(x).toString());

            const a = [argv[0], argv[1]];
            const b = [[argv[2], argv[3]], [argv[4], argv[5]]];
            const c = [argv[6], argv[7]];
            const input = argv.slice(8);  // public signals (12 hashes)

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
                // decode matchingHash
                const mHash = await contract.matchingHash(i);
                const secretSalt = scenarioMan[i]['secretSalt'];
                const partnerIndex = decodeMatchingHash(poseidon, secretSalt, mHash, N);
                expect(Input["matching"][i][partnerIndex]).to.be.equal(1);
                
                // check scoreHash has not been changed 
                const sHash = await contract.scoreHash(i);
                expect(poseidon.F.toObject(poseidon([secretSalt, ...rankingToScore(scenarioMan[i]['ranking'])]))).to.be.equal(sHash)            
            }
        
            // Woman
            for ( let j = 0; j < N; j++ ) {
                // decode matchingHash
                const mHash = await contract.matchingHash(N+j);
                const secretSalt = scenarioWoman[j]['secretSalt'];
                const partnerIndex = decodeMatchingHash(poseidon, secretSalt, mHash, N);
                expect(Input["matching"][partnerIndex][j]).to.be.equal(1);
                
                // check scoreHash has not been changed 
                const sHash = await contract.scoreHash(N+j);
                expect(poseidon.F.toObject(poseidon([secretSalt, ...rankingToScore(scenarioWoman[j]['ranking'])]))).to.be.equal(sHash)       
            }        

        }); 
    });
}
