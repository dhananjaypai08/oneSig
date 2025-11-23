"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Zap, RefreshCw, ArrowDownUp } from "lucide-react"
import { wrapEthToWeth, unwrapWethToEth, getZircuitBalances } from "@/utils/sendZircuit"
import { Button } from "@/components/ui/button"
import { Loader, ProgressBar } from "@/components/ui/loader"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"

// Token icons
const TOKEN_ICONS = {
  ETH: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  WETH: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
}

// Success sound
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

type SwapStep = "idle" | "swapping" | "confirming" | "success" | "error"

const stepProgress: Record<SwapStep, number> = {
  idle: 0,
  swapping: 50,
  confirming: 75,
  success: 100,
  error: 0,
}

const stepMessages: Record<SwapStep, string> = {
  idle: "",
  swapping: "Processing transaction...",
  confirming: "Waiting for confirmation...",
  success: "Transaction complete!",
  error: "Transaction failed",
}

export default function NativeSwapPage() {
  const { toast } = useToast()

  const [isWrap, setIsWrap] = useState(true)
  const [amount, setAmount] = useState("")
  const [step, setStep] = useState<SwapStep>("idle")
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [balances, setBalances] = useState<{ ethBalance: string; wethBalance: string; address: string } | null>(null)
  const [loadingBalances, setLoadingBalances] = useState(true)

  const isLoading = ["swapping", "confirming"].includes(step)

  useEffect(() => {
    const fetchBalances = async () => {
      setLoadingBalances(true)
      try {
        const data = await getZircuitBalances()
        setBalances(data)
      } catch (e) {
        console.error("Failed to fetch balances:", e)
      } finally {
        setLoadingBalances(false)
      }
    }
    fetchBalances()
  }, [step])

  const fromToken = isWrap ? "ETH" : "WETH"
  const toToken = isWrap ? "WETH" : "ETH"
  const fromBalance = isWrap ? balances?.ethBalance : balances?.wethBalance
  const toBalance = isWrap ? balances?.wethBalance : balances?.ethBalance

  const handleSwap = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount")
      return
    }

    setError(null)
    setTxHash(null)
    setStep("swapping")

    try {
      let hash: string

      if (isWrap) {
        hash = await wrapEthToWeth(amount)
      } else {
        hash = await unwrapWethToEth(amount)
      }

      setStep("confirming")
      setTxHash(hash)

      setStep("success")
      playSuccessSound()
      toast({
        title: isWrap ? "Wrap complete!" : "Unwrap complete!",
        description: `${isWrap ? "Wrapped" : "Unwrapped"} ${amount} ${fromToken} to ${toToken}`,
        variant: "success",
      })
    } catch (e: unknown) {
      console.error("Transaction error:", e)
      setStep("error")
      const errorMessage = e instanceof Error ? e.message : "Transaction failed"
      setError(errorMessage.includes("user rejected") ? "Transaction rejected" : errorMessage)
    }
  }

  const reset = () => {
    setStep("idle")
    setError(null)
    setTxHash(null)
    setAmount("")
  }

  const toggleDirection = () => {
    setIsWrap(!isWrap)
    setAmount("")
  }

  const setMaxAmount = () => {
    if (fromBalance) {
      const max = isWrap ? Math.max(0, parseFloat(fromBalance) - 0.001) : parseFloat(fromBalance)
      setAmount(max.toString())
    }
  }

  const formatBalance = (balance: string | undefined) => {
    if (!balance) return "0.000000"
    const num = parseFloat(balance)
    return num.toFixed(6)
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.05)_0%,transparent_70%)]" />
        <div className="absolute top-[-10%] left-[10%] w-[800px] h-[800px] bg-emerald-500/[0.04] morphing-gradient blur-[150px]" />
        <div className="absolute bottom-[-5%] right-[5%] w-[600px] h-[600px] bg-emerald-600/[0.03] morphing-gradient blur-[120px]" style={{ animationDelay: "-5s" }} />

        {/* Floating particles */}
        <div className="absolute top-[20%] left-[15%] w-2 h-2 bg-emerald-400/40 rounded-full floating" style={{ animationDelay: "0s" }} />
        <div className="absolute top-[60%] left-[80%] w-2 h-2 bg-emerald-500/30 rounded-full floating" style={{ animationDelay: "-2s" }} />
        <div className="absolute top-[35%] left-[70%] w-1.5 h-1.5 bg-emerald-400/25 rounded-full floating" style={{ animationDelay: "-4s" }} />
        <div className="absolute top-[75%] left-[25%] w-1 h-1 bg-emerald-300/35 rounded-full floating" style={{ animationDelay: "-1s" }} />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors">
              oneSig
            </span>
          </Link>

          <Link
            href="/app"
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to App
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 px-4 md:px-6 py-12 md:py-16">
        <div className="max-w-lg mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Zircuit Network</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-3">
              Native Swap
            </h1>
            <p className="text-base text-zinc-400 max-w-md mx-auto">
              Wrap and unwrap ETH to WETH using EIP-7702 Smart Account
            </p>
          </div>

          {/* Smart Account Info */}
          {balances && (
            <div className="mb-6 p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 uppercase tracking-wider">Smart Account</span>
                <span className="text-xs text-zinc-400 font-mono">
                  {balances.address.slice(0, 6)}...{balances.address.slice(-4)}
                </span>
              </div>
            </div>
          )}

          {/* Swap Card */}
          <div className="relative">
            <div className="absolute -inset-px bg-gradient-to-b from-white/10 to-white/5 rounded-2xl" />
            <div className="relative rounded-2xl bg-zinc-900/95 backdrop-blur-xl p-6">
              {step === "success" ? (
                <div className="flex flex-col items-center gap-5 py-6">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl animate-pulse" />
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30">
                      <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-white text-xl mb-1">Transaction Complete</p>
                    <p className="text-sm text-zinc-400">
                      {isWrap ? "Wrapped" : "Unwrapped"} {amount} {fromToken} to {toToken}
                    </p>
                  </div>
                  {txHash && (
                    <a
                      href={`https://explorer.zircuit.com/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      View on Explorer →
                    </a>
                  )}
                  <Button onClick={reset} variant="outline" className="mt-2">
                    New Transaction
                  </Button>
                </div>
              ) : step === "error" ? (
                <div className="flex flex-col items-center gap-5 py-6">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-red-500/20 blur-xl animate-pulse" />
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 border border-red-500/30">
                      <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-white text-xl mb-1">Transaction Failed</p>
                    <p className="text-sm text-zinc-400 max-w-xs">{error}</p>
                  </div>
                  <Button onClick={reset} variant="outline" className="mt-2">
                    Try Again
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* From Section */}
                  <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-zinc-500">From</span>
                      <button
                        onClick={setMaxAmount}
                        disabled={isLoading || !fromBalance}
                        className="text-xs text-zinc-500 hover:text-emerald-400 transition-colors"
                      >
                        Balance: {loadingBalances ? "..." : formatBalance(fromBalance)} {fromToken}
                      </button>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
                          <Image
                            src={TOKEN_ICONS[fromToken as keyof typeof TOKEN_ICONS]}
                            alt={fromToken}
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-lg font-semibold text-white">{fromToken}</span>
                      </div>
                      <div className="flex-1 relative">
                        <input
                          type="number"
                          placeholder="0.00"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          disabled={isLoading}
                          className="w-full bg-transparent text-right text-2xl font-medium text-white placeholder:text-zinc-600 focus:outline-none"
                        />
                      </div>
                      <button
                        onClick={setMaxAmount}
                        disabled={isLoading || !fromBalance}
                        className="px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 rounded-lg hover:bg-emerald-500/20 transition-colors shrink-0"
                      >
                        MAX
                      </button>
                    </div>
                  </div>

                  {/* Swap Direction Button */}
                  <div className="flex justify-center -my-2 relative z-10">
                    <button
                      onClick={toggleDirection}
                      disabled={isLoading}
                      className="p-3 rounded-xl bg-zinc-800 border border-white/10 hover:border-emerald-500/30 hover:bg-zinc-700 transition-all duration-200 group"
                    >
                      <ArrowDownUp className="w-5 h-5 text-zinc-400 group-hover:text-emerald-400 group-hover:rotate-180 transition-all duration-300" />
                    </button>
                  </div>

                  {/* To Section */}
                  <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-zinc-500">To</span>
                      <span className="text-xs text-zinc-500">
                        Balance: {loadingBalances ? "..." : formatBalance(toBalance)} {toToken}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
                          <Image
                            src={TOKEN_ICONS[toToken as keyof typeof TOKEN_ICONS]}
                            alt={toToken}
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-lg font-semibold text-white">{toToken}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-right text-2xl font-medium text-white">
                          {amount || "0.00"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Exchange Rate Info */}
                  <div className="flex items-center justify-between px-1 py-2">
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                      <RefreshCw className="w-4 h-4" />
                      <span>1 {fromToken} = 1 {toToken}</span>
                    </div>
                    <span className="text-xs text-emerald-400/80">No fees</span>
                  </div>

                  {error && (
                    <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  )}

                  {isLoading && (
                    <div className="space-y-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-4">
                      <div className="flex items-center gap-3">
                        <Loader size="sm" variant="bounce" />
                        <span className="text-sm text-zinc-300">{stepMessages[step]}</span>
                      </div>
                      <ProgressBar progress={stepProgress[step]} />
                    </div>
                  )}

                  <Button
                    onClick={handleSwap}
                    disabled={isLoading || !amount || parseFloat(amount) <= 0}
                    className="w-full h-12 text-base font-semibold rounded-xl"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader size="sm" variant="bounce" />
                        <span>Processing</span>
                      </>
                    ) : (
                      <>{isWrap ? "Wrap ETH to WETH" : "Unwrap WETH to ETH"}</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Info Section */}
          <div className="mt-6 p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <h3 className="text-sm font-medium text-white mb-2">How it works</h3>
            <ul className="space-y-2 text-xs text-zinc-500">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">•</span>
                <span>ETH and WETH are exchanged at a 1:1 ratio with no slippage</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">•</span>
                <span>Transaction is executed via your EIP-7702 Smart Account</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">•</span>
                <span>Gas is sponsored - no fees required</span>
              </li>
            </ul>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <p className="text-xs text-zinc-600">
            <span className="text-emerald-500">oneSig</span> • Native Swap
          </p>
          <a
            href="https://explorer.zircuit.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-600 hover:text-emerald-400 transition-colors"
          >
            Zircuit Explorer
          </a>
        </div>
      </footer>

      <Toaster />
    </div>
  )
}
