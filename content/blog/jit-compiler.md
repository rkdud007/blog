+++
title = "What is JIT (just-in-time) compiler?"
date = "2024-08-10T15:17:44-04:00"
tags = ["computer science", "compiler" ]
+++

> _this post is part of my learning journey to understand compiler and compiler architecture. I'm not an expert in compiler, so if you find any mistake, please let me know._

### What is JIT (just in time compiler)

I kinda know what compiler does, but didn't get what does it mean by "just in time" and why it is important. So decided to dive more deep into it.

![jit](/images/jit.png)
(diagram from [lecture](https://vod.video.cornell.edu/media/1_ltb1t94i))

JIT (just in time compiler) can be said as dynamic code generation, dynamic compilation. Compare to static compilation that just purely compile without any knowlege runtime, with JIT, **compiler can get knowlege of runtime inforamtion, that can be used for optimized execution**. This is impossible of AOT(ahead of time), static compilation because compile stage and execution stage is totally seperate.

So for that reason many modern languages mixing this compile stage with execution stage such as using JIT method to get most optimized performances. Dynamic languages like [javascript](https://v8.dev/blog/maglev), [python](https://peps.python.org/pep-0744/) etc getting benefit for faster interpret base of optimized feedbacked compile stages involve.

JIT compiler can be implemented with VM such as [JVM(Java)](https://www.ibm.com/docs/en/sdk-java-technology/8?topic=reference-jit-compiler), [Erlang VM](https://www.erlang.org/doc/apps/erts/beamasm.html), [Android Runtime](https://source.android.com/docs/core/runtime/jit-compiler) blockchain runtimes such as [EVM](https://www.paradigm.xyz/2024/06/revmc), [Cairo](https://github.com/lambdaclass/cairo_native), [SVM](https://github.com/solana-labs/rbpf).

Or could design like [Julia](https://docs.julialang.org/en/v1/devdocs/eval/#dev-codegen) which behaves like AOT compiler.

Most popular approach is so called as, method JIT, which function as a unit. During the execution by observing frequency of function heuristicly determine optimization level like is cold, hot. Usually hot means it had executed frequently, so target to be optimized using JIT. There is other approach base on execution trace, called tracing JIT. Throughout control flow graph, you extract the "hot" path, from trace that actually executed.

### Tiny JIT implementation

so implement on _super_ naive approach to simply get grasp of how it works:

- **Interpreter** : Just execute the instruction and while run it profiles to observe if function is hot. And detact if function had already jit compiled, execute native machine code instead of execute instruction.
- **Profiling** : `execution_count` to track execution time of function. so just simply if funciton got executed 10 times, turned interpreter into jit compile mode.
- **JIT compile** : from given instruction, generated native machine code and cache the pointer for further execution.

### mmap

To implement JIT, i had to alter the memory segment to compiled machine code by JIT and later execute this code. Common way to implement this is use [`mmap` unix system call](https://man7.org/linux/man-pages/man2/mmap.2.html) which creates a new mapping in the virtual address space of the calling process.

One interesting thing i found was, compare to original unix syscall, my machine(M2 mac, ARM64) syscall support [`MAP_JIT` flag](https://developer.apple.com/documentation/bundleresources/entitlements/com_apple_security_cs_allow-jit) that create memory that’s both writable and executable in hardened environment.

### jit_compile in Interpreter

So here simple `jit_compile` method of `Interpreter`. There is two part 1) hand-written machine code generation 2) JIT mechanics that envolves write/execute. Opcode used here is [ADD(immediate)](https://developer.arm.com/documentation/dui0801/g/A64-General-Instructions/ADD--immediate-?lang=en).

Regarding JIT mechanics, i got idea from [this tutorial](https://github.com/spencertipping/jit-tutorial), but in mac it returned permission error `mmap failed: Permission denied (os error 13)`. So i first gave write permission of virtual address space, and then copy the machine code to permissioned space using [`memcopy` syscall](https://man7.org/linux/man-pages/man3/memcpy.3.html)(= `copy_nonoverlapping`). And last, with [`mprotect` syscall ](https://man7.org/linux/man-pages/man2/mprotect.2.html) provided execution permission to new address space to run machine code in further execution.

```rust
fn jit_compile(&self, pc: usize) -> (*mut u8, usize) {
    // 1) generate machine code (ARM64)
    let (machine_code, code_len) = match &self.code[pc] {
        Instruction::Add(x, y) => {
            let mut code = vec![
                0x20, 0x00, 0x00, 0x8B, // ADD X0, X0, X1
                0x00, 0x04, 0x00, 0x91, // ADD X0, X0, #1 (placeholder for x)
                0x00, 0x08, 0x00, 0x91, // ADD X0, X0, #2 (placeholder for y)
                0xC0, 0x03, 0x5F, 0xD6, // RET
            ];

            // Encode immediate values (12-bit, shifted left by 10)
            let imm_x = ((*x as u32) & 0xFFF) << 10;
            let imm_y = ((*y as u32) & 0xFFF) << 10;
            code[4..8].copy_from_slice(&(0x91000000 | imm_x).to_le_bytes());
            code[8..12].copy_from_slice(&(0x91000000 | imm_y).to_le_bytes());

            (code, 16)
        }
    };

    let alloc_size = PAGE_SIZE;

    // 2) JIT mechanics
    unsafe {
        let ptr = mmap(
            std::ptr::null_mut(),
            alloc_size,
            PROT_WRITE,
            MAP_PRIVATE | MAP_ANON,
            -1,
            0,
        ) as *mut u8;

        if ptr == libc::MAP_FAILED as *mut u8 {
            panic!("mmap failed: {}", std::io::Error::last_os_error());
        }

        std::ptr::copy_nonoverlapping(machine_code.as_ptr(), ptr, code_len);

        // Now make the memory executable
        if mprotect(ptr as *mut libc::c_void, alloc_size, PROT_EXEC) != 0 {
            panic!("mprotect failed: {}", std::io::Error::last_os_error());
        }

        println!("Memory protection changed successfully");
        (ptr, alloc_size)
    }
}
```

### Why LLVM

So as we take a look at simple JIT compile, it is indeed not optimal to turn raw machine code by hand. Why? 1) it is pretty unsafe as compiler have permission to write and execute directly -- could lead to malware 2) for complex program -- not just addition like our example -- it's quite inefficient to run hand written machine code.

So instead of turning our hot function to raw machine code, we can turn it into [LLVM IR](https://llvm.org/docs/LangRef.html#id1899) and let LLVM to handle our IR to machine code so it abstracts away many of the low-level details that allows to focus on higher-level optimizations and language features.

Also another cool compiler backend [cranelift](https://cranelift.dev/) worth checking out.

```rust
// Direct Machine Code Generation (simplified)
fn generate_add(x: i32, y: i32) -> Vec<u8> {
    let mut code = vec![
        0x20, 0x00, 0x00, 0x8B, // ADD X0, X0, X1
        0x00, 0x04, 0x00, 0x91, // ADD X0, X0, #imm (x)
        0x00, 0x08, 0x00, 0x91, // ADD X0, X0, #imm (y)
        0xC0, 0x03, 0x5F, 0xD6, // RET
    ];
    // Complex encoding logic here...
    code
}

// LLVM IR Generation (pseudo-code)
fn generate_add_llvm(x: i32, y: i32) -> String {
    format!("
        define i32 @add(i32 %a, i32 %b) {{
            %sum1 = add i32 %a, %b
            %sum2 = add i32 %sum1, {}
            %result = add i32 %sum2, {}
            ret i32 %result
        }}
    ", x, y)
}
```

### Security

JIT's sophisticated optimization could lead in security issue. Check out [this blog](https://googleprojectzero.blogspot.com/2020/09/jitsploitation-one.html?m=1) for further information.

### Futher reading

[CS 6120: Lesson 11: Dynamic Compilers](https://vod.video.cornell.edu/media/1_ltb1t94i) from Adrian Sampson really helped me on understanding spectrum of compiler/interpreter.

this basic tutorials about [Unix shell](https://github.com/spencertipping/shell-tutorial), [JIT](https://github.com/spencertipping/jit-tutorial) helped alot on understanding.

- [webkit FTI JIT](https://webkit.org/blog/3362/introducing-the-webkit-ftl-jit/)

- There is some discussion around AOT vs JIT, [Angular: Is AOT Worth It?](https://blog.nrwl.io/angular-is-aot-worth-it-8fa02eaf64d4), [aot_vs_jit_comilation](https://www.reddit.com/r/Compilers/comments/19ctf7p/aot_vs_jit_comilation/)

And some other resources that i found interesting while researching

- https://www.linkedin.com/pulse/understanding-jit-aot-compilation-dart-marwa-aldaya-tnycf/
- https://www.ibm.com/docs/en/sdk-java-technology/8?topic=reference-jit-compiler
- https://kobzol.github.io/rust/rustc/2024/03/15/rustc-what-takes-so-long.html
- https://ucarion.com/llvm-rust-toy-compiler
- https://www.cs.cornell.edu/courses/cs6120/2020fa/self-guided/
- https://wolchok.org/posts/how-to-read-arm64-assembly-language/
- https://mcyoung.xyz/2023/08/01/llvm-ir/
