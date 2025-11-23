// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId} from "v4-core/src/types/PoolId.sol";

/// @title IVolatilePairsHook
/// @author oneSig Team
/// @notice Interface for the Volatile Pairs Hook that mitigates LVR for volatile asset pairs
/// @dev This hook implements dynamic fees, TWAP-based price protection, and swap volume tracking
interface IVolatilePairsHook {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @notice Thrown when the price deviation exceeds the maximum allowed threshold
    /// @param currentDeviation The actual price deviation in basis points
    /// @param maxDeviation The maximum allowed deviation in basis points
    error ExcessivePriceDeviation(uint256 currentDeviation, uint256 maxDeviation);

    /// @notice Thrown when attempting to swap with zero amount
    error ZeroSwapAmount();

    /// @notice Thrown when the pool has insufficient liquidity for the swap
    error InsufficientLiquidity();

    /// @notice Thrown when the caller is not authorized to perform the action
    error Unauthorized();

    /// @notice Thrown when trying to initialize an already initialized pool
    /// @param poolId The ID of the pool that was already initialized
    error PoolAlreadyInitialized(PoolId poolId);

    /// @notice Thrown when the cooldown period has not elapsed
    /// @param timeRemaining The time remaining in seconds until cooldown ends
    error CooldownNotElapsed(uint256 timeRemaining);

    /// @notice Thrown when an invalid fee tier is specified
    /// @param fee The invalid fee value
    error InvalidFeeTier(uint24 fee);

    /// @notice Thrown when TWAP oracle data is stale
    /// @param lastUpdate The timestamp of the last update
    /// @param currentTime The current block timestamp
    error StaleTWAPData(uint256 lastUpdate, uint256 currentTime);

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when a pool is initialized with the hook
    /// @param poolId The unique identifier of the pool
    /// @param baseFee The base fee for the pool in basis points
    /// @param volatilityThreshold The volatility threshold for dynamic fee adjustments
    event PoolInitialized(
        PoolId indexed poolId,
        uint24 baseFee,
        uint256 volatilityThreshold
    );

    /// @notice Emitted when a swap is executed through the hook
    /// @param poolId The unique identifier of the pool
    /// @param sender The address initiating the swap
    /// @param zeroForOne Direction of the swap (true = token0 -> token1)
    /// @param amountSpecified The amount specified for the swap
    /// @param dynamicFee The dynamic fee applied to this swap in basis points
    event SwapExecuted(
        PoolId indexed poolId,
        address indexed sender,
        bool zeroForOne,
        int256 amountSpecified,
        uint24 dynamicFee
    );

    /// @notice Emitted when the dynamic fee is adjusted based on volatility
    /// @param poolId The unique identifier of the pool
    /// @param oldFee The previous fee in basis points
    /// @param newFee The new fee in basis points
    /// @param volatilityScore The volatility score that triggered the adjustment
    event DynamicFeeAdjusted(
        PoolId indexed poolId,
        uint24 oldFee,
        uint24 newFee,
        uint256 volatilityScore
    );

    /// @notice Emitted when TWAP is updated for a pool
    /// @param poolId The unique identifier of the pool
    /// @param twapPrice The new TWAP price
    /// @param timestamp The timestamp of the update
    event TWAPUpdated(
        PoolId indexed poolId,
        uint256 twapPrice,
        uint256 timestamp
    );

    /// @notice Emitted when LVR protection is triggered
    /// @param poolId The unique identifier of the pool
    /// @param priceDeviation The detected price deviation in basis points
    /// @param action The protection action taken (0 = fee increase, 1 = swap delayed, 2 = swap blocked)
    event LVRProtectionTriggered(
        PoolId indexed poolId,
        uint256 priceDeviation,
        uint8 action
    );

    /// @notice Emitted when liquidity is added to a volatile pair pool
    /// @param poolId The unique identifier of the pool
    /// @param provider The address providing liquidity
    /// @param amount0 The amount of token0 added
    /// @param amount1 The amount of token1 added
    event LiquidityAdded(
        PoolId indexed poolId,
        address indexed provider,
        uint256 amount0,
        uint256 amount1
    );

    /// @notice Emitted when liquidity is removed from a volatile pair pool
    /// @param poolId The unique identifier of the pool
    /// @param provider The address removing liquidity
    /// @param amount0 The amount of token0 removed
    /// @param amount1 The amount of token1 removed
    event LiquidityRemoved(
        PoolId indexed poolId,
        address indexed provider,
        uint256 amount0,
        uint256 amount1
    );

    /*//////////////////////////////////////////////////////////////
                                 STRUCTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Configuration parameters for a volatile pair pool
    /// @param baseFee The base fee in basis points (e.g., 3000 = 0.3%)
    /// @param maxFee The maximum fee that can be applied during high volatility
    /// @param volatilityThreshold The threshold for triggering dynamic fee adjustments
    /// @param twapWindow The time window for TWAP calculations in seconds
    /// @param maxPriceDeviation Maximum allowed price deviation from TWAP in basis points
    struct PoolConfig {
        uint24 baseFee;
        uint24 maxFee;
        uint256 volatilityThreshold;
        uint32 twapWindow;
        uint256 maxPriceDeviation;
    }

    /// @notice State data for a volatile pair pool
    /// @param lastSwapTimestamp The timestamp of the last swap
    /// @param cumulativeVolume The cumulative swap volume
    /// @param currentDynamicFee The current dynamic fee being applied
    /// @param volatilityScore The current volatility score
    /// @param twapPrice The current TWAP price
    /// @param lastTwapUpdate The timestamp of the last TWAP update
    struct PoolState {
        uint256 lastSwapTimestamp;
        uint256 cumulativeVolume;
        uint24 currentDynamicFee;
        uint256 volatilityScore;
        uint256 twapPrice;
        uint256 lastTwapUpdate;
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns the configuration for a specific pool
    /// @param poolId The unique identifier of the pool
    /// @return config The pool configuration
    function getPoolConfig(PoolId poolId) external view returns (PoolConfig memory config);

    /// @notice Returns the current state for a specific pool
    /// @param poolId The unique identifier of the pool
    /// @return state The pool state
    function getPoolState(PoolId poolId) external view returns (PoolState memory state);

    /// @notice Calculates the current dynamic fee for a pool based on volatility
    /// @param poolId The unique identifier of the pool
    /// @return fee The current dynamic fee in basis points
    function getCurrentDynamicFee(PoolId poolId) external view returns (uint24 fee);

    /// @notice Returns the current TWAP price for a pool
    /// @param poolId The unique identifier of the pool
    /// @return price The TWAP price
    function getTWAPPrice(PoolId poolId) external view returns (uint256 price);

    /// @notice Calculates the price deviation from TWAP
    /// @param poolId The unique identifier of the pool
    /// @param spotPrice The current spot price to compare
    /// @return deviation The price deviation in basis points
    function getPriceDeviation(PoolId poolId, uint256 spotPrice) external view returns (uint256 deviation);

    /// @notice Returns the total number of swaps for a pool
    /// @param poolId The unique identifier of the pool
    /// @return count The total swap count
    function getSwapCount(PoolId poolId) external view returns (uint256 count);
}
