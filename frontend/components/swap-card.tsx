"use client"

import { useState, useEffect } from "react"
import { useAccount, useWalletClient, useChainId, useSwitchChain } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import {
  parseUnits,
  encodeFunctionData,
  erc20Abi,
  type Address,
} from "viem"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader, ProgressBar } from "@/components/ui/loader"
import { useToast } from "@/hooks/use-toast"
import { TokenAddresses } from "@/types/token"
import { SUPPORTED_CHAINS } from "@/lib/tokens"

// Token info with decimals
const TOKEN_INFO: Record<string, { symbol: string; decimals: number; name: string }> = {
  USDC: { symbol: "USDC", decimals: 6, name: "USD Coin" },
  USDT: { symbol: "USDT", decimals: 6, name: "Tether USD" },
  WETH: { symbol: "WETH", decimals: 18, name: "Wrapped Ether" },
  DAI: { symbol: "DAI", decimals: 18, name: "Dai Stablecoin" },
}

// Build tokens per chain from TokenAddresses
function getTokensForChain(chainId: number): { address: Address; symbol: string; decimals: number; name: string }[] {
  const chainTokens = TokenAddresses[chainId]
  if (!chainTokens) return []

  return Object.entries(chainTokens).map(([symbol, address]) => ({
    address: address as Address,
    symbol,
    decimals: TOKEN_INFO[symbol]?.decimals ?? 18,
    name: TOKEN_INFO[symbol]?.name ?? symbol,
  }))
}

// Uniswap SwapRouter02 addresses per chain
const SWAP_ROUTER: Record<number, Address> = {
  8453: "0x2626664c2603336E57B271c5C0b26F421741e481", // Base
  42161: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Arbitrum
  10: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", // Optimism
}

// Explorer URLs per chain
const EXPLORER_URLS: Record<number, string> = {
  8453: "https://basescan.org",
  42161: "https://arbiscan.io",
  10: "https://optimistic.etherscan.io",
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

  const [selectedChain, setSelectedChain] = useState<number>(8453) // Base by default
  const [fromToken, setFromToken] = useState<number>(0)
  const [toToken, setToToken] = useState<number>(1)
  const [amount, setAmount] = useState("")
  const [step, setStep] = useState<SwapStep>("idle")
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const tokens = getTokensForChain(selectedChain)
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

      await walletClient.sendTransaction({
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
    return `${EXPLORER_URLS[selectedChain] || "https://etherscan.io"}/tx/${hash}`
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
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                  selectedChain === chain.id
                    ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                    : "bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                <img
                  src={chain.icon}
                  alt={chain.name}
                  className="w-4 h-4 rounded-full"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none"
                  }}
                />
                {chain.name}
              </button>
            ))}
          </div>
        </div>

        {chainId !== selectedChain && (
          <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
            <p className="text-xs text-amber-400">
              Switch to {SUPPORTED_CHAINS.find(c => c.id === selectedChain)?.name} to swap
            </p>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {step === "success" ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30">
                <svg className="h-7 w-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div className="text-center">
              <p className="font-semibold text-white text-lg">Swap complete!</p>
              <p className="text-sm text-zinc-400 mt-1">
                {amount} {fromTokenData?.symbol} → {toTokenData?.symbol}
              </p>
            </div>
            {txHash && (
              <a
                href={getExplorerUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-emerald-400 hover:text-emerald-300 underline transition-colors"
              >
                View transaction
              </a>
            )}
            <Button onClick={reset} variant="outline" size="sm">
              New swap
            </Button>
          </div>
        ) : step === "error" ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-red-500/20 blur-xl animate-pulse" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 border border-red-500/30">
                <svg className="h-7 w-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <div className="text-center">
              <p className="font-semibold text-white text-lg">Swap failed</p>
              <p className="max-w-xs text-sm text-zinc-400 mt-1">{error}</p>
            </div>
            <Button onClick={reset} variant="outline" size="sm">
              Try again
            </Button>
          </div>
        ) : (
          <>
            {/* From Token */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">From</label>
              <div className="flex gap-2">
                <select
                  value={fromToken}
                  onChange={(e) => setFromToken(Number(e.target.value))}
                  disabled={isLoading}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all cursor-pointer"
                >
                  {tokens.map((token, idx) => (
                    <option key={token.address} value={idx} disabled={idx === toToken} className="bg-zinc-900 text-white">
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
                className="group rounded-full bg-emerald-500/10 border border-emerald-500/20 p-2.5 hover:bg-emerald-500/20 hover:border-emerald-500/30 transition-all duration-200"
              >
                <svg className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            </div>

            {/* To Token */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">To</label>
              <div className="flex gap-2">
                <select
                  value={toToken}
                  onChange={(e) => setToToken(Number(e.target.value))}
                  disabled={isLoading}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all cursor-pointer"
                >
                  {tokens.map((token, idx) => (
                    <option key={token.address} value={idx} disabled={idx === fromToken} className="bg-zinc-900 text-white">
                      {token.symbol}
                    </option>
                  ))}
                </select>
                <div className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-zinc-500">
                  Output amount (estimated)
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {isLoading && (
              <div className="space-y-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-4">
                <div className="flex items-center gap-3">
                  <Loader size="sm" />
                  <span className="text-sm text-zinc-300">
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
