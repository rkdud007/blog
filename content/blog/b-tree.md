+++
title = "B-tree and database"
date = "2024-08-12T15:17:44-04:00"
tags = ["computer science", "database", "data structure" ]
draft = true
+++

## B-tree

B-tree is simply the tree that have multi-way(multi children more than 2), but with some constraint to keep the balance of the tree.

For a B-tree of maximum degree M (or order M):
- Minimum degree t = ⌈M/2⌉ (ceiling of M/2)
- Minimum number of children for non-root internal nodes = t
- Maximum number of children for any node = M

Here are constraints for the B-tree above:
- Non-root nodes must have between t and M children
- The root can have between 2 and M children (if it's not a leaf)
- keys = children - 1

### Insert

Until node reach to maximum number of keys, just insert sequentially. When it reached maximum number, need to split into 2 part and each child nodes should satisfy minimum number of keys([M/2] - 1). And this check should happen recursively as applied to all leaf nodes as constraint. See the example of degree 5 split below:

![1](/images/btree/insert.png)


### Traverse

Pretty straight forward. Just compare keys with target key to find from root node until reach correct node. O(log_M n) with maximum degree M with total n keys.


### Delete


![1](/images/btree/delete.png)


## Resources found it helpful

- https://youtu.be/aZjYr87r1b8?si=etqU3TXUItqvLsim: helpful to understand "why" b-tree is useful in database.
- https://www.youtube.com/watch?v=0SCtnf84QrI&list=PL8FaHk7qbOD41EHkD7CgQuRw1jpH_Fv7-&index=1&t=1s : helpful to get sense with Big O with tree
- https://www.youtube.com/watch?v=K1a2Bk8NrYQ: visualization video for B-tree
- https://www.cs.usfca.edu/~galles/visualization/BTree.html: visualization page, can play around with insert, find, delete operation.
