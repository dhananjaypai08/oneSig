"use client"

import { useState, useEffect, useRef } from "react"
import { useAccount } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { isAddress, formatUnits, type Address } from "viem"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader, ProgressBar } from "@/components/ui/loader"
import { useTransfer, type TransferStep } from "@/hooks/use-transfer"
import { useUsdcBalance } from "@/hooks/use-usdc-balance"
import { useToast } from "@/hooks/use-toast"
import { formatAddress, formatUSDC } from "@/lib/utils"
import { USDC_DECIMALS } from "@/lib/config"

const stepMessages: Record<TransferStep, string> = {
  idle: "",
  authorizing: "Signing authorization",
  signing: "Preparing transaction",
  submitting: "Submitting to network",
  confirming: "Waiting for confirmation",
  success: "Transfer complete",
  error: "Transfer failed",
}

// MetaMask's official EIP-7702 delegator contract
const METAMASK_DELEGATOR = "0x63c0c19a282a1b52b07dd5a65b58948a07dae32b"

export function TransferCard() {
  const { address, isConnected } = useAccount()
  const {
    step,
    txHash,
    error,
    progress,
    transfer,
    reset,
    isLoading,
    smartAccountAddress,
    delegationStatus,
    revertDelegation,
  } = useTransfer()
  const { balance: usdcBalance, refetch: refetchBalance } = useUsdcBalance(smartAccountAddress)
  const { toast } = useToast()

  const [recipient, setRecipient] = useState("")
  const [amount, setAmount] = useState("")
  const [recipientError, setRecipientError] = useState("")
  const [amountError, setAmountError] = useState("")

  const successAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    successAudioRef.current = new Audio("/sounds/success.mp3")
    successAudioRef.current.volume = 0.4
  }, [])

  useEffect(() => {
    if (step === "success") {
      successAudioRef.current?.play().catch(() => {})
      toast({
        title: "Transfer complete",
        description: `Sent ${amount} USDC to ${formatAddress(recipient)}`,
        variant: "success",
      })
      refetchBalance()
    }
  }, [step, amount, recipient, toast, refetchBalance])

  const validateRecipient = (value: string) => {
    if (!value) {
      setRecipientError("")
      return false
    }
    if (!isAddress(value)) {
      setRecipientError("Invalid address")
      return false
    }
    setRecipientError("")
    return true
  }

  const validateAmount = (value: string) => {
    if (!value) {
      setAmountError("")
      return false
    }
    const num = parseFloat(value)
    if (isNaN(num) || num <= 0) {
      setAmountError("Invalid amount")
      return false
    }
    const maxBalance = parseFloat(formatUnits(usdcBalance, USDC_DECIMALS))
    if (num > maxBalance) {
      setAmountError("Insufficient balance")
      return false
    }
    setAmountError("")
    return true
  }

  const handleTransfer = async () => {
    const isRecipientValid = validateRecipient(recipient)
    const isAmountValid = validateAmount(amount)
    if (!isRecipientValid || !isAmountValid) return
    await transfer(recipient as Address, amount)
  }

  const handleReset = () => {
    reset()
    setRecipient("")
    setAmount("")
  }

  const handleRevertDelegation = async () => {
    const success = await revertDelegation()
    if (success) {
      toast({
        title: "Delegation reverted",
        description: "Your account is now a regular EOA. You can re-delegate via MetaMask.",
        variant: "success",
      })
    }
  }

  const copyTxHash = () => {
    if (txHash) {
      navigator.clipboard.writeText(txHash)
      toast({ title: "Copied to clipboard" })
    }
  }

  const handleMax = () => {
    const max = formatUnits(usdcBalance, USDC_DECIMALS)
    setAmount(max)
    validateAmount(max)
  }

  // Check if delegated to an unsupported contract (not MetaMask's official delegator)
  const isUnsupportedDelegation = delegationStatus.isDelegated &&
    delegationStatus.delegatedTo?.toLowerCase() !== METAMASK_DELEGATOR.toLowerCase()

  if (!isConnected) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl">Send USDC</CardTitle>
          <CardDescription>
            Connect wallet to transfer USDC using EIP-7702
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center pt-4">
          <ConnectButton />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Send USDC</CardTitle>
            <CardDescription>EIP-7702 transfer</CardDescription>
          </div>
          <ConnectButton
            accountStatus="address"
            chainStatus="icon"
            showBalance={false}
          />
        </div>

        {/* Delegation Status Warning */}
        {!delegationStatus.isLoading && isUnsupportedDelegation && (
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 dark:bg-amber-950 dark:border-amber-800">
            <p className="text-xs uppercase tracking-wide text-amber-600 dark:text-amber-400 font-medium">
              Unsupported Delegation Detected
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              Your account is delegated to a non-MetaMask contract:
            </p>
            <p className="text-xs font-mono text-amber-600 dark:text-amber-400 mt-1 break-all">
              {delegationStatus.delegatedTo}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              To use MetaMask&apos;s EIP-7702 features, you need to revert this delegation first.
            </p>
            <Button
              onClick={handleRevertDelegation}
              disabled={isLoading}
              variant="secondary"
              size="sm"
              className="mt-3 w-full bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900 dark:hover:bg-amber-800 dark:text-amber-100"
            >
              {isLoading ? (
                <>
                  <Loader size="sm" />
                  <span>Processing...</span>
                </>
              ) : (
                "Revert Delegation"
              )}
            </Button>
          </div>
        )}

        {/* Show current delegation if it's to MetaMask */}
        {!delegationStatus.isLoading && delegationStatus.isDelegated && !isUnsupportedDelegation && (
          <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-3 dark:bg-green-950 dark:border-green-800">
            <p className="text-xs uppercase tracking-wide text-green-600 dark:text-green-400 font-medium">
              Smart Account Active
            </p>
            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
              Your EOA is upgraded to a MetaMask Smart Account via EIP-7702.
            </p>
          </div>
        )}

        <div className="mt-4 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Balance</p>
          <p className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {formatUSDC(usdcBalance.toString())}
            <span className="ml-1.5 text-sm font-normal text-zinc-500">USDC</span>
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {step === "success" ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <svg className="h-6 w-6 text-zinc-900 dark:text-zinc-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                Transfer complete
              </p>
              <p className="text-sm text-zinc-500">
                {amount} USDC sent to {formatAddress(recipient)}
              </p>
            </div>
            {txHash && (
              <div className="flex items-center gap-2 text-sm">
                <button
                  onClick={copyTxHash}
                  className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  {formatAddress(txHash)}
                </button>
                <a
                  href={`https://sepolia.etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              </div>
            )}
            <Button onClick={handleReset} variant="secondary" size="sm" className="mt-2">
              New transfer
            </Button>
          </div>
        ) : step === "error" ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <svg className="h-6 w-6 text-zinc-900 dark:text-zinc-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                Transfer failed
              </p>
              <p className="max-w-xs text-sm text-zinc-500">{error}</p>
            </div>
            <Button onClick={handleReset} variant="secondary" size="sm">
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Recipient"
              placeholder="0x..."
              value={recipient}
              onChange={(e) => {
                setRecipient(e.target.value)
                validateRecipient(e.target.value)
              }}
              error={recipientError}
              disabled={isLoading}
            />

            <Input
              label="Amount"
              placeholder="0.00"
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value)
                validateAmount(e.target.value)
              }}
              error={amountError}
              disabled={isLoading}
              suffix={
                <button
                  onClick={handleMax}
                  className="text-xs font-medium text-zinc-900 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300"
                  type="button"
                >
                  MAX
                </button>
              }
            />

            {isLoading && (
              <div className="space-y-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
                <div className="flex items-center gap-2">
                  <Loader size="sm" />
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {stepMessages[step]}
                  </span>
                </div>
                <ProgressBar progress={progress} />
              </div>
            )}

            <Button
              onClick={handleTransfer}
              disabled={isLoading || !recipient || !amount || isUnsupportedDelegation}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader size="sm" />
                  <span>Processing</span>
                </>
              ) : isUnsupportedDelegation ? (
                "Revert delegation first"
              ) : (
                "Send USDC"
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
