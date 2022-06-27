#!/bin/bash
set -e 

cd contracts/circuits

for N in 3 4 5
do 
    mkdir -p ../../public/Matching${N}/Matching${N}_js
    cp Matching${N}/circuit_final.zkey ../../public/Matching${N}/circuit_final.zkey
    cp Matching${N}/Matching${N}_js/Matching${N}.wasm ../../public/Matching${N}/Matching${N}_js/Matching${N}.wasm
done 

cd ../..