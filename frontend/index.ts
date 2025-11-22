import { Swap, Token } from "./interfaces/swap";
import { Token as UniswapToken, CurrencyAmount } from '@uniswap/sdk-core';
import { AlphaRouter, SwapType } from '@uniswap/smart-order-router'; // or '@uniswap/alpha-router'
import { TradeType, Percent } from '@uniswap/sdk-core';
import { ethers } from 'ethers';
import { encodeFunctionData, erc20Abi, Hex } from "viem";
import { COINBASE_WALLET_ABI } from "./abis/coinbaseWallet";
import { CBBTC_ADDRESS, UNISWAP_ROUTER } from "./constants";

const swapAssets = async ({ tokens, walletAddress, wallet }: Swap) => {
    console.log("Swapping assets...");

    if(tokens.length > 3) {
        throw new Error("Too many tokens");
    }
    
    const calls: {target: Hex, value: bigint, data: Hex}[] = [];

    for(const token of tokens) {
        calls.push({
            data: encodeFunctionData({
                abi: erc20Abi,
                functionName: "approve",
                args: [UNISWAP_ROUTER, token.value]
            }),
            target: token.address,
            value: BigInt(0)
        });
        const swapCalldata = await generateSwapCalldata(
            token.address,
            token.value.toString(),
            CBBTC_ADDRESS,
            walletAddress,
            new ethers.providers.JsonRpcProvider(
                "https://base.blockpi.network/v1/rpc/"
            ),
            8453
        )
        calls.push({
            data: swapCalldata.calldata as Hex,
            target: swapCalldata.to as Hex,
            value: BigInt(swapCalldata.value || 0)
        })
    }

    // encodeFunctionData({
    //     abi: COINBASE_WALLET_ABI,
    //     functionName: "executeBatch",
    //     args: [calls]
    // })

    return calls;
}

async function generateSwapCalldata(
    fromTokenAddress: string,
    amount: string,          // input amount in token decimals, e.g. '1000000000000000000' for 1 ETH
    toTokenAddress: string,
    recipient: string,       // the receiver address
    provider: ethers.providers.JsonRpcProvider, // Ethers provider
    chainId: number          // e.g., 1 for mainnet
) {
    // Construct Token objects (you need token decimals)
    const fromToken = new UniswapToken(chainId, fromTokenAddress, 6); // update decimals accordingly
    const toToken = new UniswapToken(chainId, toTokenAddress, 18);      // update decimals accordingly

    const router = new AlphaRouter({ chainId, provider });

    const amountIn = CurrencyAmount.fromRawAmount(fromToken, amount);

    console.log("generating swap calldata...");

    const route = await router.route(
        amountIn,
        toToken,
        TradeType.EXACT_INPUT,
        {
            type: SwapType.SWAP_ROUTER_02,
            recipient,
            slippageTolerance: new Percent(5, 100), // 5%
            deadline: Math.floor(Date.now() / 1000 + 1800), // 30 min deadline
        }
    );

    if (!route || !route.methodParameters) throw new Error("No route loaded");

    console.log("swap calldata generated");
    console.log("route: ", route);

    // Outputs: calldata and value for swap
    return {
        to: route.methodParameters.to,
        calldata: route.methodParameters.calldata,
        value: route.methodParameters.value
    };
}

generateSwapCalldata(
    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    "1000000",
    "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
    "0xDB39A34248A8fb430b51e53924247378760cFa8e",
    new ethers.providers.JsonRpcProvider(
        "https://base.blockpi.network/v1/rpc/779e08b345d76d57ed58ee746f35632a054e992e"
    ),
    8453
).then((data) => {
    console.log(data);
});

// swapAssets({tokens: [], })
