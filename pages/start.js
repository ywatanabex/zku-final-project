import { readFileSync } from 'fs';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/Home.module.css';
import React from "react";
import * as Yup from "yup";
import { Formik, Form, Field, ErrorMessage } from "formik";
import { buildPoseidon } from 'circomlibjs';
import { ethers, providers } from "ethers";
import detectEthereumProvider from "@metamask/detect-provider"
import { getContractArtifact } from "../src/contract-utils"
import { uint8ArrayToBase64, base64ToUint8Array, bigIntToUint8Array, uint8ArrayToBigInt } from '../src/binary-utils';
const groth16  = require("snarkjs").groth16;

export async function getStaticProps() {
    // 1. MatchingNFactory
    // TODO: add config for this
    //const contractInfoList = JSON.parse(readFileSync('deployed-contracts/hardhat.json', {'encoding': 'utf-8'}));
    //const contractInfoList = JSON.parse(readFileSync('deployed-contracts/harmony-dev.json', {'encoding': 'utf-8'}));
    const contractInfoList = JSON.parse(readFileSync('deployed-contracts/harmony-main.json', {'encoding': 'utf-8'}));
    for (let ci of contractInfoList) {
        ci['artifact'] = getContractArtifact(ci['name']);
    }

    // 2. Matching
    const contractNames = ["Matching3", "Matching4", "Matching5"];
    for (let nm of contractNames) {
        let info = {"name": nm, "artifact": getContractArtifact(nm)};
        contractInfoList.push(info);
    }    
    return { props: { contractInfoList } }
}

export default function Start({ contractInfoList }) {
    const [logs, setLogs] = React.useState("");
    const [logs2, setLogs2] = React.useState("");
    const [logs_err, setLogs_err] = React.useState("");

    const validationSchema = Yup.object({
        size: Yup.number().min(3).max(5).required("Please select your matching size"),
    });

    const initialValues = {
        size: '',
    };
    // const initialValues = {
    //     size: 3,
    // };  

    const renderError = (message) => <p style={{color: "red"}}>{message}</p>;

    async function start(N) {
        const factoryContractInfo = contractInfoList.filter(i => i['name'] == `Matching${N}Factory`)[0]
        const factoryContractAddress = factoryContractInfo['address']
        const factoryContractArtifact = factoryContractInfo['artifact']

        // Load Metamask account
        let signer;
        try {
            setLogs('Sign with Metamask Wallet')
            const provider = (await detectEthereumProvider())
            await provider.request({ method: "eth_requestAccounts" })
            const ethersProvider = new providers.Web3Provider(provider)
            signer = ethersProvider.getSigner()
            const message = await signer.signMessage("Sign this message to create a Matching Event contract.")
        }
        catch (err) {
            setLogs("")
            setLogs_err(`ERROR: please install Metamask on your browser.`)
            return;
        }

        // Create Matching contract
        const factoryContract = new ethers.Contract(factoryContractAddress, factoryContractArtifact['abi'], signer);
        let receipt;
        try {
            setLogs(`Waiting for confirmation...`)   
            const tx = await factoryContract.createMatching();
            receipt = await tx.wait();
        }
        catch (err) {
            setLogs("")
            setLogs_err(`ERROR: failed to create a Matching Event contract.`)
            return;      
        }

        // Parse receipt
        const createEventList = receipt.logs.map((log) => factoryContract.interface.parseLog(log))
        let eventAddress;
        if (createEventList.length == 1 ) {
            const senderAddress = createEventList[0]['args']['senderAddress']; 
            eventAddress = createEventList[0]['args']['eventAddress'];   
            setLogs("")
        } else {
            setLogs("");
            setLogs_err(`ERROR: something went wrong in creating a Matching Event contract.`)
            return;
        }

        // Set publicKey to the contract
        const contractInfo = contractInfoList.filter(i => i['name'] == `Matching${N}`)[0]
        const contractArtifact = contractInfo['artifact']
        const contract = new ethers.Contract(eventAddress, contractArtifact['abi'], signer);
        try {
            const userAddress = await signer.getAddress()
            const publicKeyBase64 = await window.ethereum.request({
                method: 'eth_getEncryptionPublicKey',
                params: [userAddress],
            });
            let tx1 = await contract.setPublicKey(base64ToUint8Array(publicKeyBase64)); // pass Uint8Array
        }
        catch (err) {
            setLogs_err(`ERROR: failed in publishing your public key to the contract. : ${err}`);
            return;
        }        
        setLogs(`Success!`); 
        setLogs2(`Share this Matching Event Address: ${eventAddress}`); 
    }

    return (
    <div className={styles.container}>
        <Head>
        <title>Start Matching</title>
        <meta name="description" content="Generated by create next app" />
        <link rel="icon" href="/favicon.ico" />
        </Head>

        <main className={styles.main}>
        <h1 className={styles.title}> Start a Matching Event</h1>

        <ol className={styles.description}> 
            <li className={styles.list}> Select a matching size to create a new Matching Event </li>
            <li className={styles.list}> Share the generated address with participants </li>
        </ol> 

        <Formik 
            initialValues={initialValues} 
            validationSchema={validationSchema} 
            onSubmit={async (values, { resetForm }) => {await start(parseInt(values.size)); resetForm()}}
        >
            <Form>            
                <div className={styles.container}>
                    <div>
                        <label className={styles.p} htmlFor="size"> Matching Size: </label>
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
                    <br></br>
                    <br></br>
                    <div className={styles.center}>                                                                                                 
                        <button type="submit" className={styles.button}> Start </button>
                    </div>
                </div>

            </Form>
        </Formik>

        <div classsName={styles.container}> 
            <div className={styles.log}>{logs}</div>  
            <div className={styles.log}>{logs2}</div>
            {renderError(logs_err)}
        </div>
        </main>

        <footer className={styles.footer}>        
            <Link href="/"> 
                <a>Back to home</a> 
            </Link>
            <Link href="/">
                <a>Go to register</a> 
            </Link>
        </footer>

    </div>
    )
}
