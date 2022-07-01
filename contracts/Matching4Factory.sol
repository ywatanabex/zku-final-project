//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./Matching4.sol";

contract Matching4Factory {
    event MatchingEventCreated(address senderAddress, address eventAddress);

    function createMatching() public returns (bool success) {
        Matching4 matching4 = new Matching4();
        emit MatchingEventCreated(msg.sender, address(matching4));
        return true;
    }
}  
