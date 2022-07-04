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
import { rankingToScore } from "../src/stable-matching"
import { getContractArtifact } from "../src/contract-utils"
import { uint8ArrayToBase64, base64ToUint8Array, bigIntToUint8Array, uint8ArrayToBigInt } from '../src/binary-utils';
import { encrypt, decrypt, getEncryptionPublicKey } from '@metamask/eth-sig-util'


export async function getStaticProps() {
    const contractNames = ["Matching3", "Matching4", "Matching5"];
    const contractInfoList = []
    for (let nm of contractNames) {
        let info = {"name": nm, "artifact": getContractArtifact(nm)};
        contractInfoList.push(info);
    }
    return { props: { contractInfoList } }
}


export default function Submit({ contractInfoList }) {
    const [logs, setLogs] = React.useState("");
    const [logs2, setLogs2] = React.useState("");
    const [logs_err, setLogs_err] = React.useState("");

    const validationSchema = Yup.object({
        address: Yup.string().matches(/^0x/, "The address is a 42 characters length string starting with \"0x\"").min(42).max(42).required("Address shared from the organizer is required"),  // length 42 starting with 0x
        size: Yup.number().min(3).max(5).required("Please select matching size"),
        group: Yup.string().required("Please select your group").oneOf(["Man", "Woman"]),
        indexNumber: Yup.number().min(1, "Your Index Number must be greater than or equal to 1").required("Your index number is required").test({
            name: 'max',
            message: 'Your index number must be less than or equal to the matching size',
            test: function (value) {
                return value <= parseFloat(this.parent.size)
            },
        }),
        secretSalt: Yup.string().required("Your secret salt is required").matches(/^[0-9]+$/).test({
            name: 'min',
            message: "Secret Salt must be at least 30 digits",
            test: function (value) {
                try { return BigInt(value) >= BigInt("1" + "0".repeat(29)) }   // 10^30 (exponent not supported)
                catch (eff) { return false }
            },            
        }).test({
            name: 'max',
            exclusive: false,
            params: { },
            message: "Secret Salt must be less than or equal to 76 digits",  // less than circom modulo p
            test: function (value) {
                try { return BigInt(value) < BigInt("1" + "0".repeat(76)) } 
                catch (err) { return false }
            },            
        }), 
        rankingNumberString: Yup.string().matches(/^[,0-9]+$/, 'Type comma-separated numbers from the most preffered.').required("Your preference is required").test({
            name: 'duplicates',
            message: `There are duplicate numbers`,
            test: function (value) {
                try { 
                    const ranking = value.split(',').filter(i => i.length > 0).map(i => parseInt(i));
                    const rankingSet = new Set(ranking);
                    if ( ranking.length === rankingSet.size ) { return true }
                    else { return false }
                }
                catch (err) { return false }
            }
        }).test({
            name: 'all',
            message: `You must rank all candidates`,
            test: function (value) {
                try {
                    const ranking = value.split(',').filter(i => i.length > 0).map(i => parseInt(i));
                    if (ranking.length !== this.parent.size) {return false};
                    return true
                }
                catch (err) { return false }
            }
        }).test({
            name: 'min',
            message: `Numbers are greater than or equal to 1`,
            test: function (value) {
                try {
                    const ranking = value.split(',').filter(i => i.length > 0).map(i => parseInt(i));
                    if (Math.min(...ranking) < 1) {return false};
                    return true
                }
                catch (err) { return false }
            }
        }).test({
            name: 'max',
            message: `Numbers are less than or equal to the matching size`,
            test: function (value) {
                try {
                    const ranking = value.split(',').filter(i => i.length > 0).map(i => parseInt(i));
                    if (Math.max(...ranking) !== this.parent.size) {return false};
                    return true
                }
                catch (err) { return false }
            }
        }),  
    });

    const initialValues = {
        address: '',
        size: '',
        group: '',
        indexNumber: '',
        secretSalt: '',
        rankingNumberString: '',
    };
    // const initialValues = {
    //     address: '0xa65c187b9808D6A6ABE7e8a91e7AbBF6ee766B6B',
    //     size: 3,
    //     group: 'Man',
    //     indexNumber: 1,
    //     secretSalt: '123456789012345678901234567890123',
    //     rankingNumberString: '1,3,2',
    // };

    const renderError = (message) => <p style={{color: "red"}}>{message}</p>;

    async function submit(address, N, group, indexNumber, secretSalt, rankingNumberString) {
        const index = indexNumber - 1;  // index is from 0 to N-1. (internal representation)
        const offset = (group === 'Man')?  0 : N; // 0 for Men, N for Women.

        // Parse preferenceListString
        const ranking = rankingNumberString.split(',').filter(i => i.length > 0).map(i => parseInt(i) - 1);  // e.g. [0, 2, 1]
        if (ranking.length !== N) {
            setLogs_err(`ERROR: Preffered Partner must include ${N} numbers.`)
            return;
        }
        const score = rankingToScore(ranking)


        // Compute hash
        const poseidon = await buildPoseidon(); 
        const F = poseidon.F;
        const sHash = F.toObject(poseidon([secretSalt, ...score]));  // secretSalt is string, but it works 


        // Read data from contract
        const contractInfo = contractInfoList.filter(i => i['name'] == `Matching${N}`)[0]
        const contractAddress = address;
        const contractArtifact = contractInfo['artifact']
    
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

        let contract;
        let sh;
        let publicKeyHex;
        try {
            contract = new ethers.Contract(contractAddress, contractArtifact['abi'], signer);
            sh = await contract.scoreHash(offset + index);
            publicKeyHex = await contract.publicKey();  // hex string (starting with 0x)
        } catch (err) {
            setLogs("")
            setLogs_err(`ERROR: failed to read contract data. address: ${contractAddress}, err: ${err}`)            
        }
        if ( BigInt(sh) !== BigInt(0) ) { 
            setLogs_err('You cannot make a submission because there is a commit already.');
            return;
        }

        
        // Encrypt secretSalt  
        const publicKeyBase64 = uint8ArrayToBase64(bigIntToUint8Array(BigInt(publicKeyHex), 32));
        const secretSaltBase64 = uint8ArrayToBase64(bigIntToUint8Array(BigInt(secretSalt), 32));
        const enc = encrypt({publicKey: publicKeyBase64, data: secretSaltBase64, version: 'x25519-xsalsa20-poly1305'});
        const encryptedSaltUint8Array = base64ToUint8Array(enc.ciphertext);
        const encryptedSaltUint8Array1 = encryptedSaltUint8Array.slice(0, 32);
        const encryptedSaltUint8Array2 = encryptedSaltUint8Array.slice(32);


        // Write data to contract
        try {
            setLogs("Calling contract...")    
            const tx = await contract.commitScoreHashAndSetEncryptedSalt(
                offset + index,
                sHash, 
                base64ToUint8Array(enc.ephemPublicKey),              // 32 bytes
                base64ToUint8Array(enc.nonce),                       // 24 bytes
                encryptedSaltUint8Array1, encryptedSaltUint8Array2   // 32 + 28 = 60 bytes (for 32 bytes data)
                );            
            } 
        catch (err) {
            setLogs_err(`ERROR: failed to commit your data in the blockchain. err: ${err}`);
            return;
        }
        setLogs(`Hash of your preference is commited in the blockchain`);
        setLogs2(`hash = ${sHash}`);
    }

    return (
        <div className={styles.container}>
            <Head>
                <title>Submit your preference</title>
                <meta name="description" content="Generated by create next app" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}> Submit your preference ranking</h1>

                <p className={styles.description}> Participants fill in the form below</p>

                <ul className={styles.description}> 
                    <li className={styles.list}> Use Matching Event address from the organizer </li>
                    <li className={styles.list}> Choose a random number for secret salt and keep it to see the result</li>
                    <li className={styles.list}> Your preference ranking is only visible to the organizer</li>
                </ul> 

            <br></br>

            <Formik 
            initialValues={initialValues} 
            validationSchema={validationSchema} 
            onSubmit={async (values, { resetForm }) => {await submit(values.address, parseInt(values.size), values.group, values.indexNumber, BigInt(values.secretSalt), values.rankingNumberString); resetForm()}}
            >
            <Form>            
                <div className={styles.container}>

                    <div className={styles.field}>
                            <label className={styles.label} htmlFor="address"> Matching Event Address: </label>
                            <Field
                                name="address"
                                type="text"
                                className={styles.addressform}
                                placeholder="e.g. 0xce35A903d6033E6B5E309ddb8bF1Db5e33070Dbc"
                            />
                            <ErrorMessage name="address" render={renderError} />
                    </div>      

                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="size"> Matching Size: </label>
                        <Field
                            name="size"
                            as="select"
                            className={styles.selectform}
                            placeholder=""
                        >
                        <option value={""}>Select size</option>
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                        <option value={5}>5</option>
                        </Field>                    
                        <ErrorMessage name="size" render={renderError} />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="group"> Your Group: </label>
                        <Field
                            name="group"
                            as="select"
                            className={styles.selectform}
                            placeholder=""
                        >
                        <option value={""}>Select group</option>
                        <option value={"Man"}>Man</option>
                        <option value={"Woman"}>Woman</option>
                        </Field>                    
                        <ErrorMessage name="group" render={renderError} />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}  htmlFor="indexNumber"> Your Index Number: </label>
                        <Field
                            name="indexNumber"
                            type="number"
                            className={styles.indexform}
                            placeholder="e.g. 2"
                        />
                        <ErrorMessage name="indexNumber" render={renderError} />
                    </div>     

                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="secretSalt"> Your Secret Salt Number: </label>
                        <Field
                            name="secretSalt"
                            type="text"
                            className={styles.saltform}
                            placeholder="e.g. 12774367769825274767468634682317838448486152426"
                        />
                        <ErrorMessage name="secretSalt" render={renderError} />
                    </div>    

                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="rankingNumberString"> Your Preffered Partner Index Numbers (from best to worst): </label>
                        <Field
                            name="rankingNumberString"
                            type="text"
                            className={styles.textform}
                            placeholder="e.g. 2,1,3"
                        />
                        <ErrorMessage name="rankingNumberString" render={renderError} />
                    </div>                  

                </div>

                {/* 
                */}

                <div className={styles.center}>   
                    <button type="submit" className={styles.button}> Submit </button>
                </div>

            </Form>
            </Formik>

            <div classsName={styles.container}> 
                <div className={styles.log}>{logs}</div>  
                {renderError(logs_err)}  
            </div>
            </main>

            <footer className={styles.footer}>        
                <Link href="/"> 
                    <a>Back to home</a> 
                </Link>
                <Link href="/result">
                    <a>Go to result</a> 
                </Link>
            </footer>

        </div>
    )
}
