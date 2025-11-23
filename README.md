# **OneSig**

OneSig is a lightweight, trust-minimized system that consolidates a user’s ERC20 balances across many EVM chains and settles them into a single USDC position with **one signature**. It applies ideas from the Ethereum Interop Layer (EIL), using stake-and-challenge verification to make cross-chain aggregation practical while preserving self-custody and minimal trust assumptions.

OneSig reads balances across L2s, constructs a verifiable claim of total value, unwinds positions via on-chain liquidity, and finalizes a unified USDC balance on a target chain. The goal is to make the multi-chain Ethereum ecosystem feel like a single network.

---

## **Background**

Rollups solved throughput but fractured liquidity across independent L2s. Each network has separate gas, bridges, UX, and liquidity. EIL proposes a unified execution layer where users sign once and execute transactions across chains using ERC-4337-style account abstraction, multichain receipts, and a challenge-protected settlement flow.

OneSig adapts these concepts to a focused use case: converting scattered ERC20 balances into a consolidated USDC position with a single signature.

---

## **What OneSig Does**

Given a user address and a set of EVM chains, OneSig:

* Reads ERC20 balances for the address across all configured chains
* Normalizes value into USDC using on-chain prices when possible
* Builds an aggregation plan describing how to unwind each token
* Executes swaps through local liquidity (Uniswap v3, Balancer, etc.)
* Settles a single USDC balance on a chosen destination chain
* Wraps the entire flow in **one signature**, compatible with AA and EIL wallets

This gives users a one-tap exit to USDC without dealing with bridges, approvals, or gas fragmentation.

---

## **Architecture**

### **Client & SDK**

* Queries RPC endpoints for balances, metadata, and quotes
* Generates an aggregation proposal
* Produces a single signed authorization for the coordinator contract
* Designed for wallets, dashboards, and aggregators

### **Coordinator Contract (Destination Chain)**

* Receives signed aggregation proposals
* Verifies merkleized balance proofs or L2 receipts
* Tracks proposer stake and enforces a challenge window
* Finalizes USDC settlement once disputes expire

The coordinator never takes custody; it only verifies and settles.

### **Execution Agents**

* Construct swap transactions per chain
* Execute local unwinds into USDC
* Return receipts that coordinator can verify

Agents are economically incentivized and never fully trusted.

### **Stake & Challenge**

* Proposer posts stake with the aggregation plan
* Anyone may challenge with a counterproof
* Valid challenges slash stake and correct the plan
* No challenge → execution finalizes and stake is returned

A simple economic layer enforces correctness without centralized operators.

### **Routing & Liquidity**

* Prioritizes Uniswap v3 concentrated liquidity
* Falls back to Balancer, Sushi, or native pools
* Uses straightforward multi-hop routes
* Batches small positions to reduce cost

---

## **Why It Is Trust-Minimized**

OneSig inherits EIL goals:

* Users always hold custody
* All execution is on-chain and observable
* Correctness is enforced economically, not by a trusted coordinator
* Multi-chain UX behaves like a single atomic operation

---

## **Getting Started**

### **Clone the repository**

```bash
git clone <repo-url>
cd oneSig
```

---

## **Frontend**

```bash
cd frontend
pnpm install
pnpm run dev
```

This launches the UI for testing multi-chain balance aggregation and conversion flows.

---

## **Environment Configuration**

Create `.env` and configure:

* RPC endpoints for each supported chain
* Relayer/operator private key (if executing swaps)
* Coordinator contract address
* Supported ERC20 lists

Refer to the repository structure for variable names.

---

# **Running the Zircuit Mainnet Bundler with Skandha**

OneSig uses a local bundler for sending AA transactions on Zircuit mainnet.
Skandha bundles are packaged in a simple Docker runner.

### **Start the Zircuit bundler locally**

Create a .env file within `zircuit` folder with the following:
```bash
RELAYER_VALUE=<YOUR_PRIVATE_KEY> #Essential for bundler to broadcast user operations on chain.
```

```bash
cd zircuit
./skandha
```

This command launches the Skandha container, spins up the Zircuit mainnet bundler, and exposes its RPC endpoint to your local environment.

Your app can then use the bundler at:

```
http://localhost:14337/rpc
```

or the configured AA endpoint in `client.ts`
