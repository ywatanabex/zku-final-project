#!/bin/bash
set -e 

# Circuit build artifacts
if ls contracts/verifier*.sol 1> /dev/null 2>&1; then
    rm contracts/verifier*.sol
    echo "contracts/verifier*.sol are removed"
fi
if [[ -d "contracts/circuits/artifacts/" ]]; then 
    rm -r contracts/circuits/artifacts/
    echo "contracts/circuits/artifacts/ directory is removed"
fi 
if [[ -d "contracts/circuits/cache/" ]]; then 
    rm -r contracts/circuits/cache/
    echo "contracts/circuits/cache/ directory is removed"
fi 

# Contract build artifacts
if [[ -d "cache/" ]]; then 
    rm -r cache/
    echo "cache/ directory is removed"
fi 

if [[ -d "artifacts/" ]]; then 
    rm -r artifacts/
    echo "artifacts/ directory is removed"
fi    

if [[ -d "public/artifacts/" ]]; then 
    rm -r public/artifacts/
    echo "public/artifacts/ directory is removed"
fi  