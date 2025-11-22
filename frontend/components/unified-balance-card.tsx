"use client"

import { useState, useCallback, useEffect } from "react"
import { useAccount } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader } from "@/components/ui/loader"
import {
  type NexusNetwork,
  getCurrentNetwork,
  isInitialized,
  initializeWithProvider,
  switchNetwork,
  getUnifiedBalances,
  deinit,
} from "@/lib/nexus"

interface ChainInfo {
  id: number
  logo: string
  name: string
}

interface ChainBreakdown {
  balance: string
  balanceInFiat: number
  chain: ChainInfo
  contractAddress: string
  decimals: number
  universe: number
}

interface UnifiedToken {
  abstracted: boolean
  balance: string
  balanceInFiat: number
  breakdown: ChainBreakdown[]
  decimals: number
  icon: string
  symbol: string
}

type NexusBalanceResponse = UnifiedToken[]

export function UnifiedBalanceCard() {
  const { isConnected, connector } = useAccount()
  const [network, setNetwork] = useState<NexusNetwork>(getCurrentNetwork())
  const [initialized, setInitialized] = useState(false)
  const [tokens, setTokens] = useState<UnifiedToken[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedToken, setExpandedToken] = useState<string | null>(null)

  useEffect(() => {
    setInitialized(isInitialized())
  }, [])

  const handleNetworkSwitch = async (newNetwork: NexusNetwork) => {
    if (newNetwork === network) return

    setIsLoading(true)
    setError(null)
    setTokens([])

    try {
      const provider = await connector?.getProvider()
      await switchNetwork(newNetwork, provider)
      setNetwork(newNetwork)
      setInitialized(isInitialized())
    } catch (e) {
      console.error("Network switch error:", e)
      setError(e instanceof Error ? e.message : "Failed to switch network")
    } finally {
      setIsLoading(false)
    }
  }

  const handleInitialize = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const provider = await connector?.getProvider()
      if (!provider) throw new Error("No provider found. Please connect your wallet.")
      await initializeWithProvider(provider)
      setInitialized(true)
    } catch (e) {
      console.error("Initialize error:", e)
      setError(e instanceof Error ? e.message : "Failed to initialize")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeinit = async () => {
    setIsLoading(true)
    setError(null)

    try {
      await deinit()
      setInitialized(false)
      setTokens([])
    } catch (e) {
      console.error("Deinit error:", e)
      setError(e instanceof Error ? e.message : "Failed to de-initialize")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFetchBalances = useCallback(async () => {
    if (!initialized) {
      setError("Please initialize the SDK first")
      return
    }

    setIsFetching(true)
    setError(null)

    try {
      const result = await getUnifiedBalances() as NexusBalanceResponse
      console.log("Nexus balances:", result)
      setTokens(Array.isArray(result) ? result : [])
    } catch (e) {
      console.error("Fetch balances error:", e)
      setError(e instanceof Error ? e.message : "Failed to fetch balances")
    } finally {
      setIsFetching(false)
    }
  }, [initialized])

  const formatBalance = (balance: string): string => {
    const num = parseFloat(balance)
    if (isNaN(num) || num === 0) return "0"
    if (num < 0.0001) return "<0.0001"
    if (num < 1) return num.toFixed(6)
    if (num < 1000) return num.toFixed(4)
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  const formatFiat = (value: number): string => {
    if (value === 0) return "$0.00"
    if (value < 0.01) return "<$0.01"
    return `$${value.toFixed(2)}`
  }

  const tokensWithBalance = tokens.filter(t => parseFloat(t.balance) > 0)

  const totalValue = tokens.reduce((sum, t) => sum + (t.balanceInFiat || 0), 0)

  if (!isConnected) {
    return (
      <Card className="w-full">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">Unified Balances</CardTitle>
          <CardDescription>
            View your token balances across multiple chains
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
            <CardTitle>Unified Balances</CardTitle>
            <CardDescription>Powered by Avail Nexus</CardDescription>
          </div>
          <ConnectButton
            accountStatus="address"
            chainStatus="icon"
            showBalance={false}
          />
        </div>

        {/* Network Toggle */}
        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-zinc-500">Network:</span>
          <div className="flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
            <button
              onClick={() => handleNetworkSwitch("mainnet")}
              disabled={isLoading}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                network === "mainnet"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              Mainnet
            </button>
            <button
              onClick={() => handleNetworkSwitch("testnet")}
              disabled={isLoading}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                network === "testnet"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              Testnet
            </button>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="mt-3 flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${initialized ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-600"}`} />
          <span className="text-xs text-zinc-500">
            {initialized ? "SDK Initialized" : "SDK Not Initialized"}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 dark:bg-red-950 dark:border-red-800">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Init/Deinit Controls */}
        <div className="flex gap-2">
          {!initialized ? (
            <Button
              onClick={handleInitialize}
              disabled={isLoading}
              className="flex-1"
              size="sm"
            >
              {isLoading ? (
                <>
                  <Loader size="sm" />
                  <span>Initializing...</span>
                </>
              ) : (
                "Initialize Nexus"
              )}
            </Button>
          ) : (
            <>
              <Button
                onClick={handleFetchBalances}
                disabled={isFetching || isLoading}
                className="flex-1"
                size="sm"
              >
                {isFetching ? (
                  <>
                    <Loader size="sm" />
                    <span>Fetching...</span>
                  </>
                ) : (
                  "Fetch Balances"
                )}
              </Button>
              <Button
                onClick={handleDeinit}
                disabled={isLoading || isFetching}
                variant="secondary"
                size="sm"
              >
                Disconnect
              </Button>
            </>
          )}
        </div>

        {/* Portfolio Summary */}
        {tokens.length > 0 && (
          <div className="rounded-lg bg-gradient-to-br from-zinc-100 to-zinc-50 p-4 dark:from-zinc-800 dark:to-zinc-900">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Total Balance</p>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              ${totalValue.toFixed(2)}
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              {tokensWithBalance.length} token{tokensWithBalance.length !== 1 ? "s" : ""} across multiple chains
            </p>
          </div>
        )}

        {/* Token List */}
        {tokens.length > 0 && (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {tokensWithBalance.map((token) => {
              const isExpanded = expandedToken === token.symbol
              const chainsWithBalance = token.breakdown.filter(b => parseFloat(b.balance) > 0)

              return (
                <div key={token.symbol} className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  {/* Token Header */}
                  <button
                    onClick={() => setExpandedToken(isExpanded ? null : token.symbol)}
                    className="w-full flex items-center justify-between p-3 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {token.icon ? (
                        <img
                          src={token.icon}
                          alt={token.symbol}
                          className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = "none"
                            target.nextElementSibling?.classList.remove("hidden")
                          }}
                        />
                      ) : null}
                      <div className={`h-8 w-8 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 ${token.icon ? "hidden" : "flex"}`}>
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                          {token.symbol.slice(0, 2)}
                        </span>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {token.symbol}
                        </p>
                        <div className="flex items-center gap-1">
                          {chainsWithBalance.slice(0, 3).map((chain) => (
                            <img
                              key={chain.chain.id}
                              src={chain.chain.logo}
                              alt={chain.chain.name}
                              title={chain.chain.name}
                              className="h-3.5 w-3.5 rounded-full"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none"
                              }}
                            />
                          ))}
                          {chainsWithBalance.length > 3 && (
                            <span className="text-[10px] text-zinc-400">+{chainsWithBalance.length - 3}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                          {formatBalance(token.balance)}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {formatFiat(token.balanceInFiat)}
                        </p>
                      </div>
                      <svg
                        className={`h-4 w-4 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
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
                    <div className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                      {chainsWithBalance.map((chain, idx) => (
                        <div
                          key={`${chain.chain.id}-${idx}`}
                          className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0"
                        >
                          <div className="flex items-center gap-2.5">
                            {chain.chain.logo ? (
                              <img
                                src={chain.chain.logo}
                                alt={chain.chain.name}
                                className="h-5 w-5 rounded-full"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none"
                                }}
                              />
                            ) : (
                              <div className="h-5 w-5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                            )}
                            <span className="text-xs text-zinc-600 dark:text-zinc-400">
                              {chain.chain.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium tabular-nums text-zinc-700 dark:text-zinc-300">
                              {formatBalance(chain.balance)}
                            </span>
                            <span className="text-xs text-zinc-400 min-w-[50px] text-right">
                              {formatFiat(chain.balanceInFiat)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Zero balance tokens */}
            {tokens.filter(t => parseFloat(t.balance) === 0).length > 0 && (
              <details className="rounded-lg border border-zinc-200 dark:border-zinc-800">
                <summary className="px-3 py-2 text-xs text-zinc-400 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300">
                  {tokens.filter(t => parseFloat(t.balance) === 0).length} tokens with zero balance
                </summary>
                <div className="px-3 pb-2 flex flex-wrap gap-2">
                  {tokens.filter(t => parseFloat(t.balance) === 0).map((token) => (
                    <div key={token.symbol} className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full px-2 py-1">
                      {token.icon ? (
                        <img src={token.icon} alt={token.symbol} className="h-3.5 w-3.5 rounded-full opacity-50" />
                      ) : (
                        <div className="h-3.5 w-3.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                      )}
                      <span className="text-[10px] text-zinc-400">{token.symbol}</span>
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
