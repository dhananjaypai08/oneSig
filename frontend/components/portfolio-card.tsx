"use client"

import { useState } from "react"
import { useAccount } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import type { Address } from "viem"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader } from "@/components/ui/loader"
import { readAllBalances, formatDisplayBalance, type AggregatedBalance } from "@/lib/balance-reader"
import { SUPPORTED_CHAINS } from "@/lib/tokens"

export function PortfolioCard() {
  const { address, isConnected } = useAccount()
  const [balances, setBalances] = useState<AggregatedBalance[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedToken, setExpandedToken] = useState<string | null>(null)

  const handleFetchBalances = async () => {
    if (!address) {
      setError("Please connect your wallet first")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await readAllBalances(address as Address)
      console.log("Portfolio balances:", result)
      setBalances(result)
    } catch (e) {
      console.error("Fetch balances error:", e)
      setError(e instanceof Error ? e.message : "Failed to fetch balances")
    } finally {
      setIsLoading(false)
    }
  }

  const tokensWithBalance = balances.filter(b => b.totalBalance > BigInt(0))

  // Calculate total USD value (simplified - assumes 1:1 for stablecoins, would need price feed for real value)
  const calculateTotalUSD = (): number => {
    return balances.reduce((sum, b) => {
      const balance = parseFloat(b.formattedTotal)
      // Simple heuristic: stablecoins are ~$1, ETH needs a price feed
      if (b.token.symbol === 'USDC' || b.token.symbol === 'USDT' || b.token.symbol === 'DAI') {
        return sum + balance
      }
      // For ETH/WETH, we'd need a price feed - using placeholder
      if (b.token.symbol === 'ETH' || b.token.symbol === 'WETH') {
        return sum + balance * 2500 // Placeholder ETH price
      }
      return sum
    }, 0)
  }

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
              {SUPPORTED_CHAINS.map(c => c.name).join(' • ')}
            </CardDescription>
          </div>
          <ConnectButton
            accountStatus="address"
            chainStatus="icon"
            showBalance={false}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Fetch Button */}
        <Button
          onClick={handleFetchBalances}
          disabled={isLoading}
          className="w-full"
          size="sm"
        >
          {isLoading ? (
            <>
              <Loader size="sm" />
              <span>Fetching Balances...</span>
            </>
          ) : (
            "Fetch Balances"
          )}
        </Button>

        {/* Portfolio Summary */}
        {balances.length > 0 && (
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 p-4">
            <div className="absolute -top-12 -right-12 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
            <p className="text-xs uppercase tracking-wide text-emerald-400/70">Estimated Total</p>
            <p className="text-2xl font-semibold text-white mt-1">
              ${calculateTotalUSD().toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {tokensWithBalance.length} token{tokensWithBalance.length !== 1 ? "s" : ""} with balance
            </p>
          </div>
        )}

        {/* Token List */}
        {balances.length > 0 && (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {tokensWithBalance.map((item) => {
              const isExpanded = expandedToken === item.token.symbol
              const chainsWithBalance = item.chains

              return (
                <div key={item.token.symbol} className="rounded-xl border border-white/10 overflow-hidden">
                  {/* Token Header */}
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

                  {/* Chain Breakdown */}
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

            {/* Zero balance tokens */}
            {balances.filter(b => b.totalBalance === BigInt(0)).length > 0 && (
              <details className="rounded-xl border border-white/5">
                <summary className="px-3 py-2 text-xs text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors">
                  {balances.filter(b => b.totalBalance === BigInt(0)).length} tokens with zero balance
                </summary>
                <div className="px-3 pb-2 flex flex-wrap gap-2">
                  {balances.filter(b => b.totalBalance === BigInt(0)).map((item) => (
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
