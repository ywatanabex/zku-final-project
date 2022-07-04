import Head from 'next/head';
import Image from 'next/image';
import styles from '../styles/Home.module.css';
import React from "react";
import * as Yup from "yup";
import { Formik, Form, Field, ErrorMessage } from "formik";
import { ethers, providers } from "ethers";
import detectEthereumProvider from "@metamask/detect-provider"
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

export default function Reset({ contractInfoList }) {
    const [logs, setLogs] = React.useState("");

    const validationSchema = Yup.object({
        size: Yup.number().min(3).max(5).required("Please select your matching size"),
    });

    const initialValues = {
        address: '',
        size: '',
    };
    // const initialValues = {
    //   reset: '0x9f99af641CE232B53C51014D04006182bf9005ac',
    //   size: 3,
    // };

    const renderError = (message) => <p style={{color: "red"}}>{message}</p>;

    async function reset(address, N) {

        // Call contract method
        const contractInfo = contractInfoList.filter(i => i['name'] == `Matching${N}`)[0]
        const contractAddress = address;
        const contractArtifact = contractInfo['artifact'];

        let signer;
        try {
            setLogs('Sign with Metamask Wallet')
            const provider = (await detectEthereumProvider())
            await provider.request({ method: "eth_requestAccounts" })
            const ethersProvider = new providers.Web3Provider(provider)
            signer = ethersProvider.getSigner()
            const message = await signer.signMessage(`Sign this message to reset the contract (address=${contractAddress})`)
        } catch (err) {
            setLogs(`err: ${err}`);
            return;
        }
        
        try {
            const contract = new ethers.Contract(contractAddress, contractArtifact['abi'], signer);
            setLogs("Calling contract...") 
            const tx = await contract.reset();
        } catch (err) {
            setLogs(`ERROR: reset failed. err: ${err}`);
            return;            
        }
        setLogs(`Contract has been reset.`); 

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
          onSubmit={async (values, { resetForm }) => {await reset(values.address, parseInt(values.size)); resetForm()}}
        >
          <Form>            
              <div className="container" style={{width: "100%"}}>

              <div className="field">
                      <label className="label" htmlFor="address"> Matching Event Address </label>
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
