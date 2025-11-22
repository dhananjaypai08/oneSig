import { NexusSDK } from '@avail-project/nexus-core';

export type NexusNetwork = 'mainnet' | 'testnet';

let currentNetwork: NexusNetwork = 'mainnet';
let sdk = new NexusSDK({ network: currentNetwork });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedProvider: any = null;

export function getCurrentNetwork(): NexusNetwork {
  return currentNetwork;
}

export function isInitialized() {
  return sdk.isInitialized();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function switchNetwork(network: NexusNetwork, provider?: any) {
  // No change needed
  if (network === currentNetwork) return;

  const wasInitialized = sdk.isInitialized();
  const providerToUse = provider || cachedProvider;

  // Deinit existing SDK if initialized
  if (wasInitialized) {
    await sdk.deinit();
  }

  // Create new SDK instance with the new network
  currentNetwork = network;
  sdk = new NexusSDK({ network });

  // Auto re-initialize with cached provider if SDK was previously initialized
  if (wasInitialized && providerToUse) {
    await sdk.initialize(providerToUse);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function initializeWithProvider(provider: any) {
  if (!provider) throw new Error('No EIP-1193 provider (e.g., MetaMask) found');

  if (sdk.isInitialized()) return;

  // Cache the provider for network switches
  cachedProvider = provider;
  await sdk.initialize(provider);
}

export async function deinit() {
  if (!sdk.isInitialized()) return;

  await sdk.deinit();
}

export async function getUnifiedBalances() {
  return await sdk.getUnifiedBalances();
}
