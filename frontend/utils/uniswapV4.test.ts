/**
 * Tests for Uniswap V4 Integration
 *
 * Run with: npx vitest run utils/uniswapV4.test.ts
 * Or add to package.json: "test": "vitest"
 */

import { describe, it, expect } from 'vitest'
import {
  createPoolKey,
  computePoolId,
  generateV4SwapCalldata,
  generateV3SwapCalldata,
  generateSwapCalldata,
  isV4Supported,
  formatFeeToPercent,
  POOL_MANAGER_ADDRESSES,
  UNIVERSAL_ROUTER_ADDRESSES,
  VOLATILE_PAIRS_HOOK_ADDRESSES,
  SWAP_ROUTER_V3,
  type PoolKey,
} from './uniswapV4'

// Mock addresses for testing
const MOCK_ADDRESSES = {
  USDC_BASE: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const,
  WETH_BASE: '0x4200000000000000000000000000000000000006' as const,
  DAI_BASE: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' as const,
  USER: '0x1234567890123456789012345678901234567890' as const,
}

describe('UniswapV4 Integration', () => {
  describe('Contract Addresses', () => {
    it('should have PoolManager addresses for all supported chains', () => {
      expect(POOL_MANAGER_ADDRESSES[42161]).toBeDefined() // Arbitrum
      expect(POOL_MANAGER_ADDRESSES[8453]).toBeDefined()  // Base
      expect(POOL_MANAGER_ADDRESSES[10]).toBeDefined()    // Optimism
    })

    it('should have UniversalRouter addresses for all supported chains', () => {
      expect(UNIVERSAL_ROUTER_ADDRESSES[42161]).toBeDefined()
      expect(UNIVERSAL_ROUTER_ADDRESSES[8453]).toBeDefined()
      expect(UNIVERSAL_ROUTER_ADDRESSES[10]).toBeDefined()
    })

    it('should have VolatilePairsHook addresses for Tenderly devnets', () => {
      expect(VOLATILE_PAIRS_HOOK_ADDRESSES[42161]).toBe('0x8EF76ebf2988346FBc599E7581E5573550381b6D')
      expect(VOLATILE_PAIRS_HOOK_ADDRESSES[8453]).toBe('0xBFc8eEB7171e49DCc821D0317450Ca8F3ca55Acd')
      expect(VOLATILE_PAIRS_HOOK_ADDRESSES[10]).toBe('0x8EF76ebf2988346FBc599E7581E5573550381b6D')
    })

    it('should have V3 SwapRouter addresses for fallback', () => {
      expect(SWAP_ROUTER_V3[42161]).toBe('0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45')
      expect(SWAP_ROUTER_V3[8453]).toBe('0x2626664c2603336E57B271c5C0b26F421741e481')
      expect(SWAP_ROUTER_V3[10]).toBe('0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45')
    })
  })

  describe('createPoolKey', () => {
    it('should create pool key with tokens in sorted order', () => {
      const poolKey = createPoolKey(
        MOCK_ADDRESSES.WETH_BASE, // Higher address
        MOCK_ADDRESSES.USDC_BASE, // Lower address
        3000,
        60
      )

      // currency0 should be the lower address (USDC)
      expect(poolKey.currency0.toLowerCase()).toBe(MOCK_ADDRESSES.USDC_BASE.toLowerCase())
      expect(poolKey.currency1.toLowerCase()).toBe(MOCK_ADDRESSES.WETH_BASE.toLowerCase())
      expect(poolKey.fee).toBe(3000)
      expect(poolKey.tickSpacing).toBe(60)
    })

    it('should include hook address in pool key', () => {
      const hookAddress = VOLATILE_PAIRS_HOOK_ADDRESSES[8453]
      const poolKey = createPoolKey(
        MOCK_ADDRESSES.USDC_BASE,
        MOCK_ADDRESSES.WETH_BASE,
        3000,
        60,
        hookAddress
      )

      expect(poolKey.hooks).toBe(hookAddress)
    })

    it('should use zero address for hooks by default', () => {
      const poolKey = createPoolKey(
        MOCK_ADDRESSES.USDC_BASE,
        MOCK_ADDRESSES.WETH_BASE
      )

      expect(poolKey.hooks).toBe('0x0000000000000000000000000000000000000000')
    })
  })

  describe('computePoolId', () => {
    it('should compute deterministic pool ID from pool key', () => {
      const poolKey: PoolKey = {
        currency0: MOCK_ADDRESSES.USDC_BASE,
        currency1: MOCK_ADDRESSES.WETH_BASE,
        fee: 3000,
        tickSpacing: 60,
        hooks: '0x0000000000000000000000000000000000000000',
      }

      const poolId = computePoolId(poolKey)

      // Pool ID should be a 32-byte hex string (0x + 64 chars)
      expect(poolId).toMatch(/^0x[a-fA-F0-9]{64}$/)
    })

    it('should produce different IDs for different hooks', () => {
      const poolKeyNoHook: PoolKey = {
        currency0: MOCK_ADDRESSES.USDC_BASE,
        currency1: MOCK_ADDRESSES.WETH_BASE,
        fee: 3000,
        tickSpacing: 60,
        hooks: '0x0000000000000000000000000000000000000000',
      }

      const poolKeyWithHook: PoolKey = {
        ...poolKeyNoHook,
        hooks: VOLATILE_PAIRS_HOOK_ADDRESSES[8453],
      }

      const idNoHook = computePoolId(poolKeyNoHook)
      const idWithHook = computePoolId(poolKeyWithHook)

      expect(idNoHook).not.toBe(idWithHook)
    })
  })

  describe('generateV4SwapCalldata', () => {
    it('should generate valid V4 swap calldata', () => {
      const result = generateV4SwapCalldata(
        MOCK_ADDRESSES.USDC_BASE,
        MOCK_ADDRESSES.WETH_BASE,
        BigInt(1000000), // 1 USDC
        MOCK_ADDRESSES.USER,
        8453 // Base
      )

      expect(result.to).toBe(UNIVERSAL_ROUTER_ADDRESSES[8453])
      expect(result.data).toMatch(/^0x[a-fA-F0-9]+$/)
      expect(result.value).toBe(BigInt(0))
    })

    it('should throw for unsupported chain', () => {
      expect(() => generateV4SwapCalldata(
        MOCK_ADDRESSES.USDC_BASE,
        MOCK_ADDRESSES.WETH_BASE,
        BigInt(1000000),
        MOCK_ADDRESSES.USER,
        999999 // Invalid chain
      )).toThrow('UniversalRouter not available')
    })

    it('should use VolatilePairsHook when available', () => {
      const result = generateV4SwapCalldata(
        MOCK_ADDRESSES.USDC_BASE,
        MOCK_ADDRESSES.WETH_BASE,
        BigInt(1000000),
        MOCK_ADDRESSES.USER,
        8453,
        VOLATILE_PAIRS_HOOK_ADDRESSES[8453]
      )

      // Calldata should include the hook address
      expect(result.data.toLowerCase()).toContain(
        VOLATILE_PAIRS_HOOK_ADDRESSES[8453].slice(2).toLowerCase()
      )
    })
  })

  describe('generateV3SwapCalldata (fallback)', () => {
    it('should generate valid V3 exactInputSingle calldata', () => {
      const result = generateV3SwapCalldata(
        MOCK_ADDRESSES.USDC_BASE,
        MOCK_ADDRESSES.WETH_BASE,
        BigInt(1000000),
        MOCK_ADDRESSES.USER,
        8453
      )

      expect(result.to).toBe(SWAP_ROUTER_V3[8453])
      expect(result.data).toMatch(/^0x[a-fA-F0-9]+$/)
      expect(result.value).toBe(BigInt(0))
    })

    it('should throw for unsupported chain', () => {
      expect(() => generateV3SwapCalldata(
        MOCK_ADDRESSES.USDC_BASE,
        MOCK_ADDRESSES.WETH_BASE,
        BigInt(1000000),
        MOCK_ADDRESSES.USER,
        999999
      )).toThrow('SwapRouter not available')
    })
  })

  describe('generateSwapCalldata (async wrapper)', () => {
    it('should return calldata using V3 router', async () => {
      const result = await generateSwapCalldata(
        MOCK_ADDRESSES.USDC_BASE,
        '1000000',
        MOCK_ADDRESSES.WETH_BASE,
        18,
        MOCK_ADDRESSES.USER,
        null, // provider not used
        8453
      )

      expect(result.to).toBe(SWAP_ROUTER_V3[8453])
      expect(result.calldata).toMatch(/^0x[a-fA-F0-9]+$/)
      expect(result.value).toBe('0')
    })
  })

  describe('isV4Supported', () => {
    it('should return true for supported chains', () => {
      expect(isV4Supported(42161)).toBe(true) // Arbitrum
      expect(isV4Supported(8453)).toBe(true)  // Base
      expect(isV4Supported(10)).toBe(true)    // Optimism
    })

    it('should return false for unsupported chains', () => {
      expect(isV4Supported(1)).toBe(false)      // Mainnet (not in our config)
      expect(isV4Supported(999999)).toBe(false) // Invalid
    })
  })

  describe('formatFeeToPercent', () => {
    it('should format fee basis points to percentage', () => {
      expect(formatFeeToPercent(3000)).toBe('0.30%')
      expect(formatFeeToPercent(500)).toBe('0.05%')
      expect(formatFeeToPercent(10000)).toBe('1.00%')
    })
  })
})

describe('VolatilePairsHook Integration', () => {
  describe('Hook Addresses', () => {
    it('should have valid hook addresses on all devnets', () => {
      // All addresses should be valid Ethereum addresses
      Object.values(VOLATILE_PAIRS_HOOK_ADDRESSES).forEach(address => {
        expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)
      })
    })
  })

  describe('Pool Key with Hook', () => {
    it('should create pool keys that include the VolatilePairsHook', () => {
      const chains = [42161, 8453, 10]

      chains.forEach(chainId => {
        const hookAddress = VOLATILE_PAIRS_HOOK_ADDRESSES[chainId]
        const poolKey = createPoolKey(
          MOCK_ADDRESSES.USDC_BASE,
          MOCK_ADDRESSES.WETH_BASE,
          3000,
          60,
          hookAddress
        )

        expect(poolKey.hooks).toBe(hookAddress)
        expect(poolKey.hooks).not.toBe('0x0000000000000000000000000000000000000000')
      })
    })
  })
})
