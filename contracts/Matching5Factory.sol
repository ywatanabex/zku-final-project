//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./Matching5.sol";

contract Matching5Factory {
    event MatchingEventCreated(address senderAddress, address eventAddress);

    function createMatching() public returns (bool success) {
        Matching5 matching5 = new Matching5();
        emit MatchingEventCreated(msg.sender, address(matching5));
        return true;
    }
}  
