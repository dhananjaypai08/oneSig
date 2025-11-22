import { Token, TokenAddresses } from "@/types/token"
import { CrossChainSdk, FunctionCallAction, CallAction, IMultiChainSmartAccount, ExecCallback } from "@eil-protocol/sdk"
import { Address, erc20Abi, Hex } from "viem"
import { generateSwapCalldata } from "./uniswap"
import { providers } from "./ethersProviders"
import { parseUnits } from "viem/utils"

const ChainIds = [42161, 8453, 10]

const useropOverride = {
    maxFeePerGas: BigInt(1000000000),
    maxPriorityFeePerGas: BigInt(10)
}

const USDC_DECIMALS = 6

export async function dustSweep(
    wallet: Address,
    sdk: CrossChainSdk,
    account: IMultiChainSmartAccount,
    tokens: {[key: number]: Token[]},
    callback: ExecCallback
) {
    console.log("[DustSweep] Starting dust sweep...", { wallet, tokens })

    const builder = sdk.createBuilder()

    for (const chainId of ChainIds) {
        const chainTokens = tokens[chainId] || []
        if (chainTokens.length === 0) {
            console.log(`[DustSweep] No tokens to sweep on chain ${chainId}`)
            continue
        }

        // console.log(`[DustSweep] Processing chain ${chainId} with ${chainTokens.length} tokens`)

        const batchBuilder = builder.startBatch(BigInt(chainId)).overrideUserOp(useropOverride)

        for (const token of chainTokens) {
            console.log(`[DustSweep] Generating swap for ${token.name}:`, {
                address: token.address,
                value: parseUnits("0.01", token.decimals).toString(),
                decimals: token.decimals,
            })

            try {
                const uniswapCalldata = await generateSwapCalldata(
                    token.address,
                    parseUnits("0.01", token.decimals).toString(),
                    TokenAddresses[chainId]["USDC"],
                    USDC_DECIMALS,
                    wallet,
                    providers[chainId],
                    chainId,
                    token.decimals
                )

                console.log(`[DustSweep] Swap calldata generated for ${token.name}`)

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
            } catch (error) {
                console.error(`[DustSweep] Failed to generate swap for ${token.name}:`, error)
                throw error
            }
        }

        batchBuilder.endBatch()
    }
    const executor = await builder.useAccount(account).buildAndSign();
    console.log("executor: ", executor);

    console.log("[DustSweep] Executing transaction...")
    console.log(executor)
    executor.execute(callback)
}