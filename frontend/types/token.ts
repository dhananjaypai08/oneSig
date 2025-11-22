import { Address } from "viem"

export type Token = {
    address: Address;
    value: bigint;
    name: "USDT" | "DAI" | "WETH"
}

export const TokenAddresses: {
    [key: number]: {
        USDC: Address;
        USDT: Address;
        WETH: Address,
        DAI: Address
    }
} = {
    10: {
        "USDC": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
        "USDT": "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58",
        "DAI": "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
        "WETH": "0x4200000000000000000000000000000000000006"
    },
    8453: {
        "USDC": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "USDT": "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
        "DAI": "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
        "WETH": "0x4200000000000000000000000000000000000006"
    },
    42161: {
        "USDC": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        "USDT": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        "DAI": "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
        "WETH": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"
    }
}

export const PoolAddresses: {[key: number]: {USDT: Address; WETH: Address, DAI: Address}} = {
    10: {
        "USDT": "0x",
        "WETH": "0x",
        "DAI": "0x"
    },
    8453: {
        "USDT": "0x",
        "WETH": "0x",
        "DAI": "0x"
    },
    42161: {
        "USDT": "0x",
        "WETH": "0x",
        "DAI": "0x"
    }
}