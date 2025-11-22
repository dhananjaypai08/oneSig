import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { sepolia } from 'wagmi/chains'

export const config = getDefaultConfig({
  appName: 'OmniGator',
  projectId: 'c4f79cc821944d9680842e34466bfb',
  chains: [sepolia],
  ssr: true,
})
