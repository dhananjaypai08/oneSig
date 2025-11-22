"use client"

import { TransferCard } from "@/components/transfer-card"
import { Toaster } from "@/components/ui/toaster"

export default function Home() {
  return (
    <>
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
        <header className="mb-8 text-center">
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-500">
            Sepolia Testnet
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            OmniGator
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            EIP-7702 Smart Account Transfers
          </p>
        </header>

        <main className="w-full max-w-md">
          <TransferCard />
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
            {" "}&{" "}
            <a
              href="https://www.rainbowkit.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              RainbowKit
            </a>
          </p>
        </footer>
      </div>
      <Toaster />
    </>
  )
}
