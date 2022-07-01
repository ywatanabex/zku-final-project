//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./Matching3.sol";

contract Matching3Factory {
    event MatchingEventCreated(address senderAddress, address eventAddress);

    function createMatching() public returns (bool success) {
        Matching3 matching3 = new Matching3();
        emit MatchingEventCreated(msg.sender, address(matching3));
        return true;
    }
}  
