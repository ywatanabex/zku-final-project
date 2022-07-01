#!/bin/bash
set -e 

cd contracts/circuits

for N in 3 4 5
do 
    mkdir -p ../../public/artifacts/Matching${N}/Matching${N}_js
    cp artifacts/Matching${N}/circuit_final.zkey ../../public/artifacts/Matching${N}/circuit_final.zkey
    cp artifacts/Matching${N}/Matching${N}_js/Matching${N}.wasm ../../public/artifacts/Matching${N}/Matching${N}_js/Matching${N}.wasm
done 

cd ../..