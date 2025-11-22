import { NexusSDK } from '@avail-project/nexus-core';

export type NexusNetwork = 'mainnet' | 'testnet';

let currentNetwork: NexusNetwork = 'mainnet';
let sdk = new NexusSDK({ network: currentNetwork });

export function getCurrentNetwork(): NexusNetwork {
  return currentNetwork;
}

export function isInitialized() {
  return sdk.isInitialized();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function switchNetwork(network: NexusNetwork, provider?: any) {
  if (network === currentNetwork && sdk.isInitialized()) return;

  // Deinit existing SDK if initialized
  if (sdk.isInitialized()) {
    await sdk.deinit();
  }

  // Create new SDK instance with the new network
  currentNetwork = network;
  sdk = new NexusSDK({ network });

  // Re-initialize with provider if provided
  if (provider) {
    await sdk.initialize(provider);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function initializeWithProvider(provider: any) {
  if (!provider) throw new Error('No EIP-1193 provider (e.g., MetaMask) found');

  if (sdk.isInitialized()) return;

  await sdk.initialize(provider);
}

export async function deinit() {
  if (!sdk.isInitialized()) return;

  await sdk.deinit();
}

export async function getUnifiedBalances() {
  return await sdk.getUnifiedBalances();
}
