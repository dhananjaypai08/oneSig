// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {VolatilePairsHook} from "../src/VolatilePairsHook.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";

/// @title DeployVolatilePairsHook
/// @author oneSig Team
/// @notice Deployment script for the VolatilePairsHook on Tenderly devnets
/// @dev This script deploys the hook to the specified network using CREATE2 for deterministic addresses
contract DeployVolatilePairsHook is Script {
    /// @notice Known PoolManager addresses on different chains
    /// @dev These addresses are for Tenderly devnets forked from mainnet L2s
    address constant ARBITRUM_POOL_MANAGER = 0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32;
    address constant BASE_POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    address constant OPTIMISM_POOL_MANAGER = 0x9a13F98Cb987694C9F086b1F5eB990EeA8264Ec3;

    /// @notice Deployer address (CREATE2 factory)
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    /// @notice Hook flags for VolatilePairsHook
    uint160 constant HOOK_FLAGS = uint160(
        Hooks.BEFORE_INITIALIZE_FLAG |
        Hooks.AFTER_INITIALIZE_FLAG |
        Hooks.BEFORE_ADD_LIQUIDITY_FLAG |
        Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG |
        Hooks.BEFORE_SWAP_FLAG |
        Hooks.AFTER_SWAP_FLAG
    );

    function run() external {
        // Get chain ID to determine which PoolManager to use
        uint256 chainId = block.chainid;
        address poolManager;

        if (chainId == 42161) {
            // Arbitrum
            poolManager = ARBITRUM_POOL_MANAGER;
            console.log("Deploying to Arbitrum devnet...");
        } else if (chainId == 8453) {
            // Base
            poolManager = BASE_POOL_MANAGER;
            console.log("Deploying to Base devnet...");
        } else if (chainId == 10) {
            // Optimism
            poolManager = OPTIMISM_POOL_MANAGER;
            console.log("Deploying to Optimism devnet...");
        } else {
            // Default to provided pool manager or Arbitrum
            poolManager = ARBITRUM_POOL_MANAGER;
            console.log("Using default Arbitrum PoolManager...");
        }

        console.log("PoolManager address:", poolManager);

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy the hook
        VolatilePairsHook hook = new VolatilePairsHook(IPoolManager(poolManager));

        console.log("VolatilePairsHook deployed at:", address(hook));
        console.log("Deployment complete!");

        vm.stopBroadcast();
    }

    /// @notice Deploy with a specific salt to get a deterministic address with correct hook flags
    /// @dev Uses HookMiner to find a salt that produces an address with the required hook flags
    function runWithHookMiner() external {
        uint256 chainId = block.chainid;
        address poolManager;

        if (chainId == 42161) {
            poolManager = ARBITRUM_POOL_MANAGER;
        } else if (chainId == 8453) {
            poolManager = BASE_POOL_MANAGER;
        } else if (chainId == 10) {
            poolManager = OPTIMISM_POOL_MANAGER;
        } else {
            poolManager = ARBITRUM_POOL_MANAGER;
        }

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Find a salt that will produce an address with the correct hook flags
        bytes memory constructorArgs = abi.encode(poolManager);
        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            HOOK_FLAGS,
            type(VolatilePairsHook).creationCode,
            constructorArgs
        );

        console.log("Found hook address:", hookAddress);
        console.log("Using salt:", uint256(salt));

        vm.startBroadcast(deployerPrivateKey);

        // Deploy using CREATE2 with the found salt
        VolatilePairsHook hook = new VolatilePairsHook{salt: salt}(IPoolManager(poolManager));

        require(address(hook) == hookAddress, "Hook address mismatch");

        console.log("VolatilePairsHook deployed at:", address(hook));

        vm.stopBroadcast();
    }
}

/// @title DeployToAllNetworks
/// @notice Helper script to output deployment commands for all networks
contract DeployToAllNetworks is Script {
    function run() external pure {
        console.log("=== Deployment Commands for Tenderly Devnets ===");
        console.log("");
        console.log("1. Arbitrum Devnet:");
        console.log("   forge script script/VolatilePairsHook.s.sol:DeployVolatilePairsHook --rpc-url eil-arb --broadcast");
        console.log("");
        console.log("2. Base Devnet:");
        console.log("   forge script script/VolatilePairsHook.s.sol:DeployVolatilePairsHook --rpc-url eil-base --broadcast");
        console.log("");
        console.log("3. Optimism Devnet:");
        console.log("   forge script script/VolatilePairsHook.s.sol:DeployVolatilePairsHook --rpc-url eil-op --broadcast");
    }
}
