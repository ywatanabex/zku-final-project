#!/bin/bash
set -e 

cd contracts/circuits

for N in 3 4 5
do 
    if [[ -f ../verifier${N}.sol && -f artifacts/Matching${N}/circuit_final.zkey ]]; then 
        echo "Matching${N} already compiled."
        continue 
    fi    
    mkdir -p artifacts/Matching${N}
    mkdir -p cache/

    # See https://github.com/iden3/snarkjs
    if [ -f ./cache/powersOfTau28_hez_final_14.ptau ]; then
        echo "powersOfTau28_hez_final_14.ptau already exists. Skipping."
    else
        echo 'Downloading powersOfTau28_hez_final_14.ptau'
        wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau --directory-prefix=cache/
    fi

    echo "Compiling Matching${N}.circom..."

    # compile circuit
    circom Matching${N}.circom --r1cs --wasm --sym -o artifacts/Matching${N}
    snarkjs r1cs info artifacts/Matching${N}/Matching${N}.r1cs

    # Start a new zkey and make a contribution
    snarkjs groth16 setup artifacts/Matching${N}/Matching${N}.r1cs cache/powersOfTau28_hez_final_14.ptau artifacts/Matching${N}/circuit_0000.zkey
    snarkjs zkey contribute artifacts/Matching${N}/circuit_0000.zkey artifacts/Matching${N}/circuit_final.zkey --name="ywatanabex" -v -e="random text for matching ${N}"
    snarkjs zkey export verificationkey artifacts/Matching${N}/circuit_final.zkey artifacts/Matching${N}/verification_key.json

    # generate solidity contract
    snarkjs zkey export solidityverifier artifacts/Matching${N}/circuit_final.zkey ../verifier${N}.sol

    echo "Matching${N} completed."
done 

cd ../..