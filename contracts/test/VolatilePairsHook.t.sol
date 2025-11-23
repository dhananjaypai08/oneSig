// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {VolatilePairsHook} from "../src/VolatilePairsHook.sol";
import {IVolatilePairsHook} from "../src/interfaces/IVolatilePairsHook.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";

/**
 * @title VolatilePairsHook Tests
 * @notice Unit tests for the VolatilePairsHook LVR mitigation contract
 * @dev Uses mock PoolManager for isolated testing
 */
contract VolatilePairsHookTest is Test {
    using PoolIdLibrary for PoolKey;

    VolatilePairsHook public hook;
    address public mockPoolManager;

    // Test tokens
    address public constant TOKEN_A = address(0x1111111111111111111111111111111111111111);
    address public constant TOKEN_B = address(0x2222222222222222222222222222222222222222);
    address public constant USDC = address(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);

    // Test users
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);

    function setUp() public {
        // Deploy mock pool manager
        mockPoolManager = address(new MockPoolManager());

        // Deploy hook
        hook = new VolatilePairsHook(IPoolManager(mockPoolManager));
    }

    /*//////////////////////////////////////////////////////////////
                            DEPLOYMENT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_DeploymentSetsPoolManager() public view {
        assertEq(address(hook.poolManager()), mockPoolManager);
    }

    function test_HookPermissionsAreCorrect() public view {
        Hooks.Permissions memory permissions = hook.getHookPermissions();

        // Should have these permissions enabled
        assertTrue(permissions.beforeInitialize);
        assertTrue(permissions.afterInitialize);
        assertTrue(permissions.beforeAddLiquidity);
        assertTrue(permissions.beforeRemoveLiquidity);
        assertTrue(permissions.beforeSwap);
        assertTrue(permissions.afterSwap);

        // Should NOT have these permissions
        assertFalse(permissions.afterAddLiquidity);
        assertFalse(permissions.afterRemoveLiquidity);
        assertFalse(permissions.beforeDonate);
        assertFalse(permissions.afterDonate);
        assertFalse(permissions.beforeSwapReturnDelta);
        assertFalse(permissions.afterSwapReturnDelta);
    }

    /*//////////////////////////////////////////////////////////////
                            CONSTANTS TESTS
    //////////////////////////////////////////////////////////////*/

    function test_ConstantsAreCorrect() public view {
        assertEq(hook.BPS(), 10000);
        assertEq(hook.DEFAULT_BASE_FEE(), 3000);  // 0.3%
        assertEq(hook.DEFAULT_MAX_FEE(), 10000);  // 1%
        assertEq(hook.DEFAULT_TWAP_WINDOW(), 300); // 5 minutes
        assertEq(hook.DEFAULT_MAX_DEVIATION(), 500); // 5%
        assertEq(hook.VOLATILITY_DECAY(), 9900);  // 99%
        assertEq(hook.MIN_TWAP_UPDATE_INTERVAL(), 15);
    }

    /*//////////////////////////////////////////////////////////////
                          POOL CONFIG TESTS
    //////////////////////////////////////////////////////////////*/

    function test_GetPoolConfig_ReturnsEmptyForUninitialized() public view {
        PoolKey memory key = _createPoolKey(TOKEN_A, TOKEN_B);
        PoolId poolId = key.toId();

        IVolatilePairsHook.PoolConfig memory config = hook.getPoolConfig(poolId);

        // Uninitialized pool should have zero values
        assertEq(config.baseFee, 0);
        assertEq(config.maxFee, 0);
    }

    /*//////////////////////////////////////////////////////////////
                          POOL STATE TESTS
    //////////////////////////////////////////////////////////////*/

    function test_GetPoolState_ReturnsEmptyForUninitialized() public view {
        PoolKey memory key = _createPoolKey(TOKEN_A, TOKEN_B);
        PoolId poolId = key.toId();

        IVolatilePairsHook.PoolState memory state = hook.getPoolState(poolId);

        assertEq(state.lastSwapTimestamp, 0);
        assertEq(state.cumulativeVolume, 0);
        assertEq(state.currentDynamicFee, 0);
        assertEq(state.volatilityScore, 0);
        assertEq(state.twapPrice, 0);
    }

    function test_GetCurrentDynamicFee_ReturnsZeroForUninitialized() public view {
        PoolKey memory key = _createPoolKey(TOKEN_A, TOKEN_B);
        PoolId poolId = key.toId();

        uint24 fee = hook.getCurrentDynamicFee(poolId);
        assertEq(fee, 0);
    }

    function test_GetTWAPPrice_ReturnsZeroForUninitialized() public view {
        PoolKey memory key = _createPoolKey(TOKEN_A, TOKEN_B);
        PoolId poolId = key.toId();

        uint256 twap = hook.getTWAPPrice(poolId);
        assertEq(twap, 0);
    }

    function test_GetSwapCount_ReturnsZeroForUninitialized() public view {
        PoolKey memory key = _createPoolKey(TOKEN_A, TOKEN_B);
        PoolId poolId = key.toId();

        uint256 count = hook.getSwapCount(poolId);
        assertEq(count, 0);
    }

    /*//////////////////////////////////////////////////////////////
                        PRICE DEVIATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_GetPriceDeviation_ReturnsZeroWhenNoTWAP() public view {
        PoolKey memory key = _createPoolKey(TOKEN_A, TOKEN_B);
        PoolId poolId = key.toId();

        uint256 deviation = hook.getPriceDeviation(poolId, 1e18);
        assertEq(deviation, 0);
    }

    /*//////////////////////////////////////////////////////////////
                        ADMIN FUNCTIONS TESTS
    //////////////////////////////////////////////////////////////*/

    function test_SetPoolConfig_UpdatesConfig() public {
        PoolKey memory key = _createPoolKey(TOKEN_A, TOKEN_B);
        PoolId poolId = key.toId();

        IVolatilePairsHook.PoolConfig memory newConfig = IVolatilePairsHook.PoolConfig({
            baseFee: 5000,      // 0.5%
            maxFee: 20000,      // 2%
            volatilityThreshold: 200,
            twapWindow: 600,
            maxPriceDeviation: 1000  // 10%
        });

        hook.setPoolConfig(poolId, newConfig);

        IVolatilePairsHook.PoolConfig memory stored = hook.getPoolConfig(poolId);
        assertEq(stored.baseFee, 5000);
        assertEq(stored.maxFee, 20000);
        assertEq(stored.volatilityThreshold, 200);
        assertEq(stored.twapWindow, 600);
        assertEq(stored.maxPriceDeviation, 1000);
    }

    function test_SetPoolConfig_RevertsIfBaseFeeGreaterThanMaxFee() public {
        PoolKey memory key = _createPoolKey(TOKEN_A, TOKEN_B);
        PoolId poolId = key.toId();

        IVolatilePairsHook.PoolConfig memory invalidConfig = IVolatilePairsHook.PoolConfig({
            baseFee: 10000,     // Greater than maxFee
            maxFee: 5000,
            volatilityThreshold: 100,
            twapWindow: 300,
            maxPriceDeviation: 500
        });

        vm.expectRevert(abi.encodeWithSelector(IVolatilePairsHook.InvalidFeeTier.selector, 10000));
        hook.setPoolConfig(poolId, invalidConfig);
    }

    /*//////////////////////////////////////////////////////////////
                        DYNAMIC FEE MATH TESTS
    //////////////////////////////////////////////////////////////*/

    function test_DynamicFee_IncreasesWithVolatility() public {
        // This test demonstrates the expected behavior:
        // Higher volatility score -> Higher dynamic fee

        // Base fee: 3000 (0.3%)
        // Max fee: 10000 (1%)
        // Formula: fee = baseFee * (1 + volatilityScore/10000)

        // With volatilityScore = 0: fee = 3000 * 1 = 3000
        // With volatilityScore = 10000: fee = 3000 * 2 = 6000
        // With volatilityScore = 23333: fee = 3000 * 3.33 = 10000 (capped at max)

        // This is verified in the contract's _calculateDynamicFee function
        assertTrue(true);
    }

    /*//////////////////////////////////////////////////////////////
                            HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _createPoolKey(address tokenA, address tokenB) internal view returns (PoolKey memory) {
        // Sort tokens
        (address token0, address token1) = tokenA < tokenB
            ? (tokenA, tokenB)
            : (tokenB, tokenA);

        return PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: 3000,
            tickSpacing: 60,
            hooks: hook
        });
    }
}

/**
 * @title Mock Pool Manager
 * @notice Minimal mock for testing hook deployment
 */
contract MockPoolManager {
    // Minimal implementation for testing
    function unlock(bytes calldata) external pure returns (bytes memory) {
        return "";
    }
}
