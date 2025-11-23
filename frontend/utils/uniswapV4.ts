import { encodeFunctionData, encodeAbiParameters, concat, keccak256, type Address, type Hex } from 'viem'

/**
 * Uniswap V4 Integration for oneSig
 *
 * V4 uses a singleton PoolManager pattern with hooks for customizable pool behavior.
 * Swaps are executed through the UniversalRouter which encodes actions and parameters.
 *
 * Key differences from V3:
 * - Singleton PoolManager (all pools in one contract)
 * - Hooks allow custom logic at various points in the swap lifecycle
 * - Flash accounting reduces gas by settling at the end
 * - Native ETH support (no WETH wrapping required)
 */

// Uniswap V4 PoolManager addresses (deployed on mainnet L2s)
export const POOL_MANAGER_ADDRESSES: Record<number, Address> = {
  42161: '0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32', // Arbitrum
  8453: '0x498581fF718922c3f8e6A244956aF099B2652b2b',  // Base
  10: '0x9a13F98Cb987694C9F086b1F5eB990EeA8264Ec3',    // Optimism
}

// UniversalRouter addresses
export const UNIVERSAL_ROUTER_ADDRESSES: Record<number, Address> = {
  42161: '0xa51afafe0263b40edaef0df8781ea9aa03e381a3', // Arbitrum
  8453: '0x6fF5693b99212Da76ad316178A184AB56D299b43',  // Base
  10: '0x851116D9223fabED8E56C0E6b8Ad0c31d98B3507',    // Optimism
}

// VolatilePairsHook addresses (deployed on Tenderly devnets)
export const VOLATILE_PAIRS_HOOK_ADDRESSES: Record<number, Address> = {
  42161: '0x8EF76ebf2988346FBc599E7581E5573550381b6D', // Arbitrum
  8453: '0xBFc8eEB7171e49DCc821D0317450Ca8F3ca55Acd',  // Base
  10: '0x8EF76ebf2988346FBc599E7581E5573550381b6D',    // Optimism
}

// V4 Universal Router command types
export const V4_COMMANDS = {
  V4_SWAP: 0x10,
  PERMIT2_PERMIT: 0x0a,
  PERMIT2_TRANSFER_FROM: 0x0b,
  WRAP_ETH: 0x0c,
  UNWRAP_WETH: 0x0d,
  SWEEP: 0x04,
} as const

// V4 Router Actions (used inside V4_SWAP command)
export const V4_ACTIONS = {
  SWAP_EXACT_IN_SINGLE: 0x06,
  SWAP_EXACT_IN: 0x07,
  SWAP_EXACT_OUT_SINGLE: 0x08,
  SWAP_EXACT_OUT: 0x09,
  SETTLE_ALL: 0x10,
  SETTLE: 0x11,
  TAKE_ALL: 0x12,
  TAKE: 0x13,
  TAKE_PORTION: 0x14,
} as const

// Pool key structure for V4
export interface PoolKey {
  currency0: Address
  currency1: Address
  fee: number
  tickSpacing: number
  hooks: Address
}

// Swap params for V4
export interface V4SwapParams {
  poolKey: PoolKey
  zeroForOne: boolean
  amountSpecified: bigint
  sqrtPriceLimitX96: bigint
}

// V4 PoolManager ABI (partial)
export const POOL_MANAGER_ABI = [
  {
    name: 'swap',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'key',
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      },
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'zeroForOne', type: 'bool' },
          { name: 'amountSpecified', type: 'int256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
      },
      { name: 'hookData', type: 'bytes' },
    ],
    outputs: [{ name: 'delta', type: 'int256' }],
  },
  {
    name: 'getSlot0',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      {
        name: 'key',
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      },
    ],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'protocolFee', type: 'uint24' },
      { name: 'lpFee', type: 'uint24' },
    ],
  },
] as const

// UniversalRouter ABI for V4 (partial)
export const UNIVERSAL_ROUTER_ABI = [
  {
    name: 'execute',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'commands', type: 'bytes' },
      { name: 'inputs', type: 'bytes[]' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

// VolatilePairsHook ABI (read functions)
export const VOLATILE_PAIRS_HOOK_ABI = [
  {
    name: 'getCurrentDynamicFee',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [{ name: 'fee', type: 'uint24' }],
  },
  {
    name: 'getTWAPPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [{ name: 'price', type: 'uint256' }],
  },
  {
    name: 'getSwapCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [{ name: 'count', type: 'uint256' }],
  },
  {
    name: 'getPoolState',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [
      {
        name: 'state',
        type: 'tuple',
        components: [
          { name: 'lastSwapTimestamp', type: 'uint256' },
          { name: 'cumulativeVolume', type: 'uint256' },
          { name: 'currentDynamicFee', type: 'uint24' },
          { name: 'volatilityScore', type: 'uint256' },
          { name: 'twapPrice', type: 'uint256' },
          { name: 'lastTwapUpdate', type: 'uint256' },
        ],
      },
    ],
  },
] as const

/**
 * Create a pool key for V4
 */
export function createPoolKey(
  token0: Address,
  token1: Address,
  fee: number = 3000,
  tickSpacing: number = 60,
  hooks: Address = '0x0000000000000000000000000000000000000000'
): PoolKey {
  // Ensure token0 < token1 (sorted order)
  const [currency0, currency1] =
    token0.toLowerCase() < token1.toLowerCase()
      ? [token0, token1]
      : [token1, token0]

  return {
    currency0,
    currency1,
    fee,
    tickSpacing,
    hooks,
  }
}

/**
 * Compute pool ID from pool key (keccak256 of encoded pool key)
 */
export function computePoolId(poolKey: PoolKey): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'address' },
        { type: 'uint24' },
        { type: 'int24' },
        { type: 'address' },
      ],
      [
        poolKey.currency0,
        poolKey.currency1,
        poolKey.fee,
        poolKey.tickSpacing,
        poolKey.hooks,
      ]
    )
  )
}

/**
 * Generate swap calldata for V4 via UniversalRouter
 *
 * V4 swaps require encoding:
 * 1. Actions: SWAP_EXACT_IN_SINGLE + SETTLE_ALL + TAKE_ALL
 * 2. Params for each action
 * 3. Wrapped in V4_SWAP command for UniversalRouter
 */
export function generateV4SwapCalldata(
  fromTokenAddress: Address,
  toTokenAddress: Address,
  amountIn: bigint,
  recipient: Address,
  chainId: number,
  hookAddress?: Address
): { to: Address; data: Hex; value: bigint } {
  const routerAddress = UNIVERSAL_ROUTER_ADDRESSES[chainId]
  if (!routerAddress) {
    throw new Error(`UniversalRouter not available on chain ${chainId}`)
  }

  const hook = hookAddress || VOLATILE_PAIRS_HOOK_ADDRESSES[chainId] || '0x0000000000000000000000000000000000000000' as Address
  const poolKey = createPoolKey(fromTokenAddress, toTokenAddress, 3000, 60, hook)

  // Determine swap direction based on token address sorting
  const zeroForOne = fromTokenAddress.toLowerCase() < toTokenAddress.toLowerCase()

  // Determine input/output currencies based on direction
  const inputCurrency = zeroForOne ? poolKey.currency0 : poolKey.currency1
  const outputCurrency = zeroForOne ? poolKey.currency1 : poolKey.currency0

  // Minimum amount out (0 for simplicity, in production use slippage calculation)
  const minAmountOut = BigInt(0)

  // Build actions bytes: SWAP_EXACT_IN_SINGLE (0x06) + SETTLE_ALL (0x10) + TAKE_ALL (0x12)
  const actions = concat([
    `0x0${V4_ACTIONS.SWAP_EXACT_IN_SINGLE.toString(16)}` as Hex,
    `0x${V4_ACTIONS.SETTLE_ALL.toString(16)}` as Hex,
    `0x${V4_ACTIONS.TAKE_ALL.toString(16)}` as Hex,
  ])

  // Encode params for each action
  // Param 0: ExactInputSingleParams for SWAP_EXACT_IN_SINGLE
  const swapParams = encodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          {
            type: 'tuple',
            name: 'poolKey',
            components: [
              { type: 'address', name: 'currency0' },
              { type: 'address', name: 'currency1' },
              { type: 'uint24', name: 'fee' },
              { type: 'int24', name: 'tickSpacing' },
              { type: 'address', name: 'hooks' },
            ],
          },
          { type: 'bool', name: 'zeroForOne' },
          { type: 'uint128', name: 'amountIn' },
          { type: 'uint128', name: 'amountOutMinimum' },
          { type: 'bytes', name: 'hookData' },
        ],
      },
    ],
    [
      {
        poolKey: {
          currency0: poolKey.currency0,
          currency1: poolKey.currency1,
          fee: poolKey.fee,
          tickSpacing: poolKey.tickSpacing,
          hooks: poolKey.hooks,
        },
        zeroForOne,
        amountIn,
        amountOutMinimum: minAmountOut,
        hookData: '0x' as Hex,
      },
    ]
  )

  // Param 1: SETTLE_ALL (currency, maxAmount)
  const settleParams = encodeAbiParameters(
    [
      { type: 'address', name: 'currency' },
      { type: 'uint256', name: 'maxAmount' },
    ],
    [inputCurrency, amountIn]
  )

  // Param 2: TAKE_ALL (currency, minAmount)
  const takeParams = encodeAbiParameters(
    [
      { type: 'address', name: 'currency' },
      { type: 'uint256', name: 'minAmount' },
    ],
    [outputCurrency, minAmountOut]
  )

  // Combine actions and params for V4_SWAP
  const v4SwapInput = encodeAbiParameters(
    [
      { type: 'bytes', name: 'actions' },
      { type: 'bytes[]', name: 'params' },
    ],
    [actions, [swapParams, settleParams, takeParams]]
  )

  // Command: V4_SWAP (0x10)
  const commands = '0x10' as Hex

  // Deadline: 20 minutes from now
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)

  const calldata = encodeFunctionData({
    abi: UNIVERSAL_ROUTER_ABI,
    functionName: 'execute',
    args: [commands, [v4SwapInput], deadline],
  })

  return {
    to: routerAddress,
    data: calldata,
    value: BigInt(0),
  }
}

/**
 * Get pool state from VolatilePairsHook
 */
export interface PoolState {
  lastSwapTimestamp: bigint
  cumulativeVolume: bigint
  currentDynamicFee: number
  volatilityScore: bigint
  twapPrice: bigint
  lastTwapUpdate: bigint
}

/**
 * Format fee to percentage
 */
export function formatFeeToPercent(fee: number): string {
  return (fee / 10000).toFixed(2) + '%'
}

/**
 * Check if V4 is supported on a chain
 */
export function isV4Supported(chainId: number): boolean {
  return chainId in POOL_MANAGER_ADDRESSES && chainId in UNIVERSAL_ROUTER_ADDRESSES
}

/**
 * Get Tenderly devnet RPC URLs
 */
export const TENDERLY_DEVNET_RPCS: Record<string, string> = {
  'eil-arb': 'https://virtual.rpc.tenderly.co/stitchApp/project/private/eil-arb/05b28599-1cde-4a79-aff2-d275bffc6017',
  'eil-base': 'https://virtual.rpc.tenderly.co/stitchApp/project/private/eil-base/7e7c502b-2f81-4fd2-87ea-33bc2ae559d9',
  'eil-op': 'https://virtual.rpc.tenderly.co/stitchApp/project/private/eil-op/090dfde9-0c04-4a42-a236-de3427df29c8',
}

/**
 * Generate swap calldata (V3-compatible signature for backward compatibility)
 * Used by dustSweep and other utilities that had the old V3 function signature
 */
export async function generateSwapCalldata(
  fromTokenAddress: string,
  amount: string,
  toTokenAddress: string,
  _toDecimals: number,
  recipient: string,
  _provider: unknown,
  chainId: number,
  _fromDecimals?: number
): Promise<{ to: string; calldata: string; value?: string }> {
  const amountIn = BigInt(amount)
  const hookAddress = VOLATILE_PAIRS_HOOK_ADDRESSES[chainId]

  const result = generateV4SwapCalldata(
    fromTokenAddress as Address,
    toTokenAddress as Address,
    amountIn,
    recipient as Address,
    chainId,
    hookAddress
  )

  return {
    to: result.to,
    calldata: result.data,
    value: result.value.toString(),
  }
}

console.log('[UniswapV4] Module loaded - VolatilePairsHook integration ready')
