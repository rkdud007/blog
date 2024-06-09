_Before start, as blockchain development trend change rapidly due to emerging new innovative tools, this blog post -- written in 2024.01.21-- might not be suitable when the time you are reading this._

In this blog, I will go through:

- What is L1/L2 native messaging and why testing is important
- Categorize possible situations that need full integration test with L1/L2 messaging
- Different L2's actual native messaging implementation: Arbitrum, Optimism, Starnet, zkSync

## What is L1/L2 messaging ?

As Ethereum has moved on to roll-up centric era to solve scaling problem, lots of L2s are rised as alternatives of expensive gas price for smart contract developers. As those chains inherit security to Ethereum, each of them developed way to settle L2 state to L1. For each L2s, there is contract deployed on L1 that represent that chain, and to settle on L1 we need some how communicate with contract on L1 and contract on L2 that can access L2 state. To do this communication, L2 chains designed their own way to send messages from/to specified L1 contrac, which is call L1/L2 native messaging. As I abstract lots of concept around rolups, if you are unfamiliar with it please check the concept first.

And as the the rising needs of multi-chain access on applications due to increasing number of L2 chains users, this L1 L2 messaging system is using usefully for developers. But unfortunatley with current toolings, do full integration test around messaging is bit tricky base on the sitution.

## Categorize test situation

categorize situation that need for full-integration test in L1 L2 mesaging with two standards.

- `Integrity` : State integrity from deployed network

  - Do you need to continue with current state in already deployed testnet/mainnet network? Does the message that you are trying to send effected by previous chain state?

- `Verifiable Method` : Existance of receiver's method that can veify message

  - Do you have a logic on your message receiver's contract that after getting the message, save it to the contract's state and have a function that expose to get that data?

Based on this two standard, we can categorize situations that we face in our L1 L2 native message test.

[TODO: IMAGE OF DIAGRAM]

Now I will go through each case one by one and sort out current possible method to do integration test.

## Available approaches in each case

### Case 1. Integrity ❌ / Verifiable Method ✅
