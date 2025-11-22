import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { base, arbitrum, optimism, mainnet, sepolia } from 'wagmi/chains'

export const config = getDefaultConfig({
  appName: 'OmniGator',
  projectId: 'c4f79cc821944d9680842e34466bfb',
  chains: [base, arbitrum, optimism, mainnet, sepolia],
  ssr: true,
})
