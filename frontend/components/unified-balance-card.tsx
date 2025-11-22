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

// Normalized token balance structure
interface NormalizedBalance {
  symbol: string
  balance: string
  chain: string
  decimals: number
  formattedBalance: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawBalanceResult = any

export function UnifiedBalanceCard() {
  const { isConnected, connector } = useAccount()
  const [network, setNetwork] = useState<NexusNetwork>(getCurrentNetwork())
  const [initialized, setInitialized] = useState(false)
  const [rawBalances, setRawBalances] = useState<RawBalanceResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDebug, setShowDebug] = useState(false)

  // Sync initialization state
  useEffect(() => {
    setInitialized(isInitialized())
  }, [])

  const handleNetworkSwitch = async (newNetwork: NexusNetwork) => {
    if (newNetwork === network) return

    setIsLoading(true)
    setError(null)
    setRawBalances(null)

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
      setRawBalances(null)
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
      const result = await getUnifiedBalances()
      console.log("=== NEXUS SDK RAW RESPONSE ===")
      console.log("Type:", typeof result)
      console.log("Is Array:", Array.isArray(result))
      console.log("Keys:", result ? Object.keys(result) : "null")
      console.log("Full response:", JSON.stringify(result, null, 2))
      console.log("==============================")
      setRawBalances(result)
    } catch (e) {
      console.error("Fetch balances error:", e)
      setError(e instanceof Error ? e.message : "Failed to fetch balances")
    } finally {
      setIsFetching(false)
    }
  }, [initialized])

  // Normalize balances from various SDK response formats
  const normalizeBalances = (data: RawBalanceResult): NormalizedBalance[] => {
    if (!data) return []

    const results: NormalizedBalance[] = []

    // Helper to format balance
    const formatBal = (balance: string | number | bigint, decimals: number): string => {
      try {
        const balStr = String(balance)
        const num = parseFloat(balStr) / Math.pow(10, decimals)
        if (isNaN(num) || num === 0) return "0"
        if (num < 0.0001) return "<0.0001"
        return num.toLocaleString(undefined, { maximumFractionDigits: 6 })
      } catch {
        return String(balance)
      }
    }

    // Case 1: Direct array of tokens
    if (Array.isArray(data)) {
      for (const item of data) {
        results.push({
          symbol: item.symbol || item.token || item.name || "Unknown",
          balance: String(item.balance || item.amount || item.value || "0"),
          chain: item.chain || item.chainName || item.network || item.chainId || "Unknown",
          decimals: item.decimals || 18,
          formattedBalance: formatBal(item.balance || item.amount || item.value || "0", item.decimals || 18),
        })
      }
      return results
    }

    // Case 2: Object with balances array
    if (typeof data === 'object') {
      // Check for nested balances array
      if (data.balances && Array.isArray(data.balances)) {
        return normalizeBalances(data.balances)
      }

      // Check for tokens array
      if (data.tokens && Array.isArray(data.tokens)) {
        return normalizeBalances(data.tokens)
      }

      // Check for data array
      if (data.data && Array.isArray(data.data)) {
        return normalizeBalances(data.data)
      }

      // Case 3: Object keyed by chain name (e.g., { ethereum: [...], polygon: [...] })
      // or keyed by token symbol (e.g., { USDC: { balance, chain }, ETH: { balance, chain } })
      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value)) {
          // Chain-keyed format: { ethereum: [{ symbol, balance }] }
          for (const item of value as any[]) {
            results.push({
              symbol: item.symbol || item.token || item.name || "Unknown",
              balance: String(item.balance || item.amount || item.value || "0"),
              chain: item.chain || item.chainName || key,
              decimals: item.decimals || 18,
              formattedBalance: formatBal(item.balance || item.amount || item.value || "0", item.decimals || 18),
            })
          }
        } else if (typeof value === 'object' && value !== null) {
          // Token-keyed format: { USDC: { balance: "100", chain: "ethereum" } }
          const v = value as any
          if (v.balance !== undefined || v.amount !== undefined) {
            results.push({
              symbol: key,
              balance: String(v.balance || v.amount || v.value || "0"),
              chain: v.chain || v.chainName || v.network || "Unknown",
              decimals: v.decimals || 18,
              formattedBalance: formatBal(v.balance || v.amount || v.value || "0", v.decimals || 18),
            })
          }
        }
      }
    }

    return results
  }

  const normalizedBalances = normalizeBalances(rawBalances)

  // Filter out zero balances for cleaner display
  const nonZeroBalances = normalizedBalances.filter(b => {
    const val = parseFloat(b.balance)
    return !isNaN(val) && val > 0
  })

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

        {/* Balances Display */}
        {rawBalances && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Your Balances ({nonZeroBalances.length} tokens)
              </h4>
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                {showDebug ? "Hide" : "Debug"}
              </button>
            </div>

            {/* Debug Panel */}
            {showDebug && (
              <div className="rounded-lg bg-zinc-100 p-3 dark:bg-zinc-800">
                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                  Raw SDK Response:
                </p>
                <pre className="overflow-auto max-h-48 text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                  {JSON.stringify(rawBalances, null, 2)}
                </pre>
              </div>
            )}

            {nonZeroBalances.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {nonZeroBalances.map((token, idx) => (
                  <div
                    key={`${token.chain}-${token.symbol}-${idx}`}
                    className="flex items-center justify-between rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                          {token.symbol.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {token.symbol}
                        </p>
                        <p className="text-xs text-zinc-500">{token.chain}</p>
                      </div>
                    </div>
                    <p className="text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                      {token.formattedBalance}
                    </p>
                  </div>
                ))}
              </div>
            ) : normalizedBalances.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <p className="text-xs text-zinc-500 mb-2">All balances (including zero):</p>
                {normalizedBalances.map((token, idx) => (
                  <div
                    key={`${token.chain}-${token.symbol}-${idx}`}
                    className="flex items-center justify-between rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                          {token.symbol.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {token.symbol}
                        </p>
                        <p className="text-xs text-zinc-500">{token.chain}</p>
                      </div>
                    </div>
                    <p className="text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                      {token.formattedBalance}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
                <p className="text-sm text-zinc-500 text-center">Could not parse balances</p>
                <p className="mt-1 text-xs text-zinc-400 text-center">
                  Check the debug panel for raw response
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
