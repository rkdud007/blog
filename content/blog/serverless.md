+++
title = "Serverless"
date = "2024-08-14T15:17:44-04:00"
tags = ["serverless", "learning"]
draft = true
+++



### Micro VM
- container is just an isolated container on linux machine
- serverless context ( means running arbitrary function from external user), definetly prefer kernel level isolation not just container level where they would not use shared kernels or containers.
- legacy vm is really slow. alot of start up time to boot is needed, also it doesn't have API to interact
- micro vm = feels same as container but providing isolation as same level as legacy vm

### Wasm
- https://webassembly.github.io/spec/core/exec/index.html

- WebAssembly (abbreviated Wasm) is a binary instruction format for a stack-based virtual machine. Wasm is designed as a portable compilation target for programming languages, enabling deployment on the web for client and server applications.

- wasm need their own runtime. e.g [wasmtime](https://github.com/bytecodealliance/wasmtime?tab=readme-ov-file)


### proc_macro

```sh
Thank you for providing this additional information. The issue you're seeing is due to a misinterpretation of the pointer and size in the macro expansion. Let's break down what's happening:

In your test, you're passing data.as_ptr() as i64 and data.len() as i64.
The macro is then interpreting these values as a raw pointer and a size, respectively.
However, when you cast a pointer to an i64 and then back to a pointer, you're losing information on 32-bit systems or when the pointer is not in the lower 64 bits of memory.

To fix this, we need to adjust how we pass and interpret the data. Here's a corrected version of the macro:
Corrected xxfunc proc-macroClick to open code
Now, let's update the test file to use this corrected macro:
Updated xxfunc test fileClick to open code
The key changes are:

The macro now declares the external function with *const u8 for the data pointer and usize for the size, which correctly represents a raw pointer and a size.
In the test, we're now passing data.as_ptr() and data.len() directly, without casting to i64.

These changes should resolve the data corruption issue you were seeing. The custom_function should now receive the correct data without any changes to the values.
To use this updated setup:

Update your xxfunc-macro crate with the new implementation.
Update your xxfunc-test crate with the new test file.
Run cargo test in the xxfunc-test directory.

This corrected version should maintain the integrity of your data and the test should pass. The sum of [1, 2, 3, 2, 4, 5] is 17, so I've updated the assertion to match this.
If you're still encountering any issues, please let me know, and I'll be happy to help further.
```

- https://www.micahlerner.com/2021/06/17/firecracker-lightweight-virtualization-for-serverless-applications.html
- https://jvns.ca/blog/2021/01/23/firecracker--start-a-vm-in-less-than-a-second/
- https://youtu.be/CYCsa5e2vqg
- https://www.usenix.org/conference/nsdi20/presentation/agache
- https://www.usenix.org/system/files/nsdi20-paper-agache.pdf
- https://www.helius.dev/blog/solana-geyser-plugins-streaming-data-at-the-speed-of-light
