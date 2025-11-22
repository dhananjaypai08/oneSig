import {ethers} from "ethers";

export const providers: {[key: number]: ethers.providers.JsonRpcProvider} = {
    10: new ethers.providers.JsonRpcProvider("https://virtual.rpc.tenderly.co/stitchApp/project/private/eil-op/090dfde9-0c04-4a42-a236-de3427df29c8"),
    42161: new ethers.providers.JsonRpcProvider("https://virtual.rpc.tenderly.co/stitchApp/project/private/eil-arb/05b28599-1cde-4a79-aff2-d275bffc6017"),
    8453: new ethers.providers.JsonRpcProvider("https://virtual.rpc.tenderly.co/stitchApp/project/private/eil-base/7e7c502b-2f81-4fd2-87ea-33bc2ae559d9")
}
