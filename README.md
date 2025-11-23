OneSig

OneSig is a lightweight, trust-minimized tool that consolidates a user’s ERC-20 balances across multiple EVM chains and atomically converts them into a single stablecoin position. Inspired by the Ethereum Interop Layer (EIL) design, OneSig enables cross-chain balance aggregation, routing, and on-chain settlement with explicit staking & challenge mechanics to minimize trust assumptions while remaining practical for end users (wallets, aggregators, hackathon demos).

What it does:

1. Given a user address and a list of EVM chains, One Sig:
2. Reads ERC-20 balances (and optional allowances) for that address on each chain.
3. Constructs a verifiable claim of aggregated value denominated in a chosen stablecoin (e.g., USDC).
4. Executes cross-chain conversion by routing swaps on native AMMs / liquidity sources and settling a single stablecoin on a target chain or recipient wallet.
5. Uses a small economic stake + challenge window to ensure correctness of cross-chain proofs and conversions in a trust-minimized manner.

Architecture:

Client / SDK: Multi-chain reader that queries JSON-RPC providers for balances, token metadata, and live price quotes (on-chain where possible; fallbacks to oracle or indexer).

Coordinator Contract (on target chain): Receives a signed aggregation proposal, verifies merkleized balance proofs/receipts from source chains (using light client-ish receipts or fraud-proof hooks inspired by EIL), and accepts a stake from the proposer.

Execution Agents: Off-chain relayers (or the proposer) assemble swap transactions across DEXs (Uniswap v3, Sushiswap, Balancer) and submit a signed execution plan. On-chain settlement occurs only after challenge window.

Stake & Challenge: Proposer posts stake; anyone can challenge within a time window with a counter-proof. If challenge succeeds, stake slashed and state rolled back / corrected; otherwise, proposer’s execution proceeds and stake returned.

Routing: Uses multi-hop routing with Uniswap v3 concentrated liquidity where available to reduce slippage and gas. Optionally aggregates liquidity via on-chain batching (for small tokens) to reduce tx counts.

Security primitives: Merkleized state snapshots, simple fraud-proof interface, ECDSA/eth_sign attestations, replay protection, and replay-resistant nonces per chain.

Why this is trust-minimized:

1. No single operator holds custody: the coordinator only accepts signed, verifiable proofs and requires proposer stake.
2. Challenge window + on-chain verification replicates EIL’s philosophy: correctness enforced economically instead of relying on a centralized oracle.
3. Uses existing battle-tested on-chain liquidity (Uniswap v3) for swaps to minimize composability & MEV surface.

Stack:

Ethereum Foundation: Research + protocol thinking — One Sig applies EIL concepts (stake, fraud proofs, minimal verification) to a practical UX problem (cross-chain balance consolidation), demonstrating research → implementation.

Uniswap Foundation: Deep Uniswap integration — routing leverages concentrated liquidity and v3 pools to minimize slippage and gas; demonstrates composability and liquidity-efficient conversions for real user balances.

Zircuit (interop / zk / scalability sponsors): Designed for modular zk substitution — proofs can be upgraded to succinct zk attestations for faster finality and smaller on-chain verification costs, improving scalability and privacy for future iterations.

Quick start: 

1. Clone repo
2. yarn install
3. Configure /.env with RPC endpoints for desired chains and a relayer private key
4. yarn start — opens UI at http://localhost:3000 to demo aggregation and conversion flows

Next steps:

1. Replace fraud proofs with succinct zk attestations for instant finality.
2. Integrate gasless relays and paymaster flows for onboarding.
3. On-ramp for non-ERC20 assets (wrapped BTC, tokenized positions).
