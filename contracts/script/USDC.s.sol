// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/USDC.sol";

contract DeployMockERC20 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        USDC token = new USDC(
            "USD Coin",
            "USDC",
            1_000_000 ether
        );

        vm.stopBroadcast();

        console.log("USDC deployed at:", address(token));
    }
}
