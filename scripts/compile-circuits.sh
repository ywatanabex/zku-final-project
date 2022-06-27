#!/bin/bash
set -e 

cd contracts/circuits

for N in 3 4 5
do 
    if [[ -f ../verifier${N}.sol && -f Matching${N}/circuit_final.zkey ]]; then 
        echo "Matching${N} already compiled."
        continue 
    fi    
    mkdir -p Matching${N}

    # See https://github.com/iden3/snarkjs
    if [ -f ./powersOfTau28_hez_final_14.ptau ]; then
        echo "powersOfTau28_hez_final_14.ptau already exists. Skipping."
    else
        echo 'Downloading powersOfTau28_hez_final_14.ptau'
        wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_14.ptau
    fi

    echo "Compiling Matching${N}.circom..."

    # compile circuit
    circom Matching${N}.circom --r1cs --wasm --sym -o Matching${N}
    snarkjs r1cs info Matching${N}/Matching${N}.r1cs

    # Start a new zkey and make a contribution
    snarkjs groth16 setup Matching${N}/Matching${N}.r1cs powersOfTau28_hez_final_14.ptau Matching${N}/circuit_0000.zkey
    snarkjs zkey contribute Matching${N}/circuit_0000.zkey Matching${N}/circuit_final.zkey --name="ywatanabex" -v -e="random text for matching ${N}"
    snarkjs zkey export verificationkey Matching${N}/circuit_final.zkey Matching${N}/verification_key.json

    # generate solidity contract
    snarkjs zkey export solidityverifier Matching${N}/circuit_final.zkey ../verifier${N}.sol

    echo "Matching${N} completed."
done 

cd ../..