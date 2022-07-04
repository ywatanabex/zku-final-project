import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/Home.module.css';
import React from "react";
import * as Yup from "yup";
import { Formik, Form, Field, ErrorMessage } from "formik";
import { buildPoseidon } from 'circomlibjs';
import { ethers, providers } from "ethers";
import detectEthereumProvider from "@metamask/detect-provider"
import { decodeMatchingHash } from '../src/utils';
import { getContractArtifact } from "../src/contract-utils"


export async function getStaticProps() {
  const contractNames = ["Matching3", "Matching4", "Matching5"];
  const contractInfoList = []
  for (let nm of contractNames) {
      let info = {"name": nm, "artifact": getContractArtifact(nm)};
      contractInfoList.push(info);
  }
  return { props: { contractInfoList } }
}


export default function Result({ contractInfoList }) {
    const [logs, setLogs] = React.useState("");
    const [logs_err, setLogs_err] = React.useState("");

    // copied from submit.js
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
                try { return BigInt(value) >= BigInt("1" + "0".repeat(30)) }   // 10^30 (exponent not supported)
                catch (eff) { return false }
            },            
        }).test({
            name: 'max',
            exclusive: false,
            params: { },
            message: "Secret Salt must be less than 77 digits",  // less than circom modulo p
            test: function (value) {
                try { return BigInt(value) < BigInt("1" + "0".repeat(77)) } 
                catch (err) { return false }
            },            
        }), 
    });

    // const initialValues = {
    //     address: '',
    //     size: '',
    //     group: '',
    //     indexNumber: '',
    //     secretSalt: '',
    // };
    const initialValues = {
        address: '0xa65c187b9808D6A6ABE7e8a91e7AbBF6ee766B6B',
        size: 3,
        group: 'Man',
        indexNumber: 1,
        secretSalt: '123456789012345678901234567890',
    };

    const renderError = (message) => <p style={{color: "red"}}>{message}</p>;

    async function result(address, N, group, indexNumber, secretSalt) {
        const index = indexNumber - 1;  // index is from 0 to N-1. (internal representation)
        const offset = (group === 'Man')?  0 : N; // 0 for Men, N for Women.
        const poseidon = await buildPoseidon(); 
    
        // Contract
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

        // Get Matching
        const oppositeGroup = (group === 'Man')?  'Woman' : 'Man';
        let partnerIndex;
        try {
            const contract = new ethers.Contract(contractAddress, contractArtifact['abi'], signer);    
            const mHash = await contract.matchingHash(offset + index);
            partnerIndex = decodeMatchingHash(poseidon, secretSalt, mHash, N);
        } catch (err) {
            setLogs("")
            setLogs_err(`ERROR: failed to get matching result. err: ${err}`)
            return;
        }
    
        if (partnerIndex !== -1) {
            setLogs(`You are matched with the ${oppositeGroup} of Index Number = ${partnerIndex + 1}`)   // Index Number is from 1 to N.
        } else {
            setLogs("")
            setLogs("ERROR: failed to decode matching result. Please double check the field values and try again")
        }
    }

    return (
        <div className={styles.container}>
            <Head>
                <title>Show result</title>
                <meta name="description" content="Generated by create next app" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}> See who you were matched with</h1>
                <p className={styles.description}>
                    Fill in the forms to see your matched partner
                </p>

                <ul className={styles.description}> 
                    <li className={styles.list}> Your matching result is only visible to the organizer and the matched partner </li>
                    <li className={styles.list}> Your matched partner does not know your preference ranking </li>
                </ul> 

                <Formik 
                    initialValues={initialValues} 
                    validationSchema={validationSchema} 
                    onSubmit={async (values, { resetForm }) => {await result(values.address, parseInt(values.size), values.group, values.indexNumber, values.secretSalt); resetForm()}}
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
                                <option value={4}>5</option>
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
                                <label className={styles.label} htmlFor="indexNumber"> Your Index Number: </label>
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
                    

                        </div>

                        <div className={styles.center}>                                                                                                 
                            <button type="submit" className={styles.button}> Show Result </button>
                        </div>
                    </Form>
                </Formik>

            
                <div className={styles.logs}>{logs}</div>  
                <div className={styles.logs}>{logs_err}</div>  

            </main>

            <footer className={styles.footer}>        
                <Link href="/"> 
                    <a>Back to home</a> 
                </Link>
            </footer>

        </div>
    )
}
