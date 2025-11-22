import { Token, TokenAddresses } from "@/types/token";
import { CrossChainSdk, FunctionCallAction, CallAction, IMultiChainSmartAccount, ExecCallback } from "@eil-protocol/sdk"
import { Address, erc20Abi, Hex } from "viem";
import { generateSwapCalldata } from "./uniswap";
import { providers } from "./ethersProviders";

const ChainIds = [42161, 8453, 10];


const useropOverride = {
    maxFeePerGas: BigInt(1000000000),
    maxPriorityFeePerGas: BigInt(10)
}

export async function dustSweep(
    wallet: Address,
    sdk: CrossChainSdk,
    account: IMultiChainSmartAccount,
    tokens: {[key: number]: Token[]},
    callback: ExecCallback
) {
    const builder = sdk.createBuilder();
    for (const chainId of ChainIds) {
        const batchBuilder = builder.startBatch(BigInt(chainId)).overrideUserOp(useropOverride)
        for(const token of tokens[chainId]) {
            const uniswapCalldata = await generateSwapCalldata(
                token.address,
                token.value.toString(),
                TokenAddresses[chainId]["USDC"],
                wallet,
                providers[chainId],
                chainId
            );

            batchBuilder.addAction(new FunctionCallAction({
                target: token.address,
                abi: erc20Abi,
                functionName: "approve",
                args: [uniswapCalldata.to, token.value]
            }))

            batchBuilder.addAction(new CallAction({
                to: uniswapCalldata.to as Address,
                data: uniswapCalldata.calldata as Hex,
            }))
        }
        batchBuilder.endBatch();
    }
    const executor = await builder.useAccount(account).buildAndSign();
    executor.execute(callback)
}