# zkMatching

![hoge](banner.png)

zkMatching is used to find a stable matching without disclosing the preferences and the matching result to each other under the assumption that the organizer keeps the secret. The correctness of the stable matching is verified using Zero Knowledge Proof.

## What can it be used for?

### What is Stable Matching?
As an illustrative example, let us assume first that there are N men and N womens. A *matching* is the making of N man-woman pairs (marriage). Given that each man has an order of preference for the women and each woman also has an order of preference for the men, a matching is *stable* when there does not exist any man-woman pair which both prefer each other to their current partner under the matching. The stablity of matching is an optimality, satisfying everyone's preferences. Therefore, we want to seek stable matching.

More formally, the [Stable Matching Problem](https://en.wikipedia.org/wiki/Stable_marriage_problem) (a.k.a. Stable Marriage Problem) is the problem of finding a stable matching between two equally sized sets of elements given an ordering of preferences for each element. A *matching* is a bijection from the elements of one set to the elements of the other set. A matching is *stable* when there does not exist any pair which both prefer each other to their current partner under the matching.

The Stable Matching Problem appears in many real world applications, including teacher-student matching, seller-buyer matching, and user-server matching.
<!-- TODO: add detail here -->


### Why ZKP?
Given the preferences, the Gale-Shapley algorithm is known to yield a stable matching, which has a computational complexity of $O(N^2)$, where N is the number of men (women).

Our motivation is that we do not want others to know each person's preferance and matched partner. One obvious approach is that each person first tells a trusted organizer his/her preference, and then that organizer calculates a stable matching using the GS algorithm and finally tells it to each person. However, this approach does not verify that the matching calculated by the organizer was stable. One of the participants might bribe the organizer to get a favorable matching result for himself/herself.

With zkMatching, we can verify that the matching results computed by the organizer is a stable matching for everyone's preferences. More precisely, the organizer generates a proof that the result of the computation is a stable matching for the given input, which is verified by a contract on the blockchain. In summary, the advantages of using zkMatching include the followings:

* The participants can verify that the matching result is a stable matching of their preferences.
* The preference and the matched partner of the each participant is not disclosed to other participants, under the assumption that the organizer keeps the secret.


**_NOTE:_** Ideally, the assumption about the organizer should be removed. However, that issue is technically difficult and will not be addressed in this project. However, as noted above, zkMatching can be used for other applications.



## zkMatching protocol
In describing the zkMatching process, we will explain it in terms of man-woman matching.

First, suppose there are N men and N women. Both men and women are assigned a number from 1 to N. These men and women are collectively called *participants*. In addition, there is another party called *organizer*. 

1. Each man ranks N women in order of preference
2. Each woman ranks N men in order of preference
3. Each participant share a "secret salt" (and the preference) with the organizer through some secure channel
4. Each participant commit the hash of the preference to the contract
5. The organizer computes a stable matching using GS algorithm and generate a proof
6. The organizer calls a contract to verify the proof and commit the hash of the stable matching
7. Each participant decode the hash of the stable matching using their secret salt and obtain the result


### Current limitations
* There are a circuit and a contract for each size N (Currently, N = 3, 4, 5 only) 
* Only one group can use a contract at a time

### Future challenges
* Remove the assumption on the organizer
* Use one contract for any N and multiple matching tasks
* Remove the constraint of equal numbers of men and women
* Remove the restriction that ties and truncations are not allowed on the preference list


## How to use this repository
After cloning this repository, first run the following command.

```bash
% yarn                        # install 
% yarn compile                # compile circuits and contracts
% yarn test                   # test on the compiled contracts
```

Some compiled circuit data is copied under `public/` directory.
The compiled contract data is stored under the `artifacts/contracts/` directory.



### Deploy contract (to Harmony Devnet)

Before deploying contracts, you need to create a Harmony Devnet account with ONE balance.
The private key should be set to an environment variable `privateKey0`.

You can run the following command to deploy contracts.

```bash
% node scripts/deploy-contracts.js
```

Actually, I have already executed this command and contracts have been deployed to the following addresses:

```
Matching3Factory: 0x49631065c21037F2eE8dF4fe7C54008bC66da850
Matching4Factory: 0xE994aBBd258E7EB517401F26f086097eFDe54368
Matching5Factory: 0x3fd53F4E8464aa9F1e21b8F93FDEcB6B87c558b5
```

This info is stored in `deployed-contracts/harmony-dev.json`.


### Run UI locally
UI for participants and the organizer will be launched with the following commands.

```
# Development Mode
% yarn next dev

# Production Mode
% yarn next build
% yarn next start
```

Using this UI, the following procedure is used to calculate the matching.

1. The organizer start a Matching Event on `start` page and share the generated address to the participants.
2. Each participant commits their hash of preference ranking on `submit` page.
3. The organizer registers a stable matching on `register` page.
4. Each participant checks their result on `result` page.


Currently, the UI is hosted on https://zku-final-project-izsjpbaxo-ywatanabex.vercel.app/

