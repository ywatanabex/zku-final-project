# zkMatching

![zkMatching banner image](public/banner.png)

[zkMatching](https://zkmatching.vercel.app/) computes a stable matching without disclosing the preferences and the matching result to each other under the assumption that the organizer keeps the secret. The correctness of the stable matching is verified using Zero Knowledge Proof and [Harmony](https://www.harmony.one/) blockchain.

## What can it be used for?

### What is Stable Matching?
As an illustrative example, let us assume first that there are N men and N women. A *matching* is the making of N man-woman pairs (marriages). Given that each man has an order of preference for the women and each woman also has an order of preference for the men, a matching is *stable* when there does not exist any man-woman combination which both prefer each other to their current partner under the matching. The stablity of matching is a type of optimality, satisfying everyone's preferences. Therefore, we want to seek stable matching.

More formally, the [Stable Matching Problem](https://en.wikipedia.org/wiki/Stable_marriage_problem) (a.k.a. Stable Marriage Problem) is the problem of finding a stable matching between two equally sized sets of elements given an ordering of preferences for each element. A *matching* is a bijection from the elements of one set to the elements of the other set. A matching is *stable* when there does not exist any pair which both prefer each other to their current partner under the matching.

The Stable Matching Problem appears in many real world applications, including teacher-student matching, seller-buyer matching, and user-server matching.
<!-- TODO: add detail here -->


### Why ZKP?
Given the preferences, the Gale-Shapley algorithm is known to yield a stable matching, which has a computational complexity of $O(N^2)$, where N is the number of men (women).

Our motivation is that **we do not want others to know each person's preferance and matched partner**. One obvious approach is that each person first tells a trusted organizer his/her preference, and then that organizer calculates a stable matching using the GS algorithm and finally tells it to each person. However, this approach does not verify that the matching calculated by the organizer was stable. One of the participants might bribe the organizer to get a favorable matching result for himself/herself.

With zkMatching, we can verify that the matching results computed by the organizer is a stable matching for everyone's preferences. More precisely, the organizer generates a proof that the result of the computation is a stable matching for the given input, which is verified by a contract on the blockchain. In summary, the advantages of using zkMatching include the followings:

* The participants can verify that the matching result is a stable matching of their preferences.
* The preference and the matched partner of the each participant is not disclosed to other participants, under the assumption that the organizer keeps the secret.


**_NOTE:_** Ideally, the assumption about the organizer should be removed. However, that issue is technically difficult and will not be addressed in this project. However, as noted above, zkMatching can be used for other applications.


## How to use zkMatching
This section uses examples to illustrate how to use the zkMatching system. The contracts are deployed on Harmony network and the UI system is hosted on [zkmatching.vercel.app](https://zkmatching.vercel.app/). Users must be able to use the Metamask wallet with Harmony ONE token.

Suppose three men (Adam, Bob, and Charles) and three women (Devorah, Elizabeth, and Fiona) met in a matching party. Each has a preference for who they prefer. An *organizer* (Oliver) helps make a matching of them using zkMatching.


### 0. Before Start
Each participants are numberd in their group and everyone knows the number. In man group, Adam=1, Bob=2, Charles=3, and Devorah=1, Elizabeth=2, Fiona=3 in woman group. Their preferences are like this:


```
1. Adam -> [E, F, D] = 2,3,1
2. Bob -> [F, D, E] = 3,1,2
3. Charles -> [E, D, F] = 2,1,3

1. Devorah -> [A, B, C] = 1,2,3
2. Elizabeth -> [C, B, A] = 3,2,1
3. Fiona -> [C, B, A] = 3,2,1
```

### 1. Start
Oliver goes to the [start page](https://zkmatching.vercel.app/start) and generates a Matching Event address. Oliver shares this address. Oliver is asked to approve a public key generation by Metamask. The public key is used to encrypt data of the participants.


### 2. Submit
Adam goes to the [submit page](https://zkmatching.vercel.app/submit) and fill in their preference ranking. He enters a very large random number, called secret salt, into the form. This number is kept by himself because he will need it see the result later. Other participants (B, C, D, E, F) operate the submit page in the same way.


### 3. Register
After all the participants have submitted,
Oliver goes to [register page](https://zkmatching.vercel.app/register).
He will be asked to allow decryption by Metamask.
The browser will generate a stable matching and register it to the blockchain.


### 4. Result
Adam goes to the [result page](https://zkmatching.vercel.app/result) and input his secret salt. He sees the number of his matched partner. A stable matching in this case is: (Adam, Devorah), (Bob, Fiona), and (Charles, Elizabeth). Therefore, Adam see the number 1. Other participants can see the results using secret salt as well.


**_NOTE:_** Currently only matching sizes N=3,4,5 are supported.



## zkMatching protocol and algorithm
In describing the zkMatching process, we will explain it in terms of man-woman matching.

First, suppose there are N men and N women. Both men and women are assigned a number from 1 to N. These men and women are collectively called *participants*. In addition, there is another party called *organizer*. 

1. Each man ranks N women in order of preference
2. Each woman ranks N men in order of preference
3. The organizer issues a matching contract and writes his public key
4. Each participant pick a random"secret salt", encrypt it with the public key and write it to the contract
5. Each participant commit the hash of his/her preference and the secret salt to the contract
6. The organizer decrypts the secret salt of all the participants
6. The organizer computes a stable matching using GS algorithm and generate a proof
6. The organizer calls a contract to verify the proof and commit the hash of the stable matching
7. Each participant decode the hash of the stable matching using his/her secret salt and obtain the result


### ZKP algorithm
The zero knowledge proof is based on zkSNARK algorithm. The proof guarantees that, for an arithmetic circuit, the prover has secret input for public output.
The main arithmetic circuit for this project is `contracts/circuits/MatchingTemplate.circom`. 

The private inputs of the circuit are:

* matching
* secret salts
* preference ranking

The public outputs of the circuit are:

* matching hashed with secret salts
* preference ranking hashed with secret salts.

Algebraic constraints in the circuit ensure that the matching is stable.
The participants can verify that preference ranking used for the computation by the hash.




## Future challenges and improvement ideas
* Remove the assumption on the organizer
* Support arbitrary number of matching size N
* Remove the constraint of equal numbers of men and women
* Remove the restriction that ties and truncations are not allowed on the preference list
* Encrypt secret salts and keep them in the blockchain so that they don't need to manage them
* Generate a UI page (URL) for each matching event so that users don't need to input the adress and matching size again and again


## How to use this repository
After cloning this repository, first run the following command.

```bash
% yarn                        # install 
% yarn compile                # compile circuits and contracts
% yarn test                   # test on the compiled contracts
% yarn run clean              # remove artifacts
```

Some compiled circuit data is copied under `public/` directory.
The compiled contract data is stored under the `artifacts/contracts/` directory.



### Deploy contract (Harmony Devnet, Mainnet)

Before deploying contracts, you need to create a Harmony account with ONE balance.
The private key should be set to an environment variable `privateKey0`.

You can run the following command to deploy contracts.

```bash
# devnet
% node scripts/deploy-contracts.js --network harmony-dev

# mainnet
% node scripts/deploy-contracts.js --network harmony-main
```

The command deploys `MatchingNFactory` contract, which creates a `MatchingN` contract in the start page.

Actually, I have already executed these commands and contracts have been deployed to the following addresses:

```
# devnet
Matching3Factory : 0xA516B5143D02196Ee9A0Cd430776Ae12d65a4eE0
Matching4Factory : 0x8627386da772399f79A921B8aE043921d8470C06
Matching5Factory : 0xE5911ce38111760B57b28966037DAB5eC688f56E
    
# mainnet
Matching3Factory : 0x0f74002E94fE549E9c4C9d04f6cA806f29377EDd
Matching4Factory : 0x2B854e7d5e093AF6986E14458D075a72C4e231eB
Matching5Factory : 0x112c396c380eB51F83900cB3dAF61bFf45e01472
```

This info is stored in `deployed-contracts/harmony-dev.json` and `deployed-contracts/harmony-main.json`.




### Run UI locally
UI for participants and the organizer will be launched with the following commands.

```
# Development Mode
% yarn next dev

# Production Mode
% yarn next build
% yarn next start
```



### CLI tools

You can check the state variables of `MatchingN` (N=3,4,5) contract using the following command. `network name` is either `hardhat`, `harmony-dev`, or `harmony-main`.

```bash
% node scripts/view-contracts.js --network <network name> --size <N> --address <contract address>
```


