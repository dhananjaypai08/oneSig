"use client"

import Link from "next/link"
import { useEffect } from "react"
import { SwapCard } from "@/components/swap-card"
import { PortfolioCard } from "@/components/portfolio-card"
import { Toaster } from "@/components/ui/toaster"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { ArrowLeft, Zap, Shield } from "lucide-react"

// Sound URLs from mixkit (royalty-free)
const SOUNDS = {
  click: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
  success: "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
}

// Sound utility with preloading
const audioCache: { [key: string]: HTMLAudioElement } = {}

const playSound = (type: "click" | "success") => {
  if (typeof window === "undefined") return

  try {
    if (!audioCache[type]) {
      audioCache[type] = new Audio(SOUNDS[type])
      audioCache[type].volume = type === "success" ? 0.5 : 0.2
    }
    audioCache[type].currentTime = 0
    audioCache[type].play().catch(() => {})
  } catch {
    // Silently fail if audio doesn't work
  }
}

export default function AppPage() {
  useEffect(() => {
    // Play ambient sound on mount
    playSound("click")
  }, [])

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Enhanced Animated Background with Depth */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Base gradient for depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950 to-black" />

        {/* Subtle radial gradient for center focus */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.03)_0%,transparent_70%)]" />

        {/* Morphing gradient orbs */}
        <div className="absolute top-[-10%] left-[10%] w-[600px] h-[600px] bg-emerald-500/[0.04] morphing-gradient blur-[120px]" />
        <div className="absolute bottom-[-5%] right-[5%] w-[500px] h-[500px] bg-emerald-600/[0.03] morphing-gradient blur-[100px]" style={{ animationDelay: "-5s" }} />
        <div className="absolute top-[40%] left-[60%] w-[400px] h-[400px] bg-emerald-400/[0.02] morphing-gradient blur-[80px]" style={{ animationDelay: "-10s" }} />

        {/* Floating particles */}
        <div className="absolute top-[20%] left-[15%] w-1 h-1 bg-emerald-400/40 rounded-full floating" style={{ animationDelay: "0s" }} />
        <div className="absolute top-[60%] left-[80%] w-1.5 h-1.5 bg-emerald-500/30 rounded-full floating" style={{ animationDelay: "-2s" }} />
        <div className="absolute top-[35%] left-[70%] w-1 h-1 bg-emerald-400/25 rounded-full floating" style={{ animationDelay: "-4s" }} />
        <div className="absolute top-[75%] left-[25%] w-0.5 h-0.5 bg-emerald-300/35 rounded-full floating" style={{ animationDelay: "-1s" }} />
        <div className="absolute top-[45%] left-[40%] w-1 h-1 bg-emerald-400/20 rounded-full floating" style={{ animationDelay: "-3s" }} />

        {/* Subtle grid pattern with fade */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)`,
            backgroundSize: "80px 80px",
            maskImage: "radial-gradient(ellipse at center, black 0%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 0%, transparent 80%)"
          }}
        />

        {/* Noise texture for depth */}
        <div className="absolute inset-0 noise-texture" />

        {/* Vignette overlay */}
        <div className="absolute inset-0 vignette opacity-60" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-3 group"
            onClick={() => playSound("click")}
          >
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

          {/* Center - Back Link */}
          <Link
            href="/"
            onClick={() => playSound("click")}
            className="hidden md:flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          {/* Connect Button */}
          <ConnectButton.Custom>
            {({
              account,
              chain,
              openAccountModal,
              openChainModal,
              openConnectModal,
              mounted: walletMounted,
            }) => {
              const ready = walletMounted
              const connected = ready && account && chain

              return (
                <div
                  {...(!ready && {
                    "aria-hidden": true,
                    style: {
                      opacity: 0,
                      pointerEvents: "none",
                      userSelect: "none",
                    },
                  })}
                >
                  {(() => {
                    if (!connected) {
                      return (
                        <button
                          onClick={() => {
                            playSound("click")
                            openConnectModal()
                          }}
                          className="rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                        >
                          Connect Wallet
                        </button>
                      )
                    }

                    if (chain.unsupported) {
                      return (
                        <button
                          onClick={() => {
                            playSound("click")
                            openChainModal()
                          }}
                          className="rounded-full bg-red-500/20 border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/30 transition-colors"
                        >
                          Wrong network
                        </button>
                      )
                    }

                    return (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            playSound("click")
                            openChainModal()
                          }}
                          className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                        >
                          {chain.hasIcon && chain.iconUrl && (
                            <img
                              alt={chain.name ?? "Chain"}
                              src={chain.iconUrl}
                              className="w-4 h-4 rounded-full"
                            />
                          )}
                          <span className="hidden sm:inline">{chain.name}</span>
                        </button>

                        <button
                          onClick={() => {
                            playSound("click")
                            openAccountModal()
                          }}
                          className="rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-medium text-white hover:shadow-emerald-500/30 hover:shadow-lg transition-all"
                        >
                          {account.displayName}
                        </button>
                      </div>
                    )
                  })()}
                </div>
              )
            }}
          </ConnectButton.Custom>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 px-4 md:px-6 py-8 md:py-12">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 md:mb-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-medium text-emerald-400">Live</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                <Shield className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-xs font-medium text-zinc-400">Protected</span>
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold text-white tracking-tight">
              Trade & Protect
            </h1>
            <p className="mt-2 text-zinc-400 max-w-xl">
              One-click swaps across chains. Convert to USDC instantly.
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Swap Card Wrapper */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
              <div className="relative rounded-2xl border border-white/10 bg-zinc-900/80 backdrop-blur-xl overflow-hidden">
                <SwapCard />
              </div>
            </div>

            {/* Portfolio Card Wrapper */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
              <div className="relative rounded-2xl border border-white/10 bg-zinc-900/80 backdrop-blur-xl overflow-hidden">
                <PortfolioCard />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            <span className="text-emerald-400">oneSig</span> - One signature to safety
          </p>
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <a href="https://uniswap.org" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">
              Uniswap
            </a>
            <a href="https://docs.ethereuminteroplayer.com/overview.html" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">
              Ethereum Interop Layer
            </a>
          </div>
        </div>
      </footer>

      <Toaster />
    </div>
  )
}
