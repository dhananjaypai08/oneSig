"use client"

import Link from "next/link"
import { Hero } from "@/components/Hero"
import { Toaster } from "@/components/ui/toaster"
import { ArrowUpRight, Zap, Shield, ArrowRight, Clock, Repeat } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Hero />

      {/* CTA Section */}
      <section className="relative px-4 py-20 md:py-28 bg-zinc-950 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-emerald-600/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400">Instant Protection</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-semibold text-white tracking-tight">
            Never Get Liquidated
            <br />
            <span className="text-emerald-400">Again</span>
          </h2>
          <p className="mt-5 text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            One click converts your volatile assets to USDC across any chain.
            No manual bridging. No multiple transactions. Just instant safety.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/app"
              className="group inline-flex items-center gap-2 rounded-full bg-emerald-600 px-8 py-4 text-base font-medium text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-500 hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all duration-200"
            >
              Protect Now
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="https://docs.availproject.org/docs/nexus"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full border border-white/10 bg-white/5 backdrop-blur-sm px-6 py-3.5 text-base font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition-all duration-200"
            >
              How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative px-4 py-20 md:py-28 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold text-white tracking-tight">
              Escape in Seconds,
              <span className="text-emerald-400"> Not Minutes</span>
            </h2>
            <p className="mt-4 text-zinc-400 max-w-lg mx-auto">
              Traditional swaps take too long when prices are crashing. We make it instant.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <FeatureCard
              icon={<Clock className="w-5 h-5" />}
              title="One-Click Exit"
              description="Convert any position to USDC instantly. No need to navigate multiple DEXs or bridges. One transaction, done."
            />
            <FeatureCard
              icon={<Repeat className="w-5 h-5" />}
              title="Cross-Chain Native"
              description="Your USDC lands on whichever chain you need. Base, Arbitrum, Optimism - you choose the destination."
            />
            <FeatureCard
              icon={<Shield className="w-5 h-5" />}
              title="Unified Balance View"
              description="See all your assets across every chain in one place. Know exactly what you have and where it is."
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative px-4 py-20 md:py-28 bg-zinc-950 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-0 w-[600px] h-[600px] bg-emerald-500/3 rounded-full blur-3xl -translate-y-1/2" />
        </div>

        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold text-white tracking-tight">
              How It Works
            </h2>
            <p className="mt-4 text-zinc-400 max-w-lg mx-auto">
              Three steps to financial safety.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <StepCard
              number="01"
              title="Connect"
              description="Link your wallet. We instantly aggregate your balances across all supported chains."
            />
            <StepCard
              number="02"
              title="Select"
              description="Choose what to convert and where you want your USDC. We find the optimal route."
            />
            <StepCard
              number="03"
              title="Execute"
              description="One signature. Your assets are converted and delivered to your chosen chain."
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative px-4 py-16 md:py-20 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto">
          <div className="grid gap-8 md:grid-cols-4">
            <StatCard value="<1s" label="Average Execution" />
            <StatCard value="3" label="Chains Supported" />
            <StatCard value="1" label="Click to Safety" />
            <StatCard value="0" label="Hidden Fees" />
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section className="relative px-4 py-20 md:py-28 bg-zinc-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-semibold text-white tracking-tight">
              Built on the Best
            </h2>
            <p className="mt-4 text-zinc-400 max-w-lg mx-auto">
              Industry-leading protocols. Battle-tested infrastructure.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <IntegrationCard
              name="Uniswap"
              description="Optimal swap routing"
              href="https://uniswap.org"
            />
            <IntegrationCard
              name="Avail Nexus"
              description="Unified balances"
              href="https://docs.availproject.org/docs/nexus"
            />
            <IntegrationCard
              name="EIL Protocol"
              description="Cross-chain AA"
              href="#"
            />
            <IntegrationCard
              name="EIP-7702"
              description="Native abstraction"
              href="#"
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative px-4 py-20 md:py-28 bg-zinc-900/30 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>

        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-semibold text-white tracking-tight">
            Ready to Trade Fearlessly?
          </h2>
          <p className="mt-4 text-lg text-zinc-400">
            Stop watching prices in panic. Start trading with confidence.
          </p>
          <Link
            href="/app"
            className="mt-8 group inline-flex items-center gap-2 rounded-full bg-emerald-600 px-8 py-4 text-base font-medium text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-500 hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all duration-200"
          >
            Launch App
            <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 px-4 py-10 bg-zinc-950">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-lg font-semibold text-white">oneSig</span>
          </div>

          <div className="flex items-center gap-6 text-sm text-zinc-500">
            <a href="https://viem.sh" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">
              viem
            </a>
            <a href="https://www.rainbowkit.com" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">
              RainbowKit
            </a>
            <a href="https://uniswap.org" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">
              Uniswap
            </a>
            <a href="https://nextjs.org" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">
              Next.js
            </a>
          </div>
        </div>
      </footer>

      <Toaster />
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-6 hover:border-emerald-500/20 hover:bg-white/[0.04] transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative">
        <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-5">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

function StepCard({
  number,
  title,
  description
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="relative">
      <div className="text-6xl font-bold text-emerald-500/10 mb-2">{number}</div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
    </div>
  )
}

function StatCard({
  value,
  label
}: {
  value: string
  label: string
}) {
  return (
    <div className="text-center">
      <div className="text-4xl md:text-5xl font-bold text-emerald-400">{value}</div>
      <div className="mt-2 text-sm text-zinc-400">{label}</div>
    </div>
  )
}

function IntegrationCard({
  name,
  description,
  href
}: {
  name: string
  description: string
  href: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:border-emerald-500/20 hover:bg-white/[0.04] transition-all duration-300"
    >
      <div>
        <h3 className="font-semibold text-white group-hover:text-emerald-400 transition-colors">{name}</h3>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
      <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
    </a>
  )
}
