import { readFileSync } from 'fs';
import Head from 'next/head';
import styles from '../styles/Home.module.css';
import React from "react";
import * as Yup from "yup";
import { Formik, Form, Field, ErrorMessage } from "formik";
import { buildPoseidon } from 'circomlibjs';
import { ethers, providers } from "ethers";
import detectEthereumProvider from "@metamask/detect-provider"
import { scoreToRanking, computeStableMatching, matchingToArray } from "../src/stable-matching"
import { unstringifyBigInts } from "../src/utils"
import { getContractArtifact } from "../src/contract-utils"
import { uint8ArrayToBase64, base64ToUint8Array, bigIntToUint8Array, uint8ArrayToBigInt } from '../src/binary-utils';
import { encrypt, decrypt, getEncryptionPublicKey } from '@metamask/eth-sig-util'
const groth16  = require("snarkjs").groth16;


export async function getStaticProps() {
    const contractInfoList = []
    const contractNames = ["Matching3", "Matching4", "Matching5"];
    for (let nm of contractNames) {
        let info = {"name": nm, "artifact": getContractArtifact(nm)};
        contractInfoList.push(info);
    }    
    return { props: { contractInfoList } }
}

export default function Register({ contractInfoList }) {
    const [logs, setLogs] = React.useState("");
    const [logs_err, setLogs_err] = React.useState("");

    const validationSchema = Yup.object({
        size: Yup.number().min(3).max(5).required("Please select your matching size"),
    });

    // const initialValues = {
    //     address: '',
    //     size: '',
    // };
    const initialValues = {
        address: '0xa65c187b9808D6A6ABE7e8a91e7AbBF6ee766B6B',
        size: 3,
    };

    const renderError = (message) => <p style={{color: "red"}}>{message}</p>;

    function permutator(inputArr) {
        var results = [];  
        function permute(arr, memo) {
            var cur, memo = memo || [];
            for (var i = 0; i < arr.length; i++) {
            cur = arr.splice(i, 1);
            if (arr.length === 0) {
                results.push(memo.concat(cur));
            }
            permute(arr.slice(), memo.concat(cur));
            arr.splice(i, 0, cur[0]);
            }
            return results;
        }
    return permute(inputArr);
    }

    function decodeScoreHash(poseidon, hashSalt, scoreHash, N) {          
        const oneToN = Array(N).fill(0).map((i, k) => k + 1)    // 1, 2, ..., N
        const scoreCandidates = permutator(oneToN)
        for (let scores of scoreCandidates) {
            if (BigInt(scoreHash) === BigInt(poseidon.F.toObject(poseidon([hashSalt, ...scores])))) {
                return scores
            }
        }
        return []
    }  

    async function register(address, N) {
        const contractInfo = contractInfoList.filter(i => i['name'] == `Matching${N}`)[0]
        const contractAddress = address;
        const contractArtifact = contractInfo['artifact']
        const poseidon = await buildPoseidon(); 
        
        let signer;
        try {
            setLogs('Sign with Metamask Wallet')
            const provider = (await detectEthereumProvider())
            await provider.request({ method: "eth_requestAccounts" })
            const ethersProvider = new providers.Web3Provider(provider)
            signer = ethersProvider.getSigner()
            const message = await signer.signMessage("Sign this message to commit the hash of your preference ranking.")    
        } catch (err) {
            setLogs("")
            setLogs_err(`ERROR: please install Metamask on your browser.`)
            return;            
        }    
        const contract = new ethers.Contract(contractAddress, contractArtifact['abi'], signer);

        // Get encrypted secretSalt data
        let encList;
        try {
            const _encList = [] 
            for (let i = 0; i < 2 * N; i ++ ) {
                _encList.push(contract.ephemPublicKey(i));
                _encList.push(contract.nonce(i));
                _encList.push(contract.encryptedSalt1(i));
                _encList.push(contract.encryptedSalt2(i));            
            }
            const d = 4;  // ephemPublicKey, nonce, encryptedSalt1, encryptedSalt2
            encList = []
            await Promise.all(_encList).then((values) => {
                for (let i=0; i<2*N; i++) {
                    let es1 = bigIntToUint8Array(BigInt(values[d*i + 2]), 32);
                    let es2 = bigIntToUint8Array(BigInt(values[d*i + 3]), 28);
                    let es = new Uint8Array([...es1, ...es2]);
                    encList.push(
                        {
                            'version': 'x25519-xsalsa20-poly1305',
                            'ephemPublicKey': uint8ArrayToBase64(bigIntToUint8Array(BigInt(values[d*i + 0]), 32)),
                            'nonce': uint8ArrayToBase64(bigIntToUint8Array(BigInt(values[d*i + 1]), 24)),
                            'ciphertext': uint8ArrayToBase64(es),
                        }
                    )          
                } 
            })
        } catch (err) {
            setLogs_err(`ERROR: failed in getting encrypted secret salt data. err: ${err}`);
            return;
        }

        // Decrypt secret salt
        let secretSaltList;
        try {
            const userAddress = await signer.getAddress()
            const _decryptList = []
            for (let i = 0; i < 2 * N; i ++ ) {
                const ct = `0x${Buffer.from(JSON.stringify(encList[i]), 'utf8').toString('hex')}`
                _decryptList.push(window.ethereum.request({method: 'eth_decrypt', params: [ct, userAddress]}));
            }
            let decryptList
            await Promise.all(_decryptList).then((values) => { decryptList = values })
            secretSaltList = decryptList.map(b64 => uint8ArrayToBigInt(base64ToUint8Array(b64)) )
        }
        catch (err) {
            setLogs_err(`ERROR: failed in decryption. err: ${err}`);
            return;
        }
        setLogs(`Decryption of secret salts is completed`)

       
        // Get scoreHash decode to scoreList
        let scoreList = [];
        try {
            let _scoreHashList = [];
            for (let i = 0; i < 2 * N; i ++ ) { 
                _scoreHashList.push(contract.scoreHash(i));
            }
            let scoreHashList;
            await Promise.all(_scoreHashList).then((values) => { scoreHashList = values });
            for (let i=0; i<2*N; i++) {
                scoreList.push(decodeScoreHash(poseidon, secretSaltList[i], scoreHashList[i], N));
            }
        } catch (err) {
            setLogs_err(`ERROR: failed in getting scores. err: ${err}`);
            return;            
        }
        setLogs(`Decoding of scores is completed`)


        // Compute stable matching and generate proof
        try {
            setLogs(`Computing stable matching...`)
            const rankingList = scoreList.map(scoreToRanking)
            const rankingListM = rankingList.slice(0, N)
            const rankingListF = rankingList.slice(N, 2*N)
            const matching = computeStableMatching(rankingListM, rankingListF)
            const matchingArray = matchingToArray(matching)
            const Input = {
                "matching": matchingArray,
                "privateKeyM": secretSaltList.slice(0, N),
                "privateKeyF": secretSaltList.slice(N, 2*N),
                "scoreMF": scoreList.slice(0, N),
                "scoreFM": scoreList.slice(N, 2*N),
            }
    
            setLogs(`Generating Proof...`)
            const { proof, publicSignals } = await groth16.fullProve(Input, `./artifacts/Matching${N}/Matching${N}_js/Matching${N}.wasm`, `./artifacts/Matching${N}/circuit_final.zkey`)
            const editedPublicSignals = unstringifyBigInts(publicSignals);
            const editedProof = unstringifyBigInts(proof);
            const calldata = await groth16.exportSolidityCallData(editedProof, editedPublicSignals);    
            const argv = calldata.replace(/["[\]\s]/g, "").split(',').map(x => BigInt(x).toString());
    
            const a = [argv[0], argv[1]];
            const b = [[argv[2], argv[3]], [argv[4], argv[5]]];
            const c = [argv[6], argv[7]];
            const input = argv.slice(8);  

            setLogs(`Waiting for registration confirmation...`)   
            const tx = await contract.register(a, b, c, input);
            const receipt = await tx.wait();
        }
        catch (err) {
            setLogs_err(`ERROR: failed in computing matching, generating proof, or registering it. : ${err}`);
            return;       
        }
        
        // check if registered
        let isRegistered;
        try {
            isRegistered = await contract.registered();
        } catch (err) {
            setLogs_err(`ERROR: failed in getting registered variable: ${err}`);
        }        
        if (isRegistered) {
            setLogs(`Matching is successfully registered to address=${contractAddress}`)
        } else {
            setLogs("")
            setLogs_err(`Registration Failed`)
        }
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Register Stable Matching</title>
        <meta name="description" content="Generated by create next app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}> Compute Stable Matching!</h1>
        <p className={styles.description}>
            Run GS algorithm to compute stable matching on this browser.
            <br></br>
            The hash of the matching will be published in the contract.
        </p>

        <Formik 
          initialValues={initialValues} 
          validationSchema={validationSchema} 
          onSubmit={async (values, { resetForm }) => {await register(values.address, parseInt(values.size)); resetForm()}}
        >
          <Form>            
              <div className="container" style={{width: "100%"}}>

              <div className="field">
                      <label className="label" htmlFor="address"> Your Matching Event Address </label>
                      <Field
                          name="address"
                          type="text"
                          className="input"
                          placeholder="e.g. 0xce35A903d6033E6B5E309ddb8bF1Db5e33070Dbc"
                      />
                      <ErrorMessage name="address" render={renderError} />
              </div>    

              <div className="field">
                      <label className="label" htmlFor="size"> Matching Size </label>
                      <Field
                          name="size"
                          as="select"
                          className="select"
                          placeholder=""
                      >
                        <option value={""}>Select size</option>
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                        <option value={4}>5</option>
                      </Field>                    
                      <ErrorMessage name="size" render={renderError} />
                  </div>                                                                                                     
              </div>
              <p></p>       
                                    
              <button type="submit" className={styles.button}> Register </button>

              <div className={styles.logs}>{logs}</div>  
              <div className={styles.logs}>{logs_err}</div>  

          </Form>
         </Formik>

        



      </main>


    </div>
  )
}
