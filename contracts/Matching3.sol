//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./verifier3.sol";

contract Matching3 is Verifier {  
    uint constant N = 3;
    address public owner;
    uint public counter;              // initialized with 0
    uint[2*N] public matchingHash;    // initialized with 0
    uint[2*N] public scoreHash;       // initialized with 0
    address[2*N] public committer;    // initialized with address(0)
    bool public registered;           // initialized with false
    bytes32 public publicKey;
    bytes32[2*N] public ephemPublicKey; 
    bytes24[2*N] public nonce;
    bytes32[2*N] public encryptedSalt1;
    bytes28[2*N] public encryptedSalt2;

   
    event Register(uint counter);

    constructor() {
        owner = tx.origin; 
    }
    
    function setPublicKey(bytes32 _publicKey) public {
        assert(msg.sender == owner);
        publicKey = _publicKey;
    }

    function setEncryptedSalt(uint uid, bytes32 _ephemPublicKey, bytes24 _nonce, bytes32 _encryptedSalt1, bytes28 _encryptedSalt2) public {
        assert(msg.sender == committer[uid]);
        ephemPublicKey[uid] = _ephemPublicKey;
        nonce[uid] = _nonce;
        encryptedSalt1[uid] = _encryptedSalt1;
        encryptedSalt2[uid] = _encryptedSalt2;
    }

    // committed scoreHash is not modifieable
    function commitScoreHash(uint uid, uint sHash) public {
        assert(committer[uid] == address(0));
        committer[uid] = msg.sender;
        scoreHash[uid] = sHash;
    }

    function commitScoreHashAndSetEncryptedSalt(uint uid, uint sHash, bytes32 _ephemPublicKey, bytes24 _nonce, bytes32 _encryptedSalt1, bytes28 _encryptedSalt2) public {
        commitScoreHash(uid, sHash);
        setEncryptedSalt(uid, _ephemPublicKey, _nonce, _encryptedSalt1, _encryptedSalt2);
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

    // Reset all state variables (except for owner, counter, and publicKey)
    function reset() public {
        assert(msg.sender == owner);
        for (uint i = 0; i < 2*N; i++) {
            matchingHash[i] = 0;
            scoreHash[i] = 0;
            committer[i] = address(0);
            ephemPublicKey[i] = 0;
            nonce[i] = 0;
            encryptedSalt1[i] = 0;
            encryptedSalt2[i] = 0;
        }
        registered = false;
        counter += 1;
    }

}
