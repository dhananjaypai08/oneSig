// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script} from "forge-std/Script.sol";
import { Simple7702Account } from "@account-abstraction/accounts/Simple7702Account.sol";
import { IEntryPoint } from "@account-abstraction/interfaces/IEntryPoint.sol";

contract Simple7702AccountScript is Script {
    Simple7702Account public simple7702Account;

    function setUp() public {}

    function run() public {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        // address ENTRY_POINT = vm.envAddress("ENTRY_POINT");
        // IEntryPoint newEntryPoint = IEntryPoint(ENTRY_POINT);
        vm.startBroadcast(privateKey);

        simple7702Account = new Simple7702Account();

        vm.stopBroadcast();
    }
}
