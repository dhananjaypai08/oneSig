"use client"

import { useState, useCallback } from "react"
import { useAccount } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import type { Address } from "viem"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader, ProgressBar } from "@/components/ui/loader"
import { readAllBalances, formatDisplayBalance, type AggregatedBalance } from "@/lib/balance-reader"
import { SUPPORTED_CHAINS } from "@/lib/tokens"
import { createEilSdk } from "@/lib/eil-sdk"
import { dustSweep } from "@/utils/dustSweep"
import { Token } from "@/types/token"
import { CallbackType, type ExecCallback, type ExecCallbackData } from "@eil-protocol/sdk"
import { ExternalLink } from "lucide-react"

// Success sound - satisfying chime
const SUCCESS_SOUND_URL = "https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3"

const playSuccessSound = () => {
  if (typeof window !== "undefined") {
    try {
      const audio = new Audio(SUCCESS_SOUND_URL)
      audio.volume = 0.4
      audio.playbackRate = 0.9
      audio.play().catch(() => {})
    } catch {
      // Silently fail
    }
  }
}

type SweepStep = "idle" | "initializing" | "sweeping" | "confirming" | "success" | "error"

type TransactionResult = {
  chainId: number
  chainName: string
  txHash: string
  status: "success" | "failed"
  revertReason?: string
}

const EXPLORER_BASE_URL = "https://explorer.syndika.io/tx"

const getChainName = (chainId: number): string => {
  const names: Record<number, string> = {
    42161: "Arbitrum",
    8453: "Base",
    10: "Optimism",
  }
  return names[chainId] || `Chain ${chainId}`
}

const getChainIcon = (chainId: number): string => {
  const icons: Record<number, string> = {
    42161: "https://assets.coingecko.com/coins/images/16547/small/arb.jpg",
    8453: "https://assets.coingecko.com/asset_platforms/images/131/small/base-network.png",
    10: "https://assets.coingecko.com/coins/images/25244/small/Optimism.png",
  }
  return icons[chainId] || ""
}

const stepProgress: Record<SweepStep, number> = {
  idle: 0,
  initializing: 20,
  sweeping: 50,
  confirming: 75,
  success: 100,
  error: 0,
}

const stepMessages: Record<SweepStep, string> = {
  idle: "",
  initializing: "Initializing SDK...",
  sweeping: "Executing cross-chain swaps...",
  confirming: "Waiting for confirmations...",
  success: "Dust sweep complete!",
  error: "Sweep failed",
}

export function PortfolioCard() {
  const { address, isConnected } = useAccount()
  const [balances, setBalances] = useState<AggregatedBalance[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedToken, setExpandedToken] = useState<string | null>(null)

  const [selectedChains, setSelectedChains] = useState<Set<number>>(
    new Set(SUPPORTED_CHAINS.map(c => c.id))
  )
  const [sweepStep, setSweepStep] = useState<SweepStep>("idle")
  const [sweepError, setSweepError] = useState<string | null>(null)
  const [completedChains, setCompletedChains] = useState<number>(0)
  const [transactionResults, setTransactionResults] = useState<TransactionResult[]>([])
  const [sweepPercentage, setSweepPercentage] = useState<number>(100)

  const handleFetchBalances = async () => {
    if (!address) {
      setError("Please connect your wallet first")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await readAllBalances(address as Address)
      // console.log("Portfolio balances:", result)
      setBalances(result)
    } catch (e) {
      console.error("Fetch balances error:", e)
      setError(e instanceof Error ? e.message : "Failed to fetch balances")
    } finally {
      setIsLoading(false)
    }
  }

  const toggleChain = (chainId: number) => {
    setSelectedChains(prev => {
      const newSet = new Set(prev)
      if (newSet.has(chainId)) {
        if (newSet.size > 1) {
          newSet.delete(chainId)
        }
      } else {
        newSet.add(chainId)
      }
      return newSet
    })
  }

  const selectAllChains = () => {
    setSelectedChains(new Set(SUPPORTED_CHAINS.map(c => c.id)))
  }

  const getTokensToSweep = useCallback((percentage: number = 100): { [key: number]: Token[] } => {
    const tokensMap: { [key: number]: Token[] } = {}
    const chainIds = [42161, 8453, 10]

    for (const chainId of chainIds) {
      tokensMap[chainId] = []
    }

    for (const aggregatedBalance of balances) {
      const symbol = aggregatedBalance.token.symbol

      if (symbol === "USDC" || symbol === "ETH") continue
      if (symbol !== "SHIB" && symbol !== "TOSHI" && symbol !== "LDO") continue

      for (const chainBalance of aggregatedBalance.chains) {
        const chainId = chainBalance.chain.id

        if (!selectedChains.has(chainId)) continue
        if (chainBalance.balance <= BigInt(0)) continue

        const tokenAddress = aggregatedBalance.token.addresses[chainId]
        if (!tokenAddress) continue

        // Calculate the amount based on percentage
        const sweepAmount = (chainBalance.balance * BigInt(percentage)) / BigInt(100)
        if (sweepAmount <= BigInt(0)) continue

        tokensMap[chainId].push({
          address: tokenAddress,
          value: sweepAmount,
          name: symbol as "TOSHI" | "LDO" | "SHIB",
          decimals: aggregatedBalance.token.decimals,
        })
      }
    }

    return tokensMap
  }, [balances, selectedChains])

  const handleDustSweep = async () => {
    if (!address) {
      setSweepError("Please connect your wallet first")
      return
    }

    const tokensToSweep = getTokensToSweep(sweepPercentage)
    const totalTokens = Object.values(tokensToSweep).flat().length

    if (totalTokens === 0) {
      setSweepError("No tokens to sweep. Only SHIB, TOSHI, and LDO with balance can be swept to USDC.")
      return
    }

    setSweepError(null)
    setSweepStep("initializing")
    setCompletedChains(0)
    setTransactionResults([])

    const activeChainIds = [42161, 8453, 10].filter(
      chainId => (tokensToSweep[chainId] || []).length > 0
    )

    try {
      const { sdk, account, walletAddress } = await createEilSdk()

      setSweepStep("sweeping")

      const callback: ExecCallback = (data: ExecCallbackData) => {
        const { type, index, revertReason, txHash } = data
        console.log("Dust sweep callback:", { type, index, revertReason, txHash })

        const chainId = activeChainIds[index]

        if (type === CallbackType.Done && txHash && chainId) {
          setCompletedChains(prev => prev + 1)
          setTransactionResults(prev => [...prev, {
            chainId,
            chainName: getChainName(chainId),
            txHash,
            status: "success",
          }])
        } else if (type === CallbackType.Failed && chainId) {
          console.error("Chain failed:", index, revertReason)
          setTransactionResults(prev => [...prev, {
            chainId,
            chainName: getChainName(chainId),
            txHash: txHash || "",
            status: "failed",
            revertReason: revertReason?.toString(),
          }])
        }
      }

      await dustSweep(walletAddress, sdk, account, tokensToSweep, callback)

      setSweepStep("confirming")
      await new Promise(resolve => setTimeout(resolve, 2000))

      setSweepStep("success")
      playSuccessSound()
      setTimeout(() => {
        handleFetchBalances()
      }, 3000)

    } catch (e: unknown) {
      console.error("Dust sweep error:", e)
      setSweepStep("error")
      const errorMessage = e instanceof Error ? e.message : "Dust sweep failed"
      setSweepError(errorMessage.includes("user rejected") ? "Transaction rejected" : errorMessage)
    }
  }

  const resetSweep = () => {
    setSweepStep("idle")
    setSweepError(null)
    setCompletedChains(0)
    setTransactionResults([])
  }

  const sweepableTokens = getTokensToSweep(100)
  const totalSweepableTokens = Object.values(sweepableTokens).flat().length
  const isSweeping = ["initializing", "sweeping", "confirming"].includes(sweepStep)

  const calculateTotalUSD = (): number => {
    return balances.reduce((sum, b) => {
      const balance = parseFloat(b.formattedTotal)
      if (b.token.symbol === 'USDC' || b.token.symbol === 'TOSHI' || b.token.symbol === 'LDO') {
        return sum + balance
      }
      if (b.token.symbol === 'ETH' || b.token.symbol === 'SHIB') {
        return sum + balance * 2500
      }
      return sum
    }, 0)
  }

  const getFilteredBalances = (): AggregatedBalance[] => {
    return balances.map(b => ({
      ...b,
      chains: b.chains.filter(c => selectedChains.has(c.chain.id)),
      totalBalance: b.chains
        .filter(c => selectedChains.has(c.chain.id))
        .reduce((sum, c) => sum + c.balance, BigInt(0)),
    })).map(b => ({
      ...b,
      formattedTotal: (Number(b.totalBalance) / Math.pow(10, b.token.decimals)).toString(),
    }))
  }

  const filteredBalances = getFilteredBalances()
  const filteredTokensWithBalance = filteredBalances.filter(b => b.totalBalance > BigInt(0))

  if (!isConnected) {
    return (
      <Card className="w-full">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">Portfolio</CardTitle>
          <CardDescription>
            View your token balances across Base, Arbitrum & Optimism
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
            <CardTitle>Portfolio</CardTitle>
            <CardDescription>
              Select chains to view & sweep
            </CardDescription>
          </div>
          <ConnectButton
            accountStatus="address"
            chainStatus="icon"
            showBalance={false}
          />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wide text-zinc-500">Chains:</span>
            <button
              onClick={selectAllChains}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Select All
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_CHAINS.map((chain) => (
              <button
                key={chain.id}
                onClick={() => toggleChain(chain.id)}
                disabled={isSweeping}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                  selectedChains.has(chain.id)
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
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <button
          onClick={handleFetchBalances}
          disabled={isLoading || isSweeping}
          className="text-xs text-zinc-400 hover:text-emerald-400 transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5 mx-auto"
        >
          {isLoading ? (
            <>
              <Loader size="sm" />
              <span>Fetching...</span>
            </>
          ) : (
            <>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh Balances</span>
            </>
          )}
        </button>

        {balances.length > 0 && (
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 p-4">
            <div className="absolute -top-12 -right-12 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
            <p className="text-xs uppercase tracking-wide text-emerald-400/70">Estimated Total</p>
            <p className="text-2xl font-semibold text-white mt-1">
              ${calculateTotalUSD().toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {filteredTokensWithBalance.length} token{filteredTokensWithBalance.length !== 1 ? "s" : ""} with balance on {selectedChains.size} chain{selectedChains.size !== 1 ? "s" : ""}
            </p>
          </div>
        )}

        {balances.length > 0 && sweepStep !== "success" && sweepStep !== "error" && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Sweep to USDC</p>
                <p className="text-xs text-zinc-400">
                  {totalSweepableTokens > 0
                    ? `${totalSweepableTokens} token${totalSweepableTokens !== 1 ? "s" : ""} available`
                    : "No sweepable tokens"}
                </p>
              </div>
              <div className="text-right text-xs text-zinc-500">
                TOSHI, SHIB, LDO → USDC
              </div>
            </div>

            {totalSweepableTokens > 0 && !isSweeping && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Amount to sweep</span>
                  <span className="text-xs font-medium text-emerald-400">{sweepPercentage}%</span>
                </div>
                <div className="relative">
                  <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-zinc-800 rounded-full overflow-hidden pointer-events-none">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-150"
                      style={{ width: `${((sweepPercentage - 25) / 75) * 100}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min="25"
                    max="100"
                    step="25"
                    value={sweepPercentage}
                    onChange={(e) => setSweepPercentage(Number(e.target.value))}
                    className="relative w-full h-1 bg-transparent rounded-full appearance-none cursor-pointer z-10
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-3
                      [&::-webkit-slider-thumb]:h-3
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-emerald-400
                      [&::-webkit-slider-thumb]:shadow-sm
                      [&::-webkit-slider-thumb]:shadow-emerald-500/50
                      [&::-webkit-slider-thumb]:transition-all
                      [&::-webkit-slider-thumb]:hover:bg-emerald-300
                      [&::-moz-range-thumb]:w-3
                      [&::-moz-range-thumb]:h-3
                      [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-emerald-400
                      [&::-moz-range-thumb]:border-0
                      [&::-moz-range-thumb]:shadow-sm
                      [&::-moz-range-thumb]:shadow-emerald-500/50"
                  />
                  <div className="flex justify-between mt-1">
                    {[25, 50, 75, 100].map((val) => (
                      <button
                        key={val}
                        onClick={() => setSweepPercentage(val)}
                        className={`text-[10px] transition-colors ${
                          sweepPercentage === val
                            ? "text-emerald-400"
                            : "text-zinc-600 hover:text-zinc-400"
                        }`}
                      >
                        {val}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {isSweeping && (
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <Loader size="sm" variant="bounce" />
                  <span className="text-sm text-zinc-300">
                    {stepMessages[sweepStep]}
                  </span>
                </div>
                <ProgressBar progress={stepProgress[sweepStep]} />
                {completedChains > 0 && (
                  <p className="text-xs text-zinc-400">
                    {completedChains} chain{completedChains !== 1 ? "s" : ""} completed
                  </p>
                )}
              </div>
            )}

            {sweepError && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-2">
                <p className="text-xs text-red-400">{sweepError}</p>
              </div>
            )}

            <Button
              onClick={handleDustSweep}
              disabled={isLoading || isSweeping || totalSweepableTokens === 0}
              className="w-full"
            >
              {isSweeping ? (
                <>
                  <Loader size="sm" variant="bounce" />
                  <span>Sweeping...</span>
                </>
              ) : (
                `Sweep ${sweepPercentage}% to USDC`
              )}
            </Button>
          </div>
        )}

        {sweepStep === "success" && (
          <div className="flex flex-col gap-4 py-5 px-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-lg animate-pulse" />
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30">
                  <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div>
                <p className="font-semibold text-white">Dust Sweep Complete!</p>
                <p className="text-xs text-zinc-400">
                  {transactionResults.filter(t => t.status === "success").length} transaction{transactionResults.filter(t => t.status === "success").length !== 1 ? "s" : ""} confirmed
                </p>
              </div>
            </div>

            {transactionResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Transactions</p>
                <div className="space-y-1.5">
                  {transactionResults.map((result, idx) => (
                    <a
                      key={idx}
                      href={`${EXPLORER_BASE_URL}/${result.chainId}/${result.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`group flex items-center justify-between p-2.5 rounded-lg border transition-all duration-200 ${
                        result.status === "success"
                          ? "bg-white/[0.02] border-white/10 hover:bg-white/[0.05] hover:border-emerald-500/30"
                          : "bg-red-500/5 border-red-500/20 hover:bg-red-500/10"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={getChainIcon(result.chainId)}
                          alt={result.chainName}
                          className="h-5 w-5 rounded-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none"
                          }}
                        />
                        <div>
                          <p className="text-sm font-medium text-white">{result.chainName}</p>
                          <p className="text-xs text-zinc-500 font-mono">
                            {result.txHash.slice(0, 8)}...{result.txHash.slice(-6)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {result.status === "success" ? (
                          <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            Success
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium uppercase tracking-wide text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                            Failed
                          </span>
                        )}
                        <ExternalLink className="h-3.5 w-3.5 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={resetSweep} variant="outline" size="sm" className="w-full">
              Done
            </Button>
          </div>
        )}

        {sweepStep === "error" && (
          <div className="flex flex-col gap-4 py-5 px-4 rounded-xl border border-red-500/20 bg-red-500/5">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-red-500/20 blur-lg animate-pulse" />
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20 border border-red-500/30">
                  <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
              <div>
                <p className="font-semibold text-white">Sweep Failed</p>
                <p className="text-xs text-zinc-400">{sweepError}</p>
              </div>
            </div>

            {transactionResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Transactions</p>
                <div className="space-y-1.5">
                  {transactionResults.map((result, idx) => (
                    <a
                      key={idx}
                      href={`${EXPLORER_BASE_URL}/${result.chainId}/${result.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`group flex items-center justify-between p-2.5 rounded-lg border transition-all duration-200 ${
                        result.status === "success"
                          ? "bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10"
                          : "bg-white/[0.02] border-white/10 hover:bg-white/[0.05] hover:border-red-500/30"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={getChainIcon(result.chainId)}
                          alt={result.chainName}
                          className="h-5 w-5 rounded-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none"
                          }}
                        />
                        <div>
                          <p className="text-sm font-medium text-white">{result.chainName}</p>
                          {result.txHash && (
                            <p className="text-xs text-zinc-500 font-mono">
                              {result.txHash.slice(0, 8)}...{result.txHash.slice(-6)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {result.status === "success" ? (
                          <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            Success
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium uppercase tracking-wide text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                            Failed
                          </span>
                        )}
                        <ExternalLink className="h-3.5 w-3.5 text-zinc-500 group-hover:text-red-400 transition-colors" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={resetSweep} variant="outline" size="sm" className="w-full">
              Try Again
            </Button>
          </div>
        )}

        {balances.length > 0 && sweepStep === "idle" && (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filteredTokensWithBalance.map((item) => {
              const isExpanded = expandedToken === item.token.symbol
              const chainsWithBalance = item.chains

              return (
                <div key={item.token.symbol} className="rounded-xl border border-white/10 overflow-hidden">
                  <button
                    onClick={() => setExpandedToken(isExpanded ? null : item.token.symbol)}
                    className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={item.token.icon}
                        alt={item.token.symbol}
                        className="h-8 w-8 rounded-full bg-zinc-800"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = "none"
                          target.nextElementSibling?.classList.remove("hidden")
                        }}
                      />
                      <div className="h-8 w-8 items-center justify-center rounded-full bg-zinc-700 hidden">
                        <span className="text-xs font-medium text-zinc-300">
                          {item.token.symbol.slice(0, 2)}
                        </span>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-white">
                          {item.token.symbol}
                        </p>
                        <p className="text-xs text-zinc-500">{item.token.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium tabular-nums text-white">
                          {formatDisplayBalance(item.formattedTotal)}
                        </p>
                        <div className="flex items-center justify-end gap-1">
                          {chainsWithBalance.slice(0, 3).map((chain) => (
                            <img
                              key={chain.chain.id}
                              src={chain.chain.icon}
                              alt={chain.chain.name}
                              title={chain.chain.name}
                              className="h-3.5 w-3.5 rounded-full"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none"
                              }}
                            />
                          ))}
                          {chainsWithBalance.length > 3 && (
                            <span className="text-[10px] text-zinc-500">+{chainsWithBalance.length - 3}</span>
                          )}
                        </div>
                      </div>
                      <svg
                        className={`h-4 w-4 text-zinc-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {isExpanded && chainsWithBalance.length > 0 && (
                    <div className="border-t border-white/5 bg-zinc-900/50">
                      {chainsWithBalance.map((chainBalance) => (
                        <div
                          key={chainBalance.chain.id}
                          className="flex items-center justify-between px-3 py-2.5 border-b border-white/5 last:border-b-0"
                        >
                          <div className="flex items-center gap-2.5">
                            <img
                              src={chainBalance.chain.icon}
                              alt={chainBalance.chain.name}
                              className="h-5 w-5 rounded-full"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none"
                              }}
                            />
                            <span className="text-xs text-zinc-400">
                              {chainBalance.chain.name}
                            </span>
                          </div>
                          <span className="text-xs font-medium tabular-nums text-zinc-300">
                            {formatDisplayBalance(chainBalance.formattedBalance)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {filteredBalances.filter(b => b.totalBalance === BigInt(0)).length > 0 && (
              <details className="rounded-xl border border-white/5">
                <summary className="px-3 py-2 text-xs text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors">
                  {filteredBalances.filter(b => b.totalBalance === BigInt(0)).length} tokens with zero balance
                </summary>
                <div className="px-3 pb-2 flex flex-wrap gap-2">
                  {filteredBalances.filter(b => b.totalBalance === BigInt(0)).map((item) => (
                    <div key={item.token.symbol} className="flex items-center gap-1.5 bg-white/5 rounded-full px-2 py-1">
                      <img
                        src={item.token.icon}
                        alt={item.token.symbol}
                        className="h-3.5 w-3.5 rounded-full opacity-50"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none"
                        }}
                      />
                      <span className="text-[10px] text-zinc-500">{item.token.symbol}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
