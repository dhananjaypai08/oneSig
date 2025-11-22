import { CrossChainSdk, type IMultiChainSmartAccount, type IBundlerManager, type UserOperation } from "@eil-protocol/sdk"
import { AmbireMultiChainSmartAccount } from "@eil-protocol/accounts"
import { AmbireBundlerManager } from "@eil-protocol/sdk"
import { getAccount } from "@wagmi/core"
import { config } from "./wagmi"
import { type Address, type Hex, createWalletClient, custom } from "viem"
import { base } from "./config"

const CHAIN_IDS = [BigInt(42161), BigInt(8453), BigInt(10)]

export interface EilSdkInstance {
  sdk: CrossChainSdk
  account: IMultiChainSmartAccount
  walletAddress: Address
}

class SimpleBundlerManager implements IBundlerManager {
  async verifyConfig(_chainId: bigint, _entrypoints: Address): Promise<void> {}

  async sendUserOperation(_userOp: UserOperation): Promise<Hex> {
    throw new Error("Bundler not configured")
  }
}

export async function createEilSdk(): Promise<EilSdkInstance> {
  console.log("[EIL SDK] Starting SDK initialization...")

  const account = getAccount(config)
  console.log("[EIL SDK] Account state:", {
    isConnected: account.isConnected,
    address: account.address,
    hasConnector: !!account.connector,
    connectorName: account.connector?.name,
  })

  if (!account.isConnected) {
    throw new Error("Wallet not connected")
  }

  if (!account.address) {
    throw new Error("No wallet address found")
  }

  if (!account.connector) {
    throw new Error("No connector found")
  }

  console.log("[EIL SDK] Getting provider from connector...")

  const provider = await account.connector.getProvider()
  console.log("[EIL SDK] Provider obtained:", { hasProvider: !!provider })

  if (!provider) {
    throw new Error("Failed to get provider from connector")
  }

  console.log("[EIL SDK] Creating wallet client with custom transport...")

  const walletClient = createWalletClient({
    account: account.address,
    chain: base,
    transport: custom(provider as Parameters<typeof custom>[0]),
  })

  console.log("[EIL SDK] Wallet client created:", {
    hasClient: !!walletClient,
    clientAccount: walletClient.account?.address,
    chain: walletClient.chain?.name,
  })

  const bundlerManager = new AmbireBundlerManager(walletClient, new Map<bigint, Address>())
  const walletAddress = account.address

  console.log("[EIL SDK] Creating AmbireMultiChainSmartAccount...", {
    walletAddress,
    chainIds: CHAIN_IDS.map(c => c.toString()),
  })

  const ambireAccount = new AmbireMultiChainSmartAccount(
    walletClient,
    walletAddress,
    CHAIN_IDS,
    bundlerManager
  )

  console.log("[EIL SDK] Initializing Ambire account...")
  await ambireAccount.init()
  console.log("[EIL SDK] Ambire account initialized successfully")

  const sdk = new CrossChainSdk()
  console.log("[EIL SDK] CrossChainSdk created")

  return {
    sdk,
    account: ambireAccount,
    walletAddress,
  }
}
