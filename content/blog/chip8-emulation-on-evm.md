+++
title = "CHIP-8 Emulation on EVM"
date = "2024-11-15T21:59:43+09:00"
tags = ["computer science", "emulator"]
+++

This post explains a project emulates CHIP-8 program on EVM. You can check out the [full code](https://github.com/rkdud007/solchip8) and also the [demo post](https://x.com/piapark_eth/status/1857484716665983303).

<blockquote class="twitter-tweet" data-media-max-width="560"><p lang="en" dir="ltr">The first 100% on-chain CHIP-8 emulator, where you can load and play any CHIP-8 program <a href="https://t.co/8BeMFzCOa4">pic.twitter.com/8BeMFzCOa4</a></p>&mdash; pia (@piapark_eth) <a href="https://twitter.com/piapark_eth/status/1857484716665983303?ref_src=twsrc%5Etfw">November 15, 2024</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

## CHIP-8

[CHIP-8](https://en.wikipedia.org/wiki/CHIP-8) is an interpreted programming language, initially used on the 8-bit microcomputers made in the mid-1970s.

![1](/images/chip8/Telmac1800.jpg)
> *Figure 1: The [Telmac 1800](https://en.wikipedia.org/wiki/Telmac_1800) microcomputer used run CHIP-8 first.*

To fully run a CHIP-8 program, the main resources needed are 4,096 (0x1000) bytes of memory, 16 8-bit registers, and a stack, which is achievable even on relatively limited computational resources compared to modern computers.

Okay, so why not run a CHIP-8 program fully on-chain?

## Solchip8

The idea is to build *the first 100% on-chain CHIP-8 emulator smart contract, where you can run CHIP-8 games on the EVM (Ethereum Virtual Machine).*

Mainly, two components are needed:
- **Emulator Contract**: Full implementation of CHIP-8's 35 opcodes; full clock cycle working with example CHIP-8 games like BRIX and PONG.
- **Script, SDL2 frontend**: Run a Rust script to play CHIP-8 games by sending transactions to the core contract and using an SDL2 frontend.

## Implementation - Emulator Contract

Implementing these two components is pretty straightforward. Mainly, we have an Emulator struct that defines the full spec of the CHIP-8 virtual machine.

```solidity
struct Emulator {
    /// @notice 16-bit program counter.
    uint16 pc;
    /// @notice 4KB of RAM.
    uint8[RAM_SIZE] ram;
    /// @notice Display 64 x 32 pixels as a bitfield (8 rows of 256 bits each).
    uint256[8] screen;
    /// @notice Sixteen 8-bit general-purpose registers (V0 to VF).
    uint8[NUM_REGS] v_reg;
    /// @notice A 16-bit register for memory access (I register).
    uint16 i_reg;
    /// @notice Stack pointer.
    uint16 sp;
    /// @notice Stack for subroutine calls.
    uint16[STACK_SIZE] stack;
    /// @notice Keyboard state as a 16-bit bitfield.
    uint16 keys;
    /// @notice Delay timer.
    uint8 dt;
    /// @notice Sound timer.
    uint8 st;
    /// @notice Size of the loaded program.
    uint256 program_size;
}
```

By default, the first 512 (0x200) bytes are initialized with [FONTSET](https://github.com/rkdud007/solchip8/blob/3382502e44f840b2d974570b93913e18f761cc0e/src/Solchip8.sol#L71-L154) since we need to look up the shapes of characters 0 to F when needed.

Then, call the `load()` function to load CHIP-8 program bytes into storage (RAM).

```solidity
/// @notice Load program into memory
function load(uint8[] memory data) public {
    uint256 start = START_ADDR;
    uint256 end = START_ADDR + data.length;
    require(end <= RAM_SIZE, "Data too large to fit in RAM");
    for (uint256 i = start; i < end; i++) {
        emu.ram[i] = data[i - start];
    }
    emu.program_size = data.length;
}
```

Now the Emulator is all set! We have a public `tick()` function to run clock cycles one by one. This means we just execute each instruction by calling a transaction.

The CPU processing step involves fetching the target opcode, decoding, and executing it by changing the emulator's state. We also tick the timer, which handles time-related states in CHIP-8.

```solidity
/// @notice CPU processing loop
/// @dev This function is called once per tick of the CPU.
/// Fetch the next instruction, decode and execute it.
function tick() public {
    // Fetch
    uint16 op = fetch();
    // Decode & execute
    execute(op);

    _tickTimers();
}
```

You can check the full execution test of all 35 possible opcodes in CHIP-8 in [this test file](https://github.com/rkdud007/solchip8/blob/3382502e44f840b2d974570b93913e18f761cc0e/test/Solchip8.t.sol#L24).

## Implementation - Script, SDL2 frontend

As this CHIP-8 emulator is a smart contract, it has to send a `tick()` transaction to run one clock cycle but then has to wait for the state to change before calling the `getDisplay()` transaction. This means the clock cycle (frame) of the emulator cannot be faster than the block time. To make it playable, with a feel of at least around 0.2s block time, single-slot finality is needed (the demo video was 0.02s block time). As I'm not aware of any EVM chains working like this at the moment, I decided to test locally with Anvil.

```
anvil -b 0.02 --no-request-size-limit --disable-block-gas-limit --disable-code-size-limit --disable-min-priority-fee --slots-in-an-epoch 1 --order fifo
```

As you can see, I added a few flags to make the EVM infrastructure as similar as possible to running the CHIP-8 emulator written in Rust on my machine.

Briefly going through the script:

First, deploy the contract, where `Solchip8` is defined in the `sol!` macro.

```rust
let chip8 = Solchip8::deploy(&provider).await?;
```

Then I load the CHIP-8 instructions into the emulator contract; in this case, since the load step is necessary for further logic, we wait until we get the transaction receipt, which takes around 250ms.

```rust
let mut rom = File::open(&args[1]).expect("Unable to open file");
let mut buffer = Vec::new();
rom.read_to_end(&mut buffer)?;
println!("Loaded ROM with {:?} bytes", buffer);
let builder = chip8.load(buffer.to_vec());
builder.call().await?;
// 250ms
let tx = builder.send().await?.get_receipt().await?;
println!("load tx: {:?}", tx);
```

From now on, we just do an infinite loop where the main logic is executing the `tick()` and `drawScreen()` steps:

```rust
// Tick implies fetch, execute.
let builder = chip8.tick();
builder.call().await?;
let tx = builder.send().await?;
println!("tx for tick:{:?}", tx);
draw_screen(&chip8, &mut canvas).await;
```

## What I've Learned

Furthermore, I wanted to add some gas optimization specific to the EVM.

As I'm pretty new to EVM specifications and development, it was pretty fun to learn how memory is structured, gas usage per opcode, and to look up hyper-optimized contracts from other EVM wizards.

So I tried to focus on storage-heavy data representation. The display and keyboard are the ones where I found room for compression by using bit representation.

### EVM

Some things I learned that are unique in the EVM environment:

- Reading from and writing to storage is *pretty* expensive. In EVM, compared to any other opcode, the ones that interact with storage are pretty expensive, e.g., [SLOAD](https://www.evm.codes/?fork=cancun#54), [SSTORE](https://www.evm.codes/?fork=cancun#55).
- Every value is initialized as 0 in EVM, not uninitialized (except for the dynamic types).
- The basic memory unit for EVM is `bytes32`, so even when you are using `uint8` or `boolean`, it stores the bits for the `uint8` amount but occupies a full `bytes32` unit; the current unit is already initialized as 0. Technically, all values are `bytes32`.

So from the given information, we needed to store data as compressed as possible, because bit manipulation is relatively cheaper than loading/storing many values to storage. Even if there is a delegatable preprocessing step or value parsing step on the off-chain side, it will be much more optimized.

### Display Representation

Our emulator has a pixel display that has a width of 64 pixels and a height of 32 pixels, totaling 2,048 pixels. Each pixel is either black (0) or white (1). To optimize storage, each pixel is represented as a bit. Using EVM's base unit of `bytes32`, we compress the display into a `uint256[8]` array:

<img src="/images/chip8/display.png" alt="CHIP-8 Display" width="320">

So in Solidity storage, the screen is represented like this:

```solidity
/// @notice Display as a bitfield (8 rows of 256 bits each).
uint256[8] screen;
```

In Rust, you can parse it following the bit representation like above:

```rust
// Contract call
let builder = emu.getDisplay();
let screen_buf: [U256; 8] = builder.call().await?._0;

// Now set draw color to white, iterate through each point and see if it should be drawn
canvas.set_draw_color(Color::RGB(255, 255, 255));
for (i, pixel) in screen_buf.iter().enumerate() {
    let pixel_bytes: [u8; 32] = pixel.to_be_bytes();
    for (j, pixel_byte) in pixel_bytes.into_iter().enumerate() {
        let pixel_bits = pixel_byte.view_bits::<Msb0>();
        for (k, pixel_bit) in pixel_bits.into_iter().enumerate() {
            if *pixel_bit {
                let pixel_index = k + (j * 8) + (i * 256);
                // Convert our 1D array's pixel_index into a 2D (x, y) position
                let x = (pixel_index % SCREEN_WIDTH) as u32;
                let y = (pixel_index / SCREEN_WIDTH) as u32;

                // Draw a rectangle at (x, y), scaled up by our SCALE value
                let rect = Rect::new((x * SCALE) as i32, (y * SCALE) as i32, SCALE, SCALE);
                canvas.fill_rect(rect)?;
            }
        }
    }
}
```

### Keyboard Representation

For similar motivation as above, since we support 16 keys with indices ranging from `0x0` to `0xF`, and each key state is either pressed (1) or not pressed (0), we represent it as a `uint16` bitfield instead of using `bool[16]`.

**Keyboard Layout:**

First, we map the physical keyboard to the CHIP-8 key indices as shown below.

<img src="/images/chip8/key.png" alt="CHIP-8 key" width="320">

For example, pressing the `Q` key results in `00010000 00000000`, which is the binary representation of the `uint16` keys field.

So in Solidity, you can update the key state by bit manipulation of a single value:

```solidity
function keypress(uint256 idx, bool pressed) public {
    require(idx < 16, "Invalid key index");
    if (pressed) {
        // Set the bit at position `idx` to 1
        emu.keys |= uint16(1 << idx);
    } else {
        // Clear the bit at position `idx` to 0
        emu.keys &= ~uint16(1 << idx);
    }
}
```

In the Rust script, you can parse the keyboard state by checking the bit value:

```rust
let keys = chip8.getKeys().call().await?;
println!("keys: {:?}", keys._0);

// Check if key is not pressed. If not, send transaction.
if keys._0 & (1 << k) == 0 {
    let tx = builder.send().await?;
    println!("⭐️ key {:?} down tx: {:?}", key, tx);
}
```

## Final Thoughts

Overall, I am happy that some basic games like BRIX and PONG are working at a playable level. I learned quite a bit of EVM knowledge, though I haven't reached the level of insane assembly optimization (I'm curious). Always a pleasure to work in Rust; love all the dev tooling Ethereum has in Rust.

I'm hoping and curious about whether blockchain infrastructure will reach the level needed for a solid playtest of a CHIP-8 game, which ideally requires less than 0.1s of block time, cheap gas fees for storage interaction (I cannot even play on mainnet cus it's TOO expensive), and fast finality—or is that not what blockchain should aim for? Whatever, it's just so cool to run a CHIP-8 program fully on-chain :D

### Reference

Special thanks to the guide [An Introduction to Chip-8 Emulation using the Rust Programming Language](https://aquova.net/chip8/chip8.pdf), personally the best reference to follow CHIP-8 emulation development.
