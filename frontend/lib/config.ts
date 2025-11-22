import { createPublicClient, http, erc20Abi, type Address } from 'viem'
import { sepolia } from 'viem/chains'
import { defineChain } from 'viem'

export const arbitrum = defineChain({
  id: 42161,
  name: 'Arbitrum',
  network: 'arbitrum',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://virtual.rpc.tenderly.co/stitchApp/project/private/eil-arb/05b28599-1cde-4a79-aff2-d275bffc6017'] },
    public: { http: ['https://virtual.rpc.tenderly.co/stitchApp/project/private/eil-arb/05b28599-1cde-4a79-aff2-d275bffc6017'] },
  },
});

export const base = defineChain({
  id: 8453,
  name: 'Base',
  network: 'base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://virtual.rpc.tenderly.co/stitchApp/project/private/eil-base/7e7c502b-2f81-4fd2-87ea-33bc2ae559d9'] },
    public: { http: ['https://virtual.rpc.tenderly.co/stitchApp/project/private/eil-base/7e7c502b-2f81-4fd2-87ea-33bc2ae559d9'] },
  },
});

export const optimism = defineChain({
  id: 10,
  name: 'Optimism',
  network: 'optimism',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://virtual.rpc.tenderly.co/stitchApp/project/private/eil-op/090dfde9-0c04-4a42-a236-de3427df29c8'] },
    public: { http: ['https://virtual.rpc.tenderly.co/stitchApp/project/private/eil-op/090dfde9-0c04-4a42-a236-de3427df29c8'] },
  },
});

export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238") as Address
// SimpleAccountFactory for v0.6 (deployed by eth-infinitism)
export const SIMPLE_ACCOUNT_FACTORY = (process.env.NEXT_PUBLIC_SIMPLE_ACCOUNT_FACTORY || "0x9406Cc6185a346906296840746125a0E44976454") as Address
// EntryPoint v0.6 address
export const ENTRY_POINT = (process.env.NEXT_PUBLIC_ENTRY_POINT || "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789") as Address
export const USDC_DECIMALS = 6
export const BUNDLER_URL = process.env.NEXT_PUBLIC_BUNDLER_URL || "http://localhost:3000"

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.NEXT_PUBLIC_DEBUG_RPC || "https://eth-sepolia.g.alchemy.com/v2/demo"),
})

export { erc20Abi }

export const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const
