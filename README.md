# Dusk ITN staking contract

An updated and simplified implementation of the Unipool staking contract.
Instead of giving a claimable ERC20, this contract allows users to check how much they have accrued in rewards. These values will later be used during the bridging of ERC20 DUSK on mainnet, and function as an IOU.

An extensive test suite has been added to test the functioning of the contract.

## Prerequisites

- Node.js v17.x or later
- NPM

## Installation

1. Clone the repository:

```bash
git clone https://github.com/dusk-network/ITN-staking.git
```

2. Install dependencies:

```bash
npm install
```

## Running Tests

Run the tests by executing:

```bash
npm test
```

Running a local node can be done by executing:

```bash
npm run node
```

The deploy script on the local node can be executed by running:

```bash
npm run deploy
```
