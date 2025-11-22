import { Token as UniswapToken, CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core'
import { Pool, Route, Trade, FeeAmount } from '@uniswap/v3-sdk'
import { ethers } from 'ethers'

const SWAP_ROUTER_02_ADDRESSES: { [chainId: number]: string } = {
  1: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  10: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  8453: '0x2626664c2603336E57B271c5C0b26F421741e481',
  42161: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
}

const POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() external view returns (uint128)',
  'function fee() external view returns (uint24)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
]

const FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)',
]

const FACTORY_ADDRESSES: { [chainId: number]: string } = {
  1: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  10: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  8453: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
  42161: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
}

const SWAP_ROUTER_02_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
  'function exactInput((bytes path, address recipient, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)',
]

async function getPoolAddress(
  provider: ethers.providers.JsonRpcProvider,
  tokenA: string,
  tokenB: string,
  fee: FeeAmount,
  chainId: number
): Promise<string | null> {
  const factoryAddress = FACTORY_ADDRESSES[chainId]
  if (!factoryAddress) return null

  const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, provider)
  try {
    const poolAddress = await factory.getPool(tokenA, tokenB, fee)
    if (poolAddress === ethers.constants.AddressZero) return null
    return poolAddress
  } catch {
    return null
  }
}

async function getPoolData(
  provider: ethers.providers.JsonRpcProvider,
  poolAddress: string
) {
  const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider)
  const [slot0, liquidity, fee] = await Promise.all([
    poolContract.slot0(),
    poolContract.liquidity(),
    poolContract.fee(),
  ])
  return {
    sqrtPriceX96: slot0.sqrtPriceX96.toString(),
    tick: slot0.tick,
    liquidity: liquidity.toString(),
    fee: fee,
  }
}

export async function generateSwapCalldata(
  fromTokenAddress: string,
  amount: string,
  toTokenAddress: string,
  toTokenDecimals: number,
  recipient: string,
  provider: ethers.providers.JsonRpcProvider,
  chainId: number,
  fromTokenDecimals: number = 6
) {
  console.log('[Uniswap] Generating swap calldata...', {
    fromToken: fromTokenAddress,
    toToken: toTokenAddress,
    amount,
    chainId,
  })

  const fromToken = new UniswapToken(chainId, fromTokenAddress, fromTokenDecimals)
  const toToken = new UniswapToken(chainId, toTokenAddress, toTokenDecimals)

  const feeTiers: FeeAmount[] = [FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH]
  let poolAddress: string | null = null
  let selectedFee: FeeAmount = FeeAmount.MEDIUM

  for (const fee of feeTiers) {
    poolAddress = await getPoolAddress(provider, fromTokenAddress, toTokenAddress, fee, chainId)
    if (poolAddress) {
      selectedFee = fee
      console.log('[Uniswap] Found pool with fee tier:', fee, 'at', poolAddress)
      break
    }
  }

  if (!poolAddress) {
    throw new Error(`No Uniswap V3 pool found for ${fromTokenAddress} -> ${toTokenAddress} on chain ${chainId}`)
  }

  const poolData = await getPoolData(provider, poolAddress)
  console.log('[Uniswap] Pool data:', poolData)

  const pool = new Pool(
    fromToken,
    toToken,
    selectedFee,
    poolData.sqrtPriceX96,
    poolData.liquidity,
    poolData.tick
  )

  const route = new Route([pool], fromToken, toToken)
  const amountIn = CurrencyAmount.fromRawAmount(fromToken, amount)

  const quotedAmountOut = route.midPrice.quote(amountIn)
  const outputAmountStr = quotedAmountOut.quotient.toString()
  console.log('[Uniswap] Quoted amount out:', quotedAmountOut.toSignificant(6), 'raw:', outputAmountStr)

  const trade = Trade.createUncheckedTrade({
    route,
    inputAmount: amountIn,
    outputAmount: CurrencyAmount.fromRawAmount(toToken, outputAmountStr),
    tradeType: TradeType.EXACT_INPUT,
  })

  const slippageTolerance = new Percent(5, 100)
  const amountOutMin = trade.minimumAmountOut(slippageTolerance)

  const routerInterface = new ethers.utils.Interface(SWAP_ROUTER_02_ABI)

  const calldata = routerInterface.encodeFunctionData('exactInputSingle', [{
    tokenIn: fromTokenAddress,
    tokenOut: toTokenAddress,
    fee: selectedFee,
    recipient: recipient,
    amountIn: amount,
    amountOutMinimum: amountOutMin.quotient.toString(),
    sqrtPriceLimitX96: 0,
  }])

  console.log('[Uniswap] Swap calldata generated for SwapRouter02')

  const routerAddress = SWAP_ROUTER_02_ADDRESSES[chainId] || SWAP_ROUTER_02_ADDRESSES[1]

  return {
    to: routerAddress,
    calldata: calldata,
    value: '0',
  }
}
