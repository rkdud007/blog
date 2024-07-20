+++
title = "Merkle Sum Tree Attack PoC"
date = "2023-03-15T09:09:44-04:00"
tags = ["cryptography", "security"]
+++

# Overview

The following article is focused on explaining PoC that did to reproduce the vulnerability that was described in this [paper](https://eprint.iacr.org/2022/043.pdf).

The attack is targeting the `Merkle Sum Tree` data structure, that is used in [Summa Protocol](https://github.com/summa-dev/summa-solvency) to provide [Proof of Solvency](https://vitalik.eth.limo/general/2022/11/19/proof_of_solvency.html). As Summa modified their implementation slightly to deal with vulnerability, we'll go through how's the modification and how we tried PoC to attack to verify it's indeed safe.

You could check full PoC code in this [PR](https://github.com/rkdud007/summa-solvency/pull/1).

## Merkle Sum Tree

As the original Merkle Sum Tree is broken and it has a vulnerability where the custodian can build MerkleTree where the balance of middle nod v can be ` max(vr, vl) <= v <= vr + vl, when vr is a balance of right node, vl is a balance of left node`. Detail attack factor is described in this [paper](https://eprint.iacr.org/2022/043.pdf). Summa's Merkle tree constructs a middle node that overcomes this vulnerability.

## Summa's Merkle Sum Tree

Summa's implementation of the Merkle Sum Tree is designed for higher efficiency and addresses the vulnerabilities found in the Original Merkle Sum Tree, as described in a particular paper. It includes zkProofs for verifying tree integrity without revealing user details and an efficient approach for hashing in the middle nodes.

### Middle Node Hash Comparison

| **Attribute** | **Broken Merkle Tree**                                                                                                                                                                              | **Summa's Approach**                                                                                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Formula**   | `H(LeftChild.hash, LeftChild.balance[0], LeftChild.balance[1], ..., LeftChild.balance[N_ASSETS], RightChild.hash, RightChild.balance[0], RightChild.balance[1], ..., RightChild.balance[N_ASSETS])` | `H(LeftChild.balance[0] + RightChild.balance[0], LeftChild.balance[1] + RightChild.balance[1], ..., LeftChild.balance[N_ASSETS - 1] + RightChild.balance[N_ASSETS - 1], LeftChild.hash, RightChild.hash)` |
| **Size**      | `2 * (1 + N_ASSETS)`                                                                                                                                                                                | `N_ASSETS + 2`                                                                                                                                                                                            |

Broken Merkel Sum Tree is a solution to the Original Merkle Sum Tree’s vulnerability from this [paper](https://eprint.iacr.org/2022/043.pdf). As means, it has zkProof for verifying the tree’s integrity without revealing detailed info about the user(solution 2) and implemented middle node’s hash in hash(vl || vr || || h(l) || h(r)) this format (solution 1). However, in terms of efficiency, Summa takes a unique approach to hash.

Compared to the original middle node hash described on paper as a Broken Merkle Tree, for shorter hashing and cost for building the tree, building the zk proof of inclusion, Summa’s middle node hash formula is designed differently in this [PR](https://github.com/summa-dev/summa-solvency/issues/166).

## Summa's MST Implementation Table

### Leaf Node

| **Attribute** | **Formula**                                                       |
| ------------- | ----------------------------------------------------------------- |
| **Hash**      | `H(username, balance[0], balance[1], ..., balance[N_ASSETS - 1])` |
| **Balance**   | `balance[0], balance[1], ..., balance[N_ASSETS - 1]`              |

### Middle Node

| **Attribute** | **Formula**                                                                                                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hash**      | `H(LeftChild.balance[0] + RightChild.balance[0], LeftChild.balance[1] + RightChild.balance[1], ..., LeftChild.balance[N_ASSETS - 1] + RightChild.balance[N_ASSETS - 1], LeftChild.hash, RightChild.hash)` |
| **Balance**   | `LeftChild.balance[0] + RightChild.balance[0], LeftChild.balance[1] + RightChild.balance[1], ..., LeftChild.balance[N_ASSETS - 1] + RightChild.balance[N_ASSETS - 1]`                                     |

## PoC

To revive the broken Merkle Sum Tree attack, will follow the PoC steps below:

1. Corrupt Merkle Sum Tree Construction: will alter the construction of the middle node value into `max(vr, vl)`.
2. Corrupt proof generation: to fully attack this Merkle Sum Tree, need to corrupt proof generation so that the output of the proof should be valid in the original Merkle Sum Tree inclusion proof verification step.

Turned out that when trying to build a Tree in `max(vr, vl)` this value, and turn out cannot corrupt both balance and hash at the same time when following Summa's Merkle Sum Tree implementation.

## Corrupt Merkle Sum Tree Construction

commit: https://github.com/rkdud007/summa-solvency/pull/1/commits/774d68a6d52734831821eba5bd7062505e9a8aa8

This commit simply changed tree construction logic instead of using `vr + vl`, use `max(vr, vl)`. So I called it as `Corrupted Mekle Sum Tree`.

As we expected, the generated proof doesn't pass the verification.

cargo run --release --example gen_inclusion_proof

```
Start:   Creating params
End:     Creating params ...........................................................16.279ms


Start:   Creating proof
thread 'main' panicked at 'assertion failed: result.is_ok()', /Users/piapark/Documents/GitHub/summa-solvency/zk_prover/src/circuits/utils.rs:193:5
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```

## Corrupt Balance on generating proof

commit: https://github.com/rkdud007/summa-solvency/pull/1/commits/7130a8645675736c86b1cdd54bdd810aea8f98cb

We also want to corrupt proof generation logic, so that non-corrupted Merkle inclusion proof verification should pass with corrupted proof and commit.

As corruption happened in switching the parent node balance into `max(vr, vl)`, the expected corrupted proof should be `max(vr, vl) - current balance` for all `N_CURRUNCIES`.

<img width="661" alt="Screenshot 2024-03-05 at 6 58 28 PM" src="https://github.com/rkdud007/summa-solvency/assets/76558220/3e5b2759-8e1b-462f-8ec8-6cca4651ffce">

## Corrupt Hash on generating proof

As verification checks both balance and hash from proof ( list of path nodes ), we also need to corrupt the hash of this proof.

As we need to match with corrupted construction's result root node, ( both balance and hash )
hash generation should follow the corrupted tree building.

During construction with maximum value for middle nodes, the middle node's hash is already corrupted with maximum value. But especially in level 1, the child node's hash are same as the original as it is a leaf node.

<img width="577" alt="Screenshot 2024-03-05 at 7 38 03 PM" src="https://github.com/rkdud007/summa-solvency/assets/76558220/00344b55-a5fa-4faf-881b-ff96077abaee">

During proof generation, for example in `Claire` case, start from the sibling leaf node, and all the path node's hash is corrupted not only due to balance but also from the child node hash itself ( as it requires corruption on the leaf node also )

<img width="430" alt="Screenshot 2024-03-05 at 7 39 51 PM" src="https://github.com/rkdud007/summa-solvency/assets/76558220/7573fdee-7653-49b5-964a-9139d539ab8c">

## Conclusion

Our goal for exploiting this vulnerability is to match root `0xcorruptedhash` with root `0xcorruptedwithmaximumhash`. As the verification is happening while getting path nodes from proof ( provided leaf and middle node preimages ) and operating summing the balance & hash it within the balance and child hashes, It is impossible to corrupt both balance and hash at the same time. Balance corruption will determine the corrupted hash value, which will not match with `0xcorruptedwithmaximumhash` that cannot be corrupted with proof generation.

So we could say Summa's modified Merkle Sum Tree implementation is indeed safe through this attack PoC.

Specially Thanks to [0xPanicError](https://twitter.com/0xpanicError) for doing PoC with me together, thanks to Summa core developers especially [Enrico](https://twitter.com/backaes) for providing a detail explanation of Summa protocol, thanks to [yAcademy](https://twitter.com/yAcademyDAO) for have me in amazing zk fellowship.
