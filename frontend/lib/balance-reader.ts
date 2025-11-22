import { createPublicClient, http, erc20Abi, formatUnits, type Address, type PublicClient } from 'viem'
import { base, arbitrum, optimism } from './config'
import { TOKENS, SUPPORTED_CHAINS, type TokenInfo, type ChainInfo } from './tokens'

// Create public clients for each chain with proper typing
const clients: Record<number, PublicClient> = {
  [base.id]: createPublicClient({ chain: base, transport: http() }),
  [arbitrum.id]: createPublicClient({ chain: arbitrum, transport: http() }),
  [optimism.id]: createPublicClient({ chain: optimism, transport: http() }),
}

export interface TokenBalance {
  token: TokenInfo
  chain: ChainInfo
  balance: bigint
  formattedBalance: string
}

export interface AggregatedBalance {
  token: TokenInfo
  totalBalance: bigint
  formattedTotal: string
  chains: TokenBalance[]
}

// Read native ETH balance on a chain
async function readNativeBalance(
  token: TokenInfo,
  chainId: number,
  userAddress: Address
): Promise<TokenBalance | null> {
  const client = clients[chainId]
  const chainInfo = SUPPORTED_CHAINS.find(c => c.id === chainId)

  if (!client || !chainInfo) return null

  try {
    const balance = await client.getBalance({ address: userAddress })

    return {
      token,
      chain: chainInfo,
      balance,
      formattedBalance: formatUnits(balance, token.decimals),
    }
  } catch (error) {
    console.error(`Error reading native ETH on chain ${chainId}:`, error)
    return null
  }
}

// Read balance of a single ERC20 token on a single chain
async function readTokenBalance(
  token: TokenInfo,
  chainId: number,
  userAddress: Address
): Promise<TokenBalance | null> {
  // Handle native ETH separately
  if (token.isNative) {
    return readNativeBalance(token, chainId, userAddress)
  }

  const client = clients[chainId]
  const tokenAddress = token.addresses[chainId]
  const chainInfo = SUPPORTED_CHAINS.find(c => c.id === chainId)

  if (!client || !tokenAddress || !chainInfo) return null

  try {
    const balance = await client.readContract({
      address: tokenAddress as Address,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [userAddress],
    })

    return {
      token,
      chain: chainInfo,
      balance,
      formattedBalance: formatUnits(balance, token.decimals),
    }
  } catch (error) {
    console.error(`Error reading ${token.symbol} on chain ${chainId}:`, error)
    return null
  }
}

// Read all token balances for a user across all supported chains
export async function readAllBalances(userAddress: Address): Promise<AggregatedBalance[]> {
  const results: AggregatedBalance[] = []

  // Create all balance read promises
  const promises: Promise<TokenBalance | null>[] = []
  const tokenChainMap: { tokenIndex: number; chainId: number }[] = []

  TOKENS.forEach((token, tokenIndex) => {
    SUPPORTED_CHAINS.forEach(chain => {
      if (token.addresses[chain.id]) {
        promises.push(readTokenBalance(token, chain.id, userAddress))
        tokenChainMap.push({ tokenIndex, chainId: chain.id })
      }
    })
  })

  // Execute all reads in parallel
  const balances = await Promise.all(promises)

  // Aggregate results by token
  TOKENS.forEach((token, tokenIndex) => {
    const tokenBalances = balances.filter(
      (b, i) => b !== null && tokenChainMap[i].tokenIndex === tokenIndex
    ) as TokenBalance[]

    const totalBalance = tokenBalances.reduce((sum, b) => sum + b.balance, BigInt(0))

    results.push({
      token,
      totalBalance,
      formattedTotal: formatUnits(totalBalance, token.decimals),
      chains: tokenBalances.filter(b => b.balance > BigInt(0)),
    })
  })

  return results
}

// Format balance for display
export function formatDisplayBalance(balance: string): string {
  const num = parseFloat(balance)
  if (isNaN(num) || num === 0) return '0'
  if (num < 0.0001) return '<0.0001'
  if (num < 1) return num.toFixed(6)
  if (num < 1000) return num.toFixed(4)
  if (num < 1000000) return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return `${(num / 1000000).toFixed(2)}M`
}
