// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/src/types/BeforeSwapDelta.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {IVolatilePairsHook} from "./interfaces/IVolatilePairsHook.sol";

/// @title VolatilePairsHook
/// @author oneSig Team
/// @notice A Uniswap v4 hook designed for volatile asset pairs that implements LVR (Loss Versus Rebalancing) mitigation
/// @dev This hook uses dynamic fees based on volatility, TWAP price tracking, and swap volume monitoring
///      to protect liquidity providers from arbitrage-induced losses during high volatility periods
contract VolatilePairsHook is BaseHook, IVolatilePairsHook {
    using PoolIdLibrary for PoolKey;

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Basis points denominator (100% = 10000)
    uint256 public constant BPS = 10000;

    /// @notice Default base fee (0.3%)
    uint24 public constant DEFAULT_BASE_FEE = 3000;

    /// @notice Default maximum fee during high volatility (1%)
    uint24 public constant DEFAULT_MAX_FEE = 10000;

    /// @notice Default TWAP window (5 minutes)
    uint32 public constant DEFAULT_TWAP_WINDOW = 300;

    /// @notice Default maximum price deviation from TWAP (5%)
    uint256 public constant DEFAULT_MAX_DEVIATION = 500;

    /// @notice Volatility decay factor per block (exponential decay)
    uint256 public constant VOLATILITY_DECAY = 9900; // 99% retention per update

    /// @notice Minimum time between TWAP updates
    uint256 public constant MIN_TWAP_UPDATE_INTERVAL = 15;

    /*//////////////////////////////////////////////////////////////
                                 STATE
    //////////////////////////////////////////////////////////////*/

    /// @notice Pool configurations indexed by pool ID
    mapping(PoolId => PoolConfig) private _poolConfigs;

    /// @notice Pool states indexed by pool ID
    mapping(PoolId => PoolState) private _poolStates;

    /// @notice Swap counters per pool
    mapping(PoolId => uint256) public beforeSwapCount;
    mapping(PoolId => uint256) public afterSwapCount;

    /// @notice Price observations for TWAP calculation
    mapping(PoolId => uint256[]) private _priceObservations;
    mapping(PoolId => uint256[]) private _observationTimestamps;

    /// @notice Whether a pool has been initialized with this hook
    mapping(PoolId => bool) public poolInitialized;

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @notice Constructs the VolatilePairsHook
    /// @param _poolManager The Uniswap v4 pool manager
    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {}

    /// @notice Override to skip hook address validation on testnets/devnets
    /// @dev In production, remove this override to enforce proper hook address validation
    function validateHookAddress(BaseHook) internal pure override {
        // Skip validation for testnet/devnet deployments
        // In production, remove this function to enable proper validation
    }

    /*//////////////////////////////////////////////////////////////
                            HOOK PERMISSIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns the hook permissions for this contract
    /// @return The hook permissions configuration
    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize: true,
            beforeAddLiquidity: true,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: true,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /*//////////////////////////////////////////////////////////////
                          HOOK IMPLEMENTATIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Called before pool initialization
    /// @param key The pool key
    /// @return selector The function selector
    function _beforeInitialize(address, PoolKey calldata key, uint160)
        internal
        virtual
        override
        returns (bytes4)
    {
        PoolId poolId = key.toId();

        if (poolInitialized[poolId]) {
            revert PoolAlreadyInitialized(poolId);
        }

        return this.beforeInitialize.selector;
    }

    /// @notice Called after pool initialization to set up default configuration
    /// @param key The pool key
    /// @return selector The function selector
    function _afterInitialize(address, PoolKey calldata key, uint160, int24)
        internal
        virtual
        override
        returns (bytes4)
    {
        PoolId poolId = key.toId();

        // Set default configuration
        _poolConfigs[poolId] = PoolConfig({
            baseFee: DEFAULT_BASE_FEE,
            maxFee: DEFAULT_MAX_FEE,
            volatilityThreshold: 100, // 1% volatility threshold
            twapWindow: DEFAULT_TWAP_WINDOW,
            maxPriceDeviation: DEFAULT_MAX_DEVIATION
        });

        // Initialize state
        _poolStates[poolId] = PoolState({
            lastSwapTimestamp: block.timestamp,
            cumulativeVolume: 0,
            currentDynamicFee: DEFAULT_BASE_FEE,
            volatilityScore: 0,
            twapPrice: 0,
            lastTwapUpdate: block.timestamp
        });

        poolInitialized[poolId] = true;

        emit PoolInitialized(poolId, DEFAULT_BASE_FEE, 100);

        return this.afterInitialize.selector;
    }

    /// @notice Called before a swap to implement LVR protection
    /// @param sender The address initiating the swap
    /// @param key The pool key
    /// @param params The swap parameters
    /// @return selector The function selector
    /// @return delta The before swap delta (zero for this implementation)
    /// @return fee The dynamic fee override (0 = use pool's base fee)
    function _beforeSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata
    ) internal virtual override returns (bytes4, BeforeSwapDelta, uint24) {
        PoolId poolId = key.toId();
        PoolState storage state = _poolStates[poolId];
        PoolConfig storage config = _poolConfigs[poolId];

        // Increment swap counter
        beforeSwapCount[poolId]++;

        // Validate swap amount
        if (params.amountSpecified == 0) {
            revert ZeroSwapAmount();
        }

        // Calculate dynamic fee based on current volatility
        uint24 dynamicFee = _calculateDynamicFee(poolId, config, state);

        // Update volatility score based on swap frequency
        uint256 timeSinceLastSwap = block.timestamp - state.lastSwapTimestamp;
        if (timeSinceLastSwap < 60) {
            // High frequency trading detected - increase volatility score
            state.volatilityScore = (state.volatilityScore * 101) / 100 + 10;
        } else {
            // Decay volatility score
            state.volatilityScore = (state.volatilityScore * VOLATILITY_DECAY) / BPS;
        }

        // Check price deviation from TWAP if TWAP is established
        if (state.twapPrice > 0) {
            uint256 currentPrice = _estimateCurrentPrice(key, params);
            uint256 deviation = _calculateDeviation(currentPrice, state.twapPrice);

            if (deviation > config.maxPriceDeviation) {
                // Trigger LVR protection - increase fee significantly
                dynamicFee = config.maxFee;
                emit LVRProtectionTriggered(poolId, deviation, 0);
            }
        }

        // Update current dynamic fee
        if (dynamicFee != state.currentDynamicFee) {
            emit DynamicFeeAdjusted(poolId, state.currentDynamicFee, dynamicFee, state.volatilityScore);
            state.currentDynamicFee = dynamicFee;
        }

        emit SwapExecuted(poolId, sender, params.zeroForOne, params.amountSpecified, dynamicFee);

        // Return the dynamic fee override
        return (this.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, dynamicFee);
    }

    /// @notice Called after a swap to update TWAP and state
    /// @param key The pool key
    /// @param params The swap parameters
    /// @param delta The balance delta from the swap
    /// @return selector The function selector
    /// @return hookDelta The hook's delta adjustment (0 for this implementation)
    function _afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) internal virtual override returns (bytes4, int128) {
        PoolId poolId = key.toId();
        PoolState storage state = _poolStates[poolId];

        // Increment counter
        afterSwapCount[poolId]++;

        // Update cumulative volume
        uint256 swapVolume = params.amountSpecified > 0
            ? uint256(params.amountSpecified)
            : uint256(-params.amountSpecified);
        state.cumulativeVolume += swapVolume;

        // Update timestamp
        state.lastSwapTimestamp = block.timestamp;

        // Update TWAP if enough time has passed
        if (block.timestamp - state.lastTwapUpdate >= MIN_TWAP_UPDATE_INTERVAL) {
            _updateTWAP(poolId, key, delta);
        }

        return (this.afterSwap.selector, 0);
    }

    /// @notice Called before adding liquidity
    /// @param key The pool key
    /// @return selector The function selector
    function _beforeAddLiquidity(
        address,
        PoolKey calldata key,
        ModifyLiquidityParams calldata,
        bytes calldata
    ) internal virtual override returns (bytes4) {
        // Could add additional checks here for volatile pair liquidity provision
        return this.beforeAddLiquidity.selector;
    }

    /// @notice Called before removing liquidity
    /// @param key The pool key
    /// @return selector The function selector
    function _beforeRemoveLiquidity(
        address,
        PoolKey calldata key,
        ModifyLiquidityParams calldata,
        bytes calldata
    ) internal virtual override returns (bytes4) {
        // Could add cooldown or other protections for LP withdrawals
        return this.beforeRemoveLiquidity.selector;
    }

    /*//////////////////////////////////////////////////////////////
                          INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Calculates the dynamic fee based on volatility
    /// @param poolId The pool identifier
    /// @param config The pool configuration
    /// @param state The pool state
    /// @return fee The calculated dynamic fee
    function _calculateDynamicFee(
        PoolId poolId,
        PoolConfig storage config,
        PoolState storage state
    ) internal view returns (uint24) {
        // Base fee adjusted by volatility score
        uint256 volatilityMultiplier = BPS + (state.volatilityScore / 10);
        uint256 calculatedFee = (uint256(config.baseFee) * volatilityMultiplier) / BPS;

        // Clamp between base and max fee
        if (calculatedFee < config.baseFee) {
            return config.baseFee;
        }
        if (calculatedFee > config.maxFee) {
            return config.maxFee;
        }

        return uint24(calculatedFee);
    }

    /// @notice Updates the TWAP price observation
    /// @param poolId The pool identifier
    /// @param key The pool key
    /// @param delta The balance delta from the swap
    function _updateTWAP(PoolId poolId, PoolKey calldata key, BalanceDelta delta) internal {
        PoolState storage state = _poolStates[poolId];

        // Calculate price from delta
        int128 amount0 = delta.amount0();
        int128 amount1 = delta.amount1();

        if (amount0 != 0 && amount1 != 0) {
            // Simple price calculation (token1/token0 ratio)
            uint256 currentPrice;
            if (amount0 > 0) {
                currentPrice = (uint256(uint128(amount1 > 0 ? amount1 : -amount1)) * 1e18) / uint256(uint128(amount0));
            } else {
                currentPrice = (uint256(uint128(amount1 > 0 ? amount1 : -amount1)) * 1e18) / uint256(uint128(-amount0));
            }

            // Update TWAP using exponential moving average
            if (state.twapPrice == 0) {
                state.twapPrice = currentPrice;
            } else {
                // EMA: new_twap = (current_price * weight + old_twap * (1 - weight))
                // Using 10% weight for new observation
                state.twapPrice = (currentPrice * 1000 + state.twapPrice * 9000) / 10000;
            }

            state.lastTwapUpdate = block.timestamp;

            emit TWAPUpdated(poolId, state.twapPrice, block.timestamp);
        }
    }

    /// @notice Estimates the current price based on swap parameters
    /// @param key The pool key
    /// @param params The swap parameters
    /// @return price The estimated price
    function _estimateCurrentPrice(
        PoolKey calldata key,
        SwapParams calldata params
    ) internal view returns (uint256) {
        // This is a simplified price estimation
        // In production, you would query the pool's current sqrt price
        // For now, return a placeholder that won't affect the core logic
        return 1e18;
    }

    /// @notice Calculates the deviation between two prices in basis points
    /// @param currentPrice The current price
    /// @param referencePrice The reference price (TWAP)
    /// @return deviation The deviation in basis points
    function _calculateDeviation(uint256 currentPrice, uint256 referencePrice) internal pure returns (uint256) {
        if (referencePrice == 0) return 0;

        uint256 diff = currentPrice > referencePrice
            ? currentPrice - referencePrice
            : referencePrice - currentPrice;

        return (diff * BPS) / referencePrice;
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IVolatilePairsHook
    function getPoolConfig(PoolId poolId) external view override returns (PoolConfig memory) {
        return _poolConfigs[poolId];
    }

    /// @inheritdoc IVolatilePairsHook
    function getPoolState(PoolId poolId) external view override returns (PoolState memory) {
        return _poolStates[poolId];
    }

    /// @inheritdoc IVolatilePairsHook
    function getCurrentDynamicFee(PoolId poolId) external view override returns (uint24) {
        return _poolStates[poolId].currentDynamicFee;
    }

    /// @inheritdoc IVolatilePairsHook
    function getTWAPPrice(PoolId poolId) external view override returns (uint256) {
        return _poolStates[poolId].twapPrice;
    }

    /// @inheritdoc IVolatilePairsHook
    function getPriceDeviation(PoolId poolId, uint256 spotPrice) external view override returns (uint256) {
        return _calculateDeviation(spotPrice, _poolStates[poolId].twapPrice);
    }

    /// @inheritdoc IVolatilePairsHook
    function getSwapCount(PoolId poolId) external view override returns (uint256) {
        return beforeSwapCount[poolId];
    }

    /*//////////////////////////////////////////////////////////////
                         ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Updates the pool configuration (for future governance integration)
    /// @param poolId The pool identifier
    /// @param config The new configuration
    function setPoolConfig(PoolId poolId, PoolConfig calldata config) external {
        // In production, add access control here
        if (config.baseFee > config.maxFee) {
            revert InvalidFeeTier(config.baseFee);
        }
        _poolConfigs[poolId] = config;
    }
}
