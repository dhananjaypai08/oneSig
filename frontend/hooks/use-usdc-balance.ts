"use client"

import { useReadContract } from "wagmi"
import { type Address } from "viem"
import { USDC_ADDRESS, ERC20_ABI } from "@/lib/config"

export function useUsdcBalance(accountAddress?: Address | null) {
  const { data: balance, refetch, isLoading } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: accountAddress ? [accountAddress] : undefined,
    query: {
      enabled: !!accountAddress,
    },
  })

  return {
    balance: balance ?? BigInt(0),
    refetch,
    isLoading,
  }
}
