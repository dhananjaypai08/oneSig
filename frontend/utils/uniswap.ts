import { Token as UniswapToken, CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core';
import { AlphaRouter, SwapType } from '@uniswap/smart-order-router'; // or '@uniswap/alpha-router'
import {ethers} from 'ethers';

export async function generateSwapCalldata(
    fromTokenAddress: string,
    amount: string,          // input amount in token decimals, e.g. '1000000000000000000' for 1 ETH
    toTokenAddress: string,
    toTokenDecimals: number,
    recipient: string,       // the receiver address
    provider: ethers.providers.JsonRpcProvider, // Ethers provider
    chainId: number          // e.g., 1 for mainnet
) {
    // Construct Token objects (you need token decimals)
    const fromToken = new UniswapToken(chainId, fromTokenAddress, 6); // update decimals accordingly
    const toToken = new UniswapToken(chainId, toTokenAddress, toTokenDecimals);      // update decimals accordingly

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