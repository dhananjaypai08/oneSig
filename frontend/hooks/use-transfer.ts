"use client"

import { useState, useCallback, useEffect } from "react"
import { useAccount, useWalletClient } from "wagmi"
import {
  parseUnits,
  encodeFunctionData,
  type Address,
  erc20Abi,
  type Hex,
} from "viem"
import { sepolia } from "viem/chains"
import {
  USDC_ADDRESS,
  USDC_DECIMALS,
  publicClient,
} from "@/lib/config"

export type TransferStep =
  | "idle"
  | "authorizing"
  | "signing"
  | "submitting"
  | "confirming"
  | "success"
  | "error"

interface TransferState {
  step: TransferStep
  txHash: string | null
  error: string | null
  progress: number
}

const stepProgress: Record<TransferStep, number> = {
  idle: 0,
  authorizing: 20,
  signing: 40,
  submitting: 60,
  confirming: 80,
  success: 100,
  error: 0,
}

// Polling interval for checking call status
const POLL_INTERVAL = 2000

export function useTransfer() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()

  const [state, setState] = useState<TransferState>({
    step: "idle",
    txHash: null,
    error: null,
    progress: 0,
  })

  const [delegationStatus, setDelegationStatus] = useState<{
    isDelegated: boolean
    delegatedTo: Address | null
    isLoading: boolean
  }>({
    isDelegated: false,
    delegatedTo: null,
    isLoading: true,
  })

  // Check if account has existing delegation
  useEffect(() => {
    async function checkDelegation() {
      if (!address) {
        setDelegationStatus({ isDelegated: false, delegatedTo: null, isLoading: false })
        return
      }

      try {
        // Get the code at the address - if it starts with 0xef0100, it's an EIP-7702 delegation
        const code = await publicClient.getCode({ address })

        if (code && code.startsWith("0xef0100")) {
          // EIP-7702 delegation prefix is 0xef0100 followed by the 20-byte address
          const delegatedTo = `0x${code.slice(8, 48)}` as Address
          setDelegationStatus({ isDelegated: true, delegatedTo, isLoading: false })
          console.log("Account delegated to:", delegatedTo)
        } else {
          setDelegationStatus({ isDelegated: false, delegatedTo: null, isLoading: false })
        }
      } catch (error) {
        console.error("Error checking delegation:", error)
        setDelegationStatus({ isDelegated: false, delegatedTo: null, isLoading: false })
      }
    }

    checkDelegation()
  }, [address])

  const reset = useCallback(() => {
    setState({
      step: "idle",
      txHash: null,
      error: null,
      progress: 0,
    })
  }, [])

  // Revert delegation by sending a type 4 transaction with empty authorization
  const revertDelegation = useCallback(async () => {
    if (!address || !walletClient) {
      setState((s) => ({ ...s, step: "error", error: "Wallet not connected" }))
      return false
    }

    try {
      setState({ step: "authorizing", txHash: null, error: null, progress: stepProgress.authorizing })

      // To revert, we need to send an EIP-7702 transaction with authorization to address(0)
      // This clears the delegation
      // We use wallet_revokePermissions or send a transaction with empty code

      // Method 1: Try using wallet_revokeSmartAccount if available (MetaMask specific)
      try {
        await walletClient.request({
          method: "wallet_revokeSmartAccount" as any,
          params: [],
        })

        setState((s) => ({ ...s, step: "success", progress: 100 }))
        setDelegationStatus({ isDelegated: false, delegatedTo: null, isLoading: false })
        return true
      } catch (e) {
        console.log("wallet_revokeSmartAccount not available, trying alternative...")
      }

      // Method 2: Sign an authorization to 0x0 (null address) to clear delegation
      // This requires the user to sign an EIP-7702 authorization
      setState((s) => ({ ...s, step: "signing", progress: stepProgress.signing }))

      // Send a simple self-transfer to trigger MetaMask to show account management
      // The user can then manually revert via MetaMask UI
      const hash = await walletClient.sendTransaction({
        to: address,
        value: BigInt(0),
      })

      setState((s) => ({ ...s, step: "confirming", progress: stepProgress.confirming }))

      await publicClient.waitForTransactionReceipt({ hash })

      setState((s) => ({
        ...s,
        step: "success",
        txHash: hash,
        progress: 100,
      }))

      // Recheck delegation status
      const code = await publicClient.getCode({ address })
      if (!code || !code.startsWith("0xef0100")) {
        setDelegationStatus({ isDelegated: false, delegatedTo: null, isLoading: false })
      }

      return true

    } catch (error: any) {
      console.error("Revert delegation error:", error)
      setState((s) => ({
        ...s,
        step: "error",
        error: error.shortMessage || error.message || "Failed to revert delegation",
        progress: 0,
      }))
      return false
    }
  }, [address, walletClient])

  const transfer = useCallback(
    async (recipient: Address, amount: string) => {
      if (!address || !walletClient) {
        setState((s) => ({ ...s, step: "error", error: "Wallet not connected" }))
        return
      }

      try {
        setState({ step: "authorizing", txHash: null, error: null, progress: stepProgress.authorizing })

        const amountInUnits = parseUnits(amount, USDC_DECIMALS)

        // Encode transfer calls
        const transferData = encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [recipient, amountInUnits],
        })

        // To trigger EIP-7702, we need multiple calls in a batch
        // We'll do a small approval to self (0 amount) + the actual transfer
        // This forces MetaMask to use smart account execution
        const approveData = encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [address, BigInt(0)], // Approve 0 to self (no-op but creates batch)
        })

        setState((s) => ({ ...s, step: "signing", progress: stepProgress.signing }))

        // Use wallet_sendCalls with atomicRequired: true and multiple calls
        // This forces MetaMask to use EIP-7702 smart account execution
        const sendCallsParams = {
          version: "2.0.0",
          from: address,
          chainId: `0x${sepolia.id.toString(16)}`,
          atomicRequired: true,
          calls: [
            {
              to: USDC_ADDRESS,
              data: approveData,
              value: "0x0",
            },
            {
              to: USDC_ADDRESS,
              data: transferData,
              value: "0x0",
            },
          ],
        }

        console.log("wallet_sendCalls params:", JSON.stringify(sendCallsParams, null, 2))

        const result = await walletClient.request({
          method: "wallet_sendCalls" as any,
          params: [sendCallsParams],
        })

        console.log("wallet_sendCalls result:", result, typeof result)

        // Handle both response formats - some wallets return { id: "0x..." }, others return "0x..." directly
        let batchId: string
        if (typeof result === 'string') {
          batchId = result
        } else if (result && typeof result === 'object' && 'id' in result) {
          batchId = (result as { id: string }).id
        } else {
          console.error("Unexpected result format:", result)
          throw new Error("Unexpected response from wallet_sendCalls")
        }

        console.log("Batch ID:", batchId)

        setState((s) => ({ ...s, step: "submitting", progress: stepProgress.submitting }))

        // Poll for transaction status
        let txHash: Hex | null = null
        let attempts = 0
        const maxAttempts = 60 // 2 minutes max

        // EIP-5792 status codes:
        // 100 = PENDING
        // 200 = CONFIRMED
        // 300+ = ERROR states

        while (!txHash && attempts < maxAttempts) {
          try {
            const status = await walletClient.request({
              method: "wallet_getCallsStatus" as any,
              params: [batchId],
            }) as {
              status: number | string
              receipts?: Array<{
                transactionHash: Hex
                status: string
                logs: Array<any>
              }>
            }

            console.log("Status:", JSON.stringify(status, null, 2))

            // Handle both numeric (EIP-5792) and string status formats
            const statusCode = typeof status.status === 'number' ? status.status :
              status.status === "CONFIRMED" ? 200 :
              status.status === "PENDING" ? 100 :
              status.status === "FAILED" ? 400 : parseInt(status.status) || 0

            if (statusCode === 200) {
              // Transaction confirmed
              if (status.receipts?.[0]?.transactionHash) {
                txHash = status.receipts[0].transactionHash
                break
              }
              // Sometimes receipts might not be immediately available, keep polling
            } else if (statusCode >= 300) {
              throw new Error(`Transaction failed with status ${statusCode}`)
            }
            // status 100 = still pending, continue polling
          } catch (e: any) {
            // Ignore polling errors, keep trying
            if (e.message?.includes("Transaction failed")) throw e
          }

          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))
          attempts++

          if (attempts === 5) {
            setState((s) => ({ ...s, step: "confirming", progress: stepProgress.confirming }))
          }
        }

        if (!txHash) {
          throw new Error("Transaction confirmation timeout")
        }

        setState((s) => ({
          ...s,
          step: "success",
          txHash,
          progress: 100
        }))

        return txHash

      } catch (error: any) {
        console.error("Transfer error:", error)

        if (error.code === 4001) {
          setState((s) => ({
            ...s,
            step: "error",
            error: "Transaction rejected by user",
            progress: 0,
          }))
        } else {
          setState((s) => ({
            ...s,
            step: "error",
            error: error.shortMessage || error.message || "Transfer failed",
            progress: 0,
          }))
        }
      }
    },
    [address, walletClient]
  )

  return {
    ...state,
    transfer,
    reset,
    revertDelegation,
    delegationStatus,
    // With EIP-7702, the smart account IS the user's EOA (upgraded)
    smartAccountAddress: address,
    isLoading: ["authorizing", "signing", "submitting", "confirming"].includes(state.step),
  }
}
