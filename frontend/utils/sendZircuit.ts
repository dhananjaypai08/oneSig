import { WETH_ABI } from "@/types/abi";
import { createPublicClient, encodeFunctionData, formatUnits, Hex, http, parseUnits, publicActions, SignAuthorizationReturnType, walletActions } from "viem"
import { createBundlerClient, toSimple7702SmartAccount } from "viem/account-abstraction";
import { privateKeyToAccount } from "viem/accounts"
import { zircuit } from "viem/chains";

const ZIRCUIT_WETH = "0x4200000000000000000000000000000000000006" as const;

// Create a public client for reading balances
const publicClient = createPublicClient({
    chain: zircuit,
    transport: http("https://zircuit1-mainnet.p2pify.com")
});

// Get ETH and WETH balances for the smart account
export const getZircuitBalances = async (): Promise<{ ethBalance: string; wethBalance: string; address: string }> => {
    const owner = privateKeyToAccount(process.env.NEXT_PUBLIC_PRIVATE_KEY! as Hex);

    const bundlerClient = createBundlerClient({
        transport: http("http://localhost:14337/rpc"),
        chain: zircuit
    }).extend(publicActions).extend(walletActions)

    const smartAccount = await toSimple7702SmartAccount({
        client: bundlerClient,
        owner,
        implementation: "0xa46cc63eBF4Bd77888AA327837d20b23A63a56B5",
    });

    const walletAddress = smartAccount.address;

    // Get ETH balance
    const ethBalanceRaw = await publicClient.getBalance({
        address: walletAddress
    });

    // Get WETH balance
    const wethBalanceRaw = await publicClient.readContract({
        address: ZIRCUIT_WETH,
        abi: WETH_ABI,
        functionName: "balanceOf",
        args: [walletAddress]
    }) as bigint;

    return {
        ethBalance: formatUnits(ethBalanceRaw, 18),
        wethBalance: formatUnits(wethBalanceRaw, 18),
        address: walletAddress
    };
};

export const wrapEthToWeth = async (amount: string) => {
    const owner = privateKeyToAccount(process.env.NEXT_PUBLIC_PRIVATE_KEY! as Hex);

    const bundlerClient = createBundlerClient({
        transport: http("http://localhost:14337/rpc"),
        chain: zircuit
    }).extend(publicActions).extend(walletActions)

    const smartAccount = await toSimple7702SmartAccount({
        client: bundlerClient,
        owner,
        implementation: "0xa46cc63eBF4Bd77888AA327837d20b23A63a56B5",
    });


    smartAccount.entryPoint.address = "0x433709009B8330FDa32311DF1C2AFA402eD8D009" // overriding to ep9 address

    console.log("wallet:: ", smartAccount.address);

    // check sender's code to decide if eip7702Auth tuple is necessary for userOp.
    const senderCode = await bundlerClient.getCode({
        address: smartAccount.address
    });

    let authorization: SignAuthorizationReturnType | undefined;
    const { address: delegateAddress } = smartAccount.authorization;

    if(senderCode !== `0xef0100${delegateAddress.toLowerCase().substring(2)}`) {
        authorization = await bundlerClient.signAuthorization(smartAccount.authorization)
    }

    console.log("authorization:: ", authorization);

    const userOpHash = await bundlerClient.sendUserOperation({
        account: smartAccount,
        authorization,
        calls: [
            {
                to: ZIRCUIT_WETH,
                value: parseUnits(amount, 18),
                data: encodeFunctionData({
                    abi: WETH_ABI,
                    functionName: "deposit"
                })
            }
        ]
    });

    console.log("userOpHash:: ", userOpHash);

    // Wait for the user operation receipt to get the actual transaction hash
    const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
    console.log("txHash:: ", receipt.receipt.transactionHash);
    return receipt.receipt.transactionHash;
}

export const unwrapWethToEth = async (amount: string) => {
    const owner = privateKeyToAccount(process.env.NEXT_PUBLIC_PRIVATE_KEY! as Hex);

    const bundlerClient = createBundlerClient({
        transport: http("http://localhost:14337/rpc"),
        chain: zircuit
    }).extend(publicActions).extend(walletActions)

    const smartAccount = await toSimple7702SmartAccount({
        client: bundlerClient,
        owner,
        implementation: "0xa46cc63eBF4Bd77888AA327837d20b23A63a56B5",
    });


    smartAccount.entryPoint.address = "0x433709009B8330FDa32311DF1C2AFA402eD8D009" // overriding to ep9 address

    console.log("wallet:: ", smartAccount.address);

    // check sender's code to decide if eip7702Auth tuple is necessary for userOp.
    const senderCode = await bundlerClient.getCode({
        address: smartAccount.address
    });

    let authorization: SignAuthorizationReturnType | undefined;
    const { address: delegateAddress } = smartAccount.authorization;

    if(senderCode !== `0xef0100${delegateAddress.toLowerCase().substring(2)}`) {
        authorization = await bundlerClient.signAuthorization(smartAccount.authorization)
    }

    console.log("authorization:: ", authorization);

    const userOpHash = await bundlerClient.sendUserOperation({
        account: smartAccount,
        authorization,
        calls: [
            {
                to: ZIRCUIT_WETH,
                data: encodeFunctionData({
                    abi: WETH_ABI,
                    functionName: "withdraw",
                    args: [parseUnits(amount, 18)]
                })
            }
        ]
    });

    console.log("userOpHash:: ", userOpHash);

    // Wait for the user operation receipt to get the actual transaction hash
    const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash });
    console.log("txHash:: ", receipt.receipt.transactionHash);
    return receipt.receipt.transactionHash;
}

// Legacy export for backwards compatibility
export const send = wrapEthToWeth;