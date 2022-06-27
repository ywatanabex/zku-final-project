import { readFileSync } from 'fs';
import Head from 'next/head';
import Image from 'next/image';
import styles from '../styles/Home.module.css';
import React from "react";
import * as Yup from "yup";
import { Formik, Form, Field, ErrorMessage } from "formik";
import { buildPoseidon } from 'circomlibjs';
import { ethers, providers } from "ethers";
import detectEthereumProvider from "@metamask/detect-provider"
import { scoreToRanking, computeStableMatching, matchingToArray } from "../src/stable-matching"
import { unstringifyBigInts } from "../src/utils"
const groth16  = require("snarkjs").groth16;

export async function getStaticProps() {
    const contractInfoList = JSON.parse(readFileSync('scripts/contracts-dev.json', {'encoding': 'utf-8'}));
    for (let ci of contractInfoList) {
        ci['artifact'] = JSON.parse(readFileSync(ci['filePath'], {'encoding': 'utf-8'}));
    }
    return { props: { contractInfoList } }
}

export default function Register({ contractInfoList }) {
  const [logs, setLogs] = React.useState("");

  const validationSchema = Yup.object({
    size: Yup.number().min(3).max(5).required("Please select your matching size"),
    secretSaltListString: Yup.string().matches(/^[\n0-9]+$/, 'Type secretSalt for each line in the order from Men to Women.').required(),    // comma separated numbers
  });

  const initialValues = {
    size: '',
    secretSaltListString: '',
  };
//   const initialValues = {
//     size: 3,
//     secretSaltListString: `123456\n234567\n345678\n654321\n765432\n876543`,
//   };  

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
    //const ret = []
    for (let scores of scoreCandidates) {
        if (BigInt(scoreHash) === BigInt(poseidon.F.toObject(poseidon([hashSalt, ...scores])))) {
            return scores
        }
    }
    return []
  }  

  async function register(N, secretSaltListString) {
    // parse secretSaltListString
    const secretSaltList = secretSaltListString.trim().split('\n');
    if (secretSaltList.length !== 2 * N) {
        setLogs(`ERROR: Please input ${N} secret salts.`)
        return;
    }
    const contractInfo = contractInfoList.filter(i => i['name'] = `Matching${N}`)[0]
    const contractAddress = contractInfo['address']
    const contractArtifact = contractInfo['artifact']
    const poseidon = await buildPoseidon(); 

    setLogs('Sign with Metamask Wallet')
    const provider = (await detectEthereumProvider())
    await provider.request({ method: "eth_requestAccounts" })
    const ethersProvider = new providers.Web3Provider(provider)
    const signer = ethersProvider.getSigner()
    const message = await signer.signMessage("Sign this message to commit the hash of your preference ranking.")    
    const contract = new ethers.Contract(contractAddress, contractArtifact['abi'], signer);
    
    const scoreList = []
    for (let i = 0; i < 2 * N; i ++ ) {
        const sHash = await contract.scoreHash(i);
        const s = decodeScoreHash(poseidon, secretSaltList[i], sHash, N)
        scoreList.push(s)
    } 

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
    const { proof, publicSignals } = await groth16.fullProve(Input, `./Matching${N}/Matching${N}_js/Matching${N}.wasm`, `./Matching${N}/circuit_final.zkey`)
    const editedPublicSignals = unstringifyBigInts(publicSignals);
    const editedProof = unstringifyBigInts(proof);
    const calldata = await groth16.exportSolidityCallData(editedProof, editedPublicSignals);    
    const argv = calldata.replace(/["[\]\s]/g, "").split(',').map(x => BigInt(x).toString());

    const a = [argv[0], argv[1]];
    const b = [[argv[2], argv[3]], [argv[4], argv[5]]];
    const c = [argv[6], argv[7]];
    const input = argv.slice(8);  
    setLogs(`Register and Wait for confirmation`)   
    const tx = await contract.register(a, b, c, input);
    const receipt = await tx.wait();

    // check if registered
    const isRegistered = await contract.registered();
    if (isRegistered) {
        setLogs(`Successfully registered to contractAddress=${contractAddress}`)
    } else {
        setLogs(`Registration Failed`)
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
          onSubmit={async (values, { resetForm }) => {await register(values.size, values.secretSaltListString); resetForm()}}
        >
          <Form>            
              <div className="container" style={{width: "100%"}}>

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

                  <div className="field">
                      <label className="label" htmlFor="secretSaltListString"> Secret Salt List (One per line in order) </label>
                      <br></br>
                      <Field
                          name="secretSaltListString"
                          component="textarea"
                          rows="8"
                          className="textarea"
                          placeholder={`12345643121944783\n857487518738898489\n43742647687462867464389`}
                      />
                      <ErrorMessage name="secretSaltListString" render={renderError} />
                  </div>                                                                                                           
              </div>
              <p></p>       
                                    
              <button type="submit" className={styles.button}> Register </button>

              <div className={styles.logs}>{logs}</div>  
          </Form>
         </Formik>

        



      </main>


    </div>
  )
}
