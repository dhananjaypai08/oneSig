import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatAddress(address: string): string {
  if (!address) return ""
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function formatUSDC(amount: bigint | string | number, decimals: number = 6): string {
  const amountBigInt = typeof amount === "bigint" ? amount : BigInt(amount || 0)
  const divisor = BigInt(10 ** decimals)
  const integerPart = amountBigInt / divisor
  const fractionalPart = amountBigInt % divisor
  const fractionalStr = fractionalPart.toString().padStart(decimals, "0").slice(0, 2)
  return `${integerPart.toLocaleString()}.${fractionalStr}`
}
