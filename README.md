# 🏗 Scaffold-ETH 2




<h4 align="center">
  <a href="https://docs.scaffoldeth.io">Documentation</a> |
  <a href="https://scaffoldeth.io">Website</a>
</h4>
⚙️ Built using NextJS, RainbowKit, Hardhat, Wagmi, Viem, and Typescript.

- ✅ **Contract Hot Reload**: Your frontend auto-adapts to your smart contract as you edit it.
- 🪝 **[Custom hooks](https://docs.scaffoldeth.io/hooks/)**: Collection of React hooks wrapper around [wagmi](https://wagmi.sh/) to simplify interactions with smart contracts with typescript autocompletion.
- 🧱 [**Components**](https://docs.scaffoldeth.io/components/): Collection of common web3 components to quickly build your frontend.
- 🔥 **Burner Wallet & Local Faucet**: Quickly test your application with a burner wallet and local faucet.
- 🔐 **Integration with Wallet Providers**: Connect to different wallet providers and interact with the Ethereum network.

![Debug Contracts tab](https://github.com/scaffold-eth/scaffold-eth-2/assets/55535804/b237af0c-5027-4849-a5c1-2e31495cccb1)

## Requirements

Before you begin, you need to install the following tools:

- [Node (>= v18.18)](https://nodejs.org/en/download/)
- Yarn ([v1](https://classic.yarnpkg.com/en/docs/install/) or [v2+](https://yarnpkg.com/getting-started/install))
- [Git](https://git-scm.com/downloads)

## Quickstart

To get started with Scaffold-ETH 2, follow the steps below:

1. Clone this repo & install dependencies

```
git clone https://github.com/scaffold-eth/scaffold-eth-2.git
cd scaffold-eth-2
yarn install
```

2. Run a local network in the first terminal:

```
yarn chain
```

This command starts a local Ethereum network using Hardhat. The network runs on your local machine and can be used for testing and development. You can customize the network configuration in `hardhat.config.ts`.

3. On a second terminal, deploy the test contract:

```
yarn deploy
```

This command deploys a test smart contract to the local network. The contract is located in `packages/hardhat/contracts` and can be modified to suit your needs. The `yarn deploy` command uses the deploy script located in `packages/hardhat/deploy` to deploy the contract to the network. You can also customize the deploy script.

4. On a third terminal, start your NextJS app:

```
yarn start
```

Visit your app on: `http://localhost:3000`. You can interact with your smart contract using the `Debug Contracts` page. You can tweak the app config in `packages/nextjs/scaffold.config.ts`.

**What's next**:

- Edit your smart contract `YourContract.sol` in `packages/hardhat/contracts`
- Edit your frontend homepage at `packages/nextjs/app/page.tsx`. For guidance on [routing](https://nextjs.org/docs/app/building-your-application/routing/defining-routes) and configuring [pages/layouts](https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts) checkout the Next.js documentation.
- Edit your deployment scripts in `packages/hardhat/deploy`
- Edit your smart contract test in: `packages/hardhat/test`. To run test use `yarn hardhat:test`
- You can add your Alchemy API Key in `scaffold.config.ts` if you want more reliability in your RPC requests.

## Documentation

Visit our [docs](https://docs.scaffoldeth.io) to learn how to start building with Scaffold-ETH 2.

To know more about its features, check out our [website](https://scaffoldeth.io).

## Contributing to Scaffold-ETH 2

We welcome contributions to Scaffold-ETH 2!

Please see [CONTRIBUTING.MD](https://github.com/scaffold-eth/scaffold-eth-2/blob/main/CONTRIBUTING.md) for more information and guidelines for contributing to Scaffold-ETH 2.




# Solidity Campaigns Contract Overview

## Overview

This smart contract implements a decentralized fundraising platform on the Ethereum blockchain. It allows users to create and manage fundraising campaigns, accept donations in ETH or ERC20 tokens, and handle the distribution of funds to recipients and fee collectors. The contract is inspired by the [PotLock campaigns contract](https://github.com/PotLock/core/tree/feat/campaigns/contracts/campaigns).

## Features

- Create and manage fundraising campaigns
- Accept donations in ETH or ERC20 tokens
- Implement referral and creator fee systems
- Escrow functionality for campaigns with minimum funding goals
- Refund mechanism for failed campaigns
- Flexible fee structure with configurable protocol, referral, and creator fees

## Contract Structure

The main contract `Campaigns.sol` contains the following key components:

1. Campaign and Donation structs
2. State variables for managing campaign and donation IDs, fees, and configuration
3. Mappings for storing campaign and donation data
4. Functions for creating and updating campaigns
5. Donation processing and refund functions
6. Getter functions for retrieving campaign and donation information
7. Admin functions for updating fee structures and withdrawing stuck funds

## Key Functions

### Campaign Management

- `createCampaign`: Create a new fundraising campaign
- `updateCampaign`: Update an existing campaign (only by owner, before start)

### Donation Handling

- `donate`: Make a donation to a specific campaign
- `processEscrowedDonations`: Process escrowed donations after reaching the minimum goal
- `refundDonations`: Refund donations for failed campaigns

### Information Retrieval

- `getCampaign`: Get campaign details
- `getDonation`: Get donation details
- `getCampaignsByOwner`: Get campaigns created by a specific owner
- `getCampaignsByRecipient`: Get campaigns for a specific recipient
- `getDonationsByCampaign`: Get donations for a specific campaign
- `getDonationsByDonor`: Get donations made by a specific donor

### Admin Functions

- Update fee structures (protocol, referral, creator)
- Withdraw stuck ETH or ERC20 tokens (emergency functions)

## Security Considerations

- Uses OpenZeppelin's `Ownable` and `ReentrancyGuard` to enhance security
- Implements input validation to ensure data integrity
- Includes emergency functions to withdraw stuck funds, accessible only by the owner

## Gas Optimization

- Uses `uint256` for most numeric values
- Employs structs to group related data
- Emits events for important state changes

## Differences from PotLock Implementation

- This Ethereum implementation uses Solidity instead of Rust
- Adapts to Ethereum's transaction model and global state storage
- Utilizes OpenZeppelin libraries for standard functionalities

## Future Improvements

- Implement a multi-signature wallet for the protocol fee recipient and contract ownership
- Add support for batch operations to optimize gas usage
- Implement a time-lock mechanism for critical parameter changes
- Develop a factory contract for easier deployment and management of multiple campaign contracts

For more detailed information on the contract implementation, please refer to the `Campaigns.sol` file in the repository.