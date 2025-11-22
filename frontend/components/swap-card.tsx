"use client"

import { useState, useEffect } from "react"
import { useAccount, useWalletClient, useChainId, useSwitchChain } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import {
  formatUnits,
  parseUnits,
  encodeFunctionData,
  erc20Abi,
  type Address,
  type Hex,
} from "viem"
import { base, arbitrum, optimism, mainnet } from "viem/chains"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader, ProgressBar } from "@/components/ui/loader"
import { useToast } from "@/hooks/use-toast"

// Supported chains for swapping
const SUPPORTED_CHAINS = [
  { id: base.id, name: "Base", icon: "B" },
  { id: arbitrum.id, name: "Arbitrum", icon: "A" },
  { id: optimism.id, name: "Optimism", icon: "O" },
  { id: mainnet.id, name: "Ethereum", icon: "E" },
]

// Common tokens per chain
const TOKENS: Record<number, { address: Address; symbol: string; decimals: number; name: string }[]> = {
  [base.id]: [
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6, name: "USD Coin" },
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18, name: "Wrapped Ether" },
    { address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", symbol: "cbBTC", decimals: 8, name: "Coinbase BTC" },
  ],
  [arbitrum.id]: [
    { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", decimals: 6, name: "USD Coin" },
    { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", symbol: "WETH", decimals: 18, name: "Wrapped Ether" },
    { address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", symbol: "WBTC", decimals: 8, name: "Wrapped BTC" },
  ],
  [optimism.id]: [
    { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", symbol: "USDC", decimals: 6, name: "USD Coin" },
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18, name: "Wrapped Ether" },
    { address: "0x68f180fcCe6836688e9084f035309E29Bf0A2095", symbol: "WBTC", decimals: 8, name: "Wrapped BTC" },
  ],
  [mainnet.id]: [
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6, name: "USD Coin" },
    { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", decimals: 18, name: "Wrapped Ether" },
    { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol: "WBTC", decimals: 8, name: "Wrapped BTC" },
  ],
}

// Uniswap SwapRouter02 addresses per chain
const SWAP_ROUTER: Record<number, Address> = {
  [base.id]: "0x2626664c2603336E57B271c5C0b26F421741e481",
  [arbitrum.id]: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
  [optimism.id]: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
  [mainnet.id]: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
}

type SwapStep = "idle" | "approving" | "swapping" | "confirming" | "success" | "error"

const stepProgress: Record<SwapStep, number> = {
  idle: 0,
  approving: 25,
  swapping: 50,
  confirming: 75,
  success: 100,
  error: 0,
}

const stepMessages: Record<SwapStep, string> = {
  idle: "",
  approving: "Approving token...",
  swapping: "Executing swap...",
  confirming: "Waiting for confirmation...",
  success: "Swap complete!",
  error: "Swap failed",
}

export function SwapCard() {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { toast } = useToast()

  const [selectedChain, setSelectedChain] = useState<number>(base.id)
  const [fromToken, setFromToken] = useState<number>(0)
  const [toToken, setToToken] = useState<number>(1)
  const [amount, setAmount] = useState("")
  const [step, setStep] = useState<SwapStep>("idle")
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const tokens = TOKENS[selectedChain] || []
  const fromTokenData = tokens[fromToken]
  const toTokenData = tokens[toToken]
  const isLoading = ["approving", "swapping", "confirming"].includes(step)

  // Switch chain if needed
  useEffect(() => {
    if (isConnected && chainId !== selectedChain) {
      // Don't auto-switch, let user do it
    }
  }, [isConnected, chainId, selectedChain])

  const handleChainSelect = async (newChainId: number) => {
    setSelectedChain(newChainId)
    setFromToken(0)
    setToToken(1)
    setAmount("")
    setError(null)

    if (chainId !== newChainId) {
      try {
        await switchChain({ chainId: newChainId })
      } catch (e) {
        console.error("Failed to switch chain:", e)
      }
    }
  }

  const handleSwapTokens = () => {
    const temp = fromToken
    setFromToken(toToken)
    setToToken(temp)
  }

  const handleSwap = async () => {
    if (!address || !walletClient || !fromTokenData || !toTokenData) {
      setError("Please connect your wallet")
      return
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount")
      return
    }

    if (chainId !== selectedChain) {
      setError(`Please switch to ${SUPPORTED_CHAINS.find(c => c.id === selectedChain)?.name}`)
      return
    }

    setError(null)
    setTxHash(null)

    try {
      const amountIn = parseUnits(amount, fromTokenData.decimals)
      const routerAddress = SWAP_ROUTER[selectedChain]

      // Step 1: Approve token
      setStep("approving")

      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [routerAddress, amountIn],
      })

      const approveTx = await walletClient.sendTransaction({
        to: fromTokenData.address,
        data: approveData,
      })

      // Wait for approval
      setStep("swapping")

      // Step 2: Execute swap using exactInputSingle
      // Uniswap V3 SwapRouter02 exactInputSingle params
      const swapParams = {
        tokenIn: fromTokenData.address,
        tokenOut: toTokenData.address,
        fee: 3000, // 0.3% fee tier (most common)
        recipient: address,
        amountIn: amountIn,
        amountOutMinimum: BigInt(0), // For demo - in production use a quote
        sqrtPriceLimitX96: BigInt(0),
      }

      const EXACT_INPUT_SINGLE_ABI = [
        {
          name: "exactInputSingle",
          type: "function",
          stateMutability: "payable",
          inputs: [
            {
              name: "params",
              type: "tuple",
              components: [
                { name: "tokenIn", type: "address" },
                { name: "tokenOut", type: "address" },
                { name: "fee", type: "uint24" },
                { name: "recipient", type: "address" },
                { name: "amountIn", type: "uint256" },
                { name: "amountOutMinimum", type: "uint256" },
                { name: "sqrtPriceLimitX96", type: "uint160" },
              ],
            },
          ],
          outputs: [{ type: "uint256" }],
        },
      ] as const

      const swapData = encodeFunctionData({
        abi: EXACT_INPUT_SINGLE_ABI,
        functionName: "exactInputSingle",
        args: [swapParams],
      })

      const swapTx = await walletClient.sendTransaction({
        to: routerAddress,
        data: swapData,
        value: BigInt(0),
      })

      setStep("confirming")
      setTxHash(swapTx)

      setStep("success")
      toast({
        title: "Swap complete!",
        description: `Swapped ${amount} ${fromTokenData.symbol} for ${toTokenData.symbol}`,
        variant: "success",
      })

    } catch (e: unknown) {
      console.error("Swap error:", e)
      setStep("error")
      const errorMessage = e instanceof Error ? e.message : "Swap failed"
      setError(errorMessage.includes("user rejected") ? "Transaction rejected" : errorMessage)
    }
  }

  const reset = () => {
    setStep("idle")
    setError(null)
    setTxHash(null)
    setAmount("")
  }

  const getExplorerUrl = (hash: string) => {
    const explorers: Record<number, string> = {
      [base.id]: "https://basescan.org",
      [arbitrum.id]: "https://arbiscan.io",
      [optimism.id]: "https://optimistic.etherscan.io",
      [mainnet.id]: "https://etherscan.io",
    }
    return `${explorers[selectedChain]}/tx/${hash}`
  }

  if (!isConnected) {
    return (
      <Card className="w-full">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">Swap Tokens</CardTitle>
          <CardDescription>
            Swap tokens across supported chains
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pt-4">
          <ConnectButton />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Swap Tokens</CardTitle>
            <CardDescription>Uniswap V3</CardDescription>
          </div>
          <ConnectButton
            accountStatus="address"
            chainStatus="icon"
            showBalance={false}
          />
        </div>

        {/* Chain Selector */}
        <div className="mt-4">
          <span className="text-xs uppercase tracking-wide text-zinc-500">Chain:</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {SUPPORTED_CHAINS.map((chain) => (
              <button
                key={chain.id}
                onClick={() => handleChainSelect(chain.id)}
                disabled={isLoading}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  selectedChain === chain.id
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                }`}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold dark:bg-zinc-700">
                  {chain.icon}
                </span>
                {chain.name}
              </button>
            ))}
          </div>
        </div>

        {chainId !== selectedChain && (
          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-2 dark:bg-amber-950 dark:border-amber-800">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Switch to {SUPPORTED_CHAINS.find(c => c.id === selectedChain)?.name} to swap
            </p>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {step === "success" ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">Swap complete!</p>
              <p className="text-sm text-zinc-500">
                {amount} {fromTokenData?.symbol} → {toTokenData?.symbol}
              </p>
            </div>
            {txHash && (
              <a
                href={getExplorerUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 underline"
              >
                View transaction
              </a>
            )}
            <Button onClick={reset} variant="secondary" size="sm">
              New swap
            </Button>
          </div>
        ) : step === "error" ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
              <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">Swap failed</p>
              <p className="max-w-xs text-sm text-zinc-500">{error}</p>
            </div>
            <Button onClick={reset} variant="secondary" size="sm">
              Try again
            </Button>
          </div>
        ) : (
          <>
            {/* From Token */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500">From</label>
              <div className="flex gap-2">
                <select
                  value={fromToken}
                  onChange={(e) => setFromToken(Number(e.target.value))}
                  disabled={isLoading}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {tokens.map((token, idx) => (
                    <option key={token.address} value={idx} disabled={idx === toToken}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={isLoading}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Swap Direction Button */}
            <div className="flex justify-center">
              <button
                onClick={handleSwapTokens}
                disabled={isLoading}
                className="rounded-full bg-zinc-100 p-2 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              >
                <svg className="h-4 w-4 text-zinc-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            </div>

            {/* To Token */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-500">To</label>
              <div className="flex gap-2">
                <select
                  value={toToken}
                  onChange={(e) => setToToken(Number(e.target.value))}
                  disabled={isLoading}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {tokens.map((token, idx) => (
                    <option key={token.address} value={idx} disabled={idx === fromToken}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
                <div className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800">
                  Output amount (estimated)
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 dark:bg-red-950 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {isLoading && (
              <div className="space-y-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
                <div className="flex items-center gap-2">
                  <Loader size="sm" />
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {stepMessages[step]}
                  </span>
                </div>
                <ProgressBar progress={stepProgress[step]} />
              </div>
            )}

            <Button
              onClick={handleSwap}
              disabled={isLoading || !amount || chainId !== selectedChain}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader size="sm" />
                  <span>Processing</span>
                </>
              ) : chainId !== selectedChain ? (
                "Switch Chain"
              ) : (
                "Swap"
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
