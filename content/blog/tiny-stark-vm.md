+++
title = "tiny stark vm"
date = "2024-07-15T09:09:44-04:00"
[params]
  math = true
tags = ["tech", "cryptography"]
+++

### Tiny STARK VM

Recently i had challenged my self to build zkVM from scratch for fun. Heavily inspired by amazing [tutorial from Alan](https://neptune.cash/learn/brainfuck-tutorial/#1).

- Converting original statement, claim into something that looks mathematically clean and possibly quite provable

### Simulate

simulation step is when you actually execute the code, and also generate the trace.

### Trace

trace is the object that tracks the data of execution so that prover can generate execution proof out of it.
trace is also called as witness.

### Padding the trace

- To meet the requirement to do FFT on polynomial, we need radix 2 polynomial (= degree of polynomial should be 2^n). So after getting pure execution trace, we can pad empty cells to make trace size to be come 2^n format.
- we add padding to increase entropy

### Claim

Something that you want to prove. Lets say there is public function F(x), when x = a, F(a) = b. Something like this. this F, a, b is the information that is known for prover and verifier both.
Another word, claim the the statement that prover wants to argue about truth to verifier.

### Prove

proving step, prover gets trace and claim and returning proof about execution.

prover Constructing Trace Polynomials

and then using this polynomial, prover construct merkle tree

commit

use this root as seed for constructing next tree

commit

...

broadcast this final proof that contains commitments.

### Verify

---

Some abstract algebra i learned

### Moduler Arithmetic

- r ⊕ s = (r + s) mod n
- r \* s = (rs) mod n

### Group

A group is a set of elements G = {a, b, c, . . .}

### Abelian Group

Extension of group that satisfies commutative axiom.

### Cyclic groups

G = {g, g ⊕ g, g ⊕ g ⊕ g,...}

g is the generator of this group.

### Field

A field is a set F of at least two elements, with two operations ⊕ and \*

### Prime field

A fundamental example of a finite (Galois) field is the set \(F_p\) of mod-p remainders, where p is a given prime number

---

Resource

- https://web.stanford.edu/~marykw/classes/CS250_W19/readings/Forney_Introduction_to_Finite_Fields.pdf: great resource of basic abstract algebraic structures
