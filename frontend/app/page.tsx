"use client"

import { SwapCard } from "@/components/swap-card"
import { UnifiedBalanceCard } from "@/components/unified-balance-card"
import { Toaster } from "@/components/ui/toaster"

export default function Home() {
  return (
    <>
      <div className="flex min-h-screen flex-col items-center px-4 py-16">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            OmniGator
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Cross-chain swaps & unified balances
          </p>
        </header>

        <main className="w-full max-w-4xl space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <SwapCard />
            <UnifiedBalanceCard />
          </div>
        </main>

        <footer className="mt-8 text-center text-xs text-zinc-400">
          <p>
            Built with{" "}
            <a
              href="https://viem.sh"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              viem
            </a>
            ,{" "}
            <a
              href="https://www.rainbowkit.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              RainbowKit
            </a>
            ,{" "}
            <a
              href="https://uniswap.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              Uniswap
            </a>
            {" "}&{" "}
            <a
              href="https://docs.availproject.org/docs/nexus"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              Avail Nexus
            </a>
          </p>
        </footer>
      </div>
      <Toaster />
    </>
  )
}
