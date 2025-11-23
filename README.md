# OneSig

OneSig is a lightweight, trust minimized system that consolidates a user ERC20 balances across multiple EVM chains and settles them into a single USDC position with one signature. It applies ideas from the Ethereum Interop Layer, using stake and challenge based verification to keep cross chain settlement practical while preserving minimal trust assumptions.

At a high level, OneSig reads a user balances on many L2s, produces a verifiable claim of total value, routes swaps through on chain liquidity, and finalizes a single USDC position on a destination chain. The goal is to feel like a single chain experience while retaining Ethereum style self custody and censorship resistance.

## Background

Ethereum rollups solved scalability but fragmented user balances. Each L2 has its own gas token, bridge, and sometimes its own wallet flow. Moving assets between them often requires trusted bridges, off chain solvers, or opaque intent systems.

The Ethereum Interop Layer, or EIL, is a family of designs and standards that aim to make this multichain environment feel like a single network. EIL builds on ERC 4337 style account abstraction, multichain signing, and a cross chain liquidity protocol. Users sign once for a multichain operation and execute calls directly from their own account on each chain.

In EIL, cross chain assets are moved through a VoucherRequest and Voucher mechanism. Users deposit assets on an origin chain and request a voucher for assets on a destination chain. Cross Chain Liquidity Providers, or XLPs, monitor protocol contracts, fulfil voucher requests, and receive fees, while a dispute system on L1 ensures that incorrect behavior can be challenged without trusting any coordinator.

OneSig takes these ideas and applies them to a focused problem: turning scattered ERC20 balances into a single USDC position with a single signature.

## What OneSig Does

Given a user address and a set of EVM chains, OneSig:

* Reads ERC20 balances for that address on each configured chain, optionally including allowances.
* Normalizes balances into a chosen stablecoin, usually USDC, using on chain price sources where possible.
* Builds an aggregation proposal that describes how to unwind positions on each chain into USDC.
* Uses chain local liquidity, typically Uniswap v3 and other DEXs, to execute swaps per chain.
* Settles a single USDC position on a target chain or recipient account.
* Wraps the whole flow in a single signature from the user, suitable for account abstraction wallets and EIL style flows.

The result is a one tap escape hatch that lets a user converge to USDC across chains without manually bridging, swapping, or managing gas on each L2.

## Architecture

### Client and SDK

The client and SDK:

* Query JSON RPC endpoints for balances, token metadata, and price quotes.
* Construct a plan that describes which tokens to unwind and which routes to use.
* Prepare a single signed authorization that can be interpreted by the coordinator contract.

The client is intended to be embedded into wallets, aggregators, and dashboards that want to offer a one click exit to USDC.

### Coordinator Contract

The coordinator contract on the target chain is responsible for:

* Receiving a signed aggregation proposal from the user.
* Verifying merkleized balance proofs or receipts from source chains when available.
* Tracking stakes posted by proposers and enforcing the challenge window.
* Finalizing settlement once the challenge period passes without a valid dispute.

This design keeps custody with the user while allowing off chain actors to help with routing and execution.

### Execution Agents

Execution agents, which can be run by integrators or independent operators, perform the heavy lifting:

* Assemble swap transactions on DEXs such as Uniswap v3, Sushiswap, or Balancer.
* Execute local swaps on each source chain to convert assets into USDC.
* Submit transactions and return proofs or receipts that the coordinator can check.

Agents are not trusted with user funds long term. Their proposals are backed by stake and can be challenged if incorrect.

### Stake and Challenge

To minimize trust, OneSig uses a simple stake and challenge model inspired by EIL:

* Proposers post a stake when submitting an aggregation and execution plan.
* A challenge window allows anyone to submit a counter proof if the plan was incorrect.
* If a challenge is valid, the stake is slashed and the state is corrected or rolled back.
* If no valid challenge is submitted, the plan is considered correct and the stake is returned.

This encourages correct behavior without requiring a central operator.

### Routing and Liquidity

Routing prioritizes on chain liquidity and simple, observable behavior:

* Use Uniswap v3 concentrated liquidity when available to reduce slippage.
* Fall back to other DEXs such as Sushiswap or Balancer when needed.
* Prefer simple multi hop routes that are easier to reason about.
* Batch smaller positions where possible to reduce transaction count.

## Why It Is Trust Minimized

OneSig inherits many of the design goals of the Ethereum Interop Layer:

* Users keep self custody. The coordinator verifies proofs and stakes but does not take custody of assets.
* Execution is transparent. All swaps and settlements occur on chain through public liquidity.
* Correctness is enforced economically through stake and challenge, not by trusting an opaque oracle or bridge.

This makes OneSig a good fit for wallets and protocols that want a simple escape to USDC while respecting Ethereum security assumptions.

## Getting Started

### Clone the repository

```bash
git clone <repo url>
cd oneSig
```

### Run the frontend

```bash
cd frontend
pnpm install
pnpm run dev --webpack
```

This starts the UI locally and allows you to demo multi chain balance aggregation and conversion flows.

### Environment configuration

Create a `.env` file and configure:

* RPC endpoints for each chain you want to support.
* A relayer or operator key for signing and sending transactions where required.

Refer to the `frontend` and `contracts` directories for the expected variable names and structure.
