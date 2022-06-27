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
import { rankingToScore } from "../src/stable-matching"


export async function getStaticProps() {
    const contractInfoList = JSON.parse(readFileSync('scripts/contracts-dev.json', {'encoding': 'utf-8'}));
    for (let ci of contractInfoList) {
        ci['artifact'] = JSON.parse(readFileSync(ci['filePath'], {'encoding': 'utf-8'}));
    }
    return { props: { contractInfoList } }
}

export default function Reset({ contractInfoList }) {
  const [logs, setLogs] = React.useState("");

  const validationSchema = Yup.object({
    size: Yup.number().min(3).max(5).required("Please select your matching size"),
  });

  const initialValues = {
    size: '',
  };
  // const initialValues = {
  //   size: 3,
  // };

  const renderError = (message) => <p style={{color: "red"}}>{message}</p>;

  async function reset(N) {
    //setLogs(`set log in submit; N=${N}`);

    // Call contract method
    const contractInfo = contractInfoList.filter(i => i['name'] = `Matching${N}`)[0]
    const contractAddress = contractInfo['address']
    const contractArtifact = contractInfo['artifact']
    const contractName = contractArtifact['contractName'];

    setLogs('Sign with Metamask Wallet')
    const provider = (await detectEthereumProvider())
    await provider.request({ method: "eth_requestAccounts" })
    const ethersProvider = new providers.Web3Provider(provider)
    const signer = ethersProvider.getSigner()
    const message = await signer.signMessage(`Sign this message to reset the contract (address=${contractAddress})`)
    
    const contract = new ethers.Contract(contractAddress, contractArtifact['abi'], signer);
    setLogs("Calling contract...")    
    await contract.reset();
    setLogs(`Contract has been reset.\n contractName = ${contractName},\n contractAddress = ${contractAddress}`);

  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Reset Contract</title>
        <meta name="description" content="Reset Contract State Variables" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}> Reset Contract</h1>
        <p className={styles.description}>
            Click the button when you start a new zkMatching round.
            <br></br>
            State variables of the contract is reset.
        </p>

        <Formik 
          initialValues={initialValues} 
          validationSchema={validationSchema} 
          onSubmit={async (values, { resetForm }) => {await reset(parseInt(values.size)); resetForm()}}
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
            
              </div>

              {/* 
              */}

              <p></p>       
              <button type="submit" className={styles.button}> Reset </button>

              <div className={styles.logs}>{logs}</div>  
          </Form>
         </Formik>

        



      </main>


    </div>
  )
}
