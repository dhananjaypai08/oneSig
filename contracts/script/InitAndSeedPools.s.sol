// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "forge-std/console.sol";
// import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

contract InitAndSeedPools is Script {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    struct ModifyLiquidityParams {
        int24 tickLower;
        int24 tickUpper;
        int128 liquidityDelta;
        bytes32 salt;
    }

    // Minimal subset of IPoolManager used by this script
    interface IPoolManager {
        function initialize(PoolKey calldata key, uint160 sqrtPriceX96) external returns (int24 tick);
        function modifyLiquidity(PoolKey calldata key, ModifyLiquidityParams calldata params, bytes calldata hookData)
            external
            returns (int256 callerDelta, int256 feesAccrued);
    }

    function run() external {
        // You can change these by passing CLI flags (see above) or editing constants.
        address poolManagerAddr = vm.envAddress("POOL_MANAGER"); 
        address hookAddr = vm.envAddress("HOOK"); 
        address token0 = vm.envAddress("TOKEN0");
        address token1 = vm.envAddress("TOKEN1"); 

        uint24 fee = uint24(vm.envUint("FEE")); // e.g. 3000 (0.3%)
        int24 tickSpacing = int24(int(vm.envInt("TICK_SPACING"))); // e.g. 60

        // sqrtPriceX96: starting Q64.96 sqrt price. Example for 1:1 use 2**96 = 79228162514264337593543950336
        uint160 sqrtPriceX96 = uint160(vm.envUint("SQRT_PRICE_X96"));

        int24 tickLower = int24(int(vm.envInt("TICK_LOWER")));
        int24 tickUpper = int24(int(vm.envInt("TICK_UPPER")));
        int128 liquidityDelta = int128(int(vm.envInt("LIQUIDITY_DELTA"))); // e.g. 1e18

        if (poolManagerAddr == address(0)) revert("POOL_MANAGER env var required");
        if (token0 == address(0) || token1 == address(0)) revert("TOKEN0 and TOKEN1 env vars required");
        if (hookAddr == address(0)) {
            // allow zero hook address if you don't use hooks
            hookAddr = address(0);
        }
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(privateKey);

        IPoolManager pm = IPoolManager(poolManagerAddr);

        PoolKey memory key = PoolKey({
            currency0: token0,
            currency1: token1,
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: hookAddr
        });

        // 1) Try to initialize pool (safe to call even if already initialized)
        bool initialized = false;
        // We wrap in try/catch to handle "already initialized" or other reverts gracefully.
        try pm.initialize(key, sqrtPriceX96) returns (int24 tick) {
            console.log("initialize() succeeded, returned initial tick:", int256(tick));
            initialized = true;
        } catch (bytes memory reason) {
            // decode revert reason if possible
            // Common case: PoolNotInitialized / PoolAlreadyInitialized etc.
            console.log("initialize() reverted (may already be initialized).");
            // Optionally: inspect reason as string
            if (reason.length > 0) {
                // try to decode as string (not guaranteed)
                // safe decode:
                string memory s = string(reason);
                console.log("revert reason:", s);
            }
        }

        // 2) Seed initial liquidity (idempotent-ish if you pick an appropriate salt)
        // If you want this step to be optional, you can add a flag/env var to skip.
        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidityDelta: liquidityDelta,
            salt: keccak256(abi.encodePacked(block.chainid, token0, token1, fee, tickLower, tickUpper))
        });

        try pm.modifyLiquidity(key, params, "") returns (int256 callerDelta, int256 feesAccrued) {
            console.log("modifyLiquidity succeeded -> callerDelta:", callerDelta, " feesAccrued:", feesAccrued);
        } catch (bytes memory reason) {
            console.log("modifyLiquidity reverted.");
            if (reason.length > 0) {
                string memory s = string(reason);
                console.log("revert reason:", s);
            }
        }

        vm.stopBroadcast();
    }
}
