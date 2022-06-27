//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./verifier4.sol";

contract Matching4 is Verifier {  
    uint constant N = 4;
    uint public counter;              // initialized with 0
    uint[2*N] public matchingHash;    // initialized with 0
    uint[2*N] public scoreHash;       // initialized with 0
    address[2*N] public committer;    // initialized with address(0)
    bool public registered;           // initialized with false
   
    event Register(uint counter);
    
    // committed scoreHash is not modifieable
    function commitScoreHash(uint uid, uint sHash) public {
        assert(committer[uid] == address(0));
        committer[uid] = msg.sender;
        scoreHash[uid] = sHash;
    }

    function register(
            uint[2] memory a,
            uint[2][2] memory b,
            uint[2] memory c,
            uint[4*N] memory input
        ) public returns (bool) {

        // Check scoreHash is the same as the committed values 
        for (uint i = 0; i < 2*N; i++) {
            if (scoreHash[i] != input[2*N + i]) {
                return false;
            }
        }   

        if ( verifyProof(a, b, c, input) ) {
            for (uint i = 0; i < 2*N; i++) {
                matchingHash[i] = input[i];
            } 
            registered = true;
            emit Register(counter);
            return true;
        } else {
            return false;
        }        
    }

    // Reset all state variables
    function reset() public {
        for (uint i = 0; i < 2*N; i++) {
            matchingHash[i] = 0;
            scoreHash[i] = 0;
            committer[i] = address(0);
        }
        registered = false;
        counter += 1;
    }

}
