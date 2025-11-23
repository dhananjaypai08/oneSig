import type { Address } from 'viem'

export interface TokenInfo {
  symbol: string
  name: string
  decimals: number
  icon: string
  addresses: Record<number, Address>
  isNative?: boolean // True for native ETH
}

export interface ChainInfo {
  id: number
  name: string
  icon: string
}

// Supported chains
export const SUPPORTED_CHAINS: ChainInfo[] = [
  {
    id: 8453,
    name: 'Base',
    icon: 'https://assets.coingecko.com/asset_platforms/images/131/small/base-network.png',
  },
  {
    id: 42161,
    name: 'Arbitrum',
    icon: 'https://assets.coingecko.com/coins/images/16547/small/arb.jpg',
  },
  {
    id: 10,
    name: 'Optimism',
    icon: 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png',
  },
  {
    id: 48900,
    name: 'Zircuit',
    icon: 'https://assets.coingecko.com/asset_platforms/images/209/small/zircuit.jpeg',
  },
]

// Token definitions with addresses per chain
export const TOKENS: TokenInfo[] = [
  {
    symbol: 'ETH',
    name: 'Ether',
    decimals: 18,
    icon: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    addresses: {
      10: '0x0000000000000000000000000000000000000000',
      42161: '0x0000000000000000000000000000000000000000',
      8453: '0x0000000000000000000000000000000000000000',
    },
    isNative: true,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    icon: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
    addresses: {
      1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
      42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    },
  },
  {
    symbol: 'SHIB',
    name: 'SHIBA Inu(WETH)',
    decimals: 18,
    icon: 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
    addresses: {
      1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      10: '0x4200000000000000000000000000000000000006',
      42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      8453: '0x4200000000000000000000000000000000000006',
      48900: "0x4200000000000000000000000000000000000006"
    },
  },
  {
    symbol: 'TOSHI',
    name: 'Toshi USD(USDT)',
    decimals: 6,
    icon: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
    addresses: {
      1: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      10: '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58',
      42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      8453: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    },
  },
  {
    symbol: 'LDO',
    name: 'Lido DAO(DAI)',
    decimals: 18,
    icon: 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png',
    addresses: {
      1: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      10: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      42161: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      8453: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
    },
  },
]

// Helper to get chain info by ID
export function getChainInfo(chainId: number): ChainInfo | undefined {
  return SUPPORTED_CHAINS.find(c => c.id === chainId)
}

// Helper to get token address for a chain
export function getTokenAddress(token: TokenInfo, chainId: number): Address | undefined {
  return token.addresses[chainId] as Address | undefined
}
