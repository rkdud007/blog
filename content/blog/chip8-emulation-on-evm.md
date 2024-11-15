+++
title = "CHIP-8 emulation on EVM"
date = "2024-11-15T21:59:43+09:00"
tags = ["computer science", "emulator"]
+++

## CHIP-8

[CHIP-8](https://en.wikipedia.org/wiki/CHIP-8) is an interpreted programming language, initially used on the 8-bit microcomputers made in the mid-1970s. Since it was first developed in the mid-1970s, CHIP-8 emulation has been made for many devices and with many different languages. What it means is that we could also fully run this CHIP-8 program on a comparatively considered poor computation/resource environment than modern computers... like blockchain.

## Solchip8

So I decided to build *the first 100% on-chain CHIP-8 emulator smart contract where you can run CHIP-8 games on the EVM*, named [solchip8](https://github.com/rkdud007/solchip8). The general idea of emulation is referenced from this [guide](https://aquova.net/chip8/chip8.pdf).

- Full CHIP-8 opcode implemented in contract; full clock cycle working with example CHIP-8 games
- Run Rust script to play CHIP-8 game with SDL2 frontend

You can check out the [code](https://github.com/rkdud007/solchip8) and also [demo](https://www.youtube.com/watch?v=e5J1xQcg4wU).

I'll list a few tricks specifically that I had to adjust for EVM (Ethereum Virtual Machine).

### EVM

Some important information that I found unique in the EVM environment:

- Reading from and writing to storage is expensive. In EVM, compared to any other OPCODE, the ones that interact with storage are pretty expensive, e.g., [SLOAD](https://www.evm.codes/?fork=cancun#54), [SSTORE](https://www.evm.codes/?fork=cancun#55).
- Every value is initialized as 0 in EVM, not uninitialized (except for the dynamic types).
- Basic memory unit for EVM is bytes32, so even when you are using `uint8` or `boolean`, it stores bits for `uint8` amount but then goes to the next unit of memory, and the current unit is already initialized as 0; technically, all values are `bytes32`.

Basically, we needed to store more compressed data as bit manipulation is relatively cheaper than loading/storing many values to storage. Even if there is a delegatable preprocessing step or value parsing step on the off-chain side, it will get much more optimized.

### Display representation

Our emulator has a pixel display that has a width of 64 pixels and a height of 32 pixels, totaling 2048 pixels. Each pixel is either black (0) or white (1). To optimize storage, each pixel is represented as a bit. Using EVM's base unit of `bytes32`, we compress the display into a `uint256[8]` array:

```
|-----8 bits (1 byte) * 32 = bytes32-----|
00000000 00000000 ..... 00000000 00000000 -|
00000000 00000000 ..... 00000000 00000000  |
...                                        8 rows
00000000 00000000 ..... 00000000 00000000  |
00000000 00000000 ..... 00000000 00000000 -|
```

So in Solidity storage, the screen is represented like this:

```solidity
/// @notice Display as a bitfield (8 rows of 256 bits each).
uint256[8] screen;
```

In Rust you can parse it following the bit representation like above:

```rust
// Contract call
let builder = emu.getDisplay();
let screen_buf: [U256;8] = builder.call().await.unwrap()._0;

// Now set draw color to white, iterate through each point and see if it should be drawn
canvas.set_draw_color(Color::RGB(255, 255, 255));
for (i, pixel) in screen_buf.iter().enumerate() {
    let pixel_bytes: [u8; 32] = pixel.to_be_bytes();
    for (j, pixel_byte) in pixel_bytes.into_iter().enumerate() {
        let pixel_bits = pixel_byte.view_bits::<Msb0>();
        for (k, pixel_bit) in pixel_bits.into_iter().enumerate() {
            if *pixel_bit {
                let pixel_index = k + (j * 8) + (i * 256);
                // Convert our 1D array's pixel_index into a 2D (x,y) position
                let x = (pixel_index % SCREEN_WIDTH) as u32;
                let y = (pixel_index / SCREEN_WIDTH) as u32;

                // Draw a rectangle at (x,y), scaled up by our SCALE value
                let rect = Rect::new((x * SCALE) as i32, (y * SCALE) as i32, SCALE, SCALE);
                canvas.fill_rect(rect).unwrap();
            }
        }
    }
}
```

### Keyboard representation

For similar motivation as above, as we support 16 keys, with indices ranging from `0x0` to `0xF`, and each key state is either pressed (1) or not pressed (0), we just represent it as a `uint16` bitfield instead of using `bool[16]`.

**Keyboard Layout:**

```
Keyboard                    CHIP-8
+---+---+---+---+           +---+---+---+---+
| 1 | 2 | 3 | 4 |           | 1 | 2 | 3 | C |
+---+---+---+---+           +---+---+---+---+
| Q | W | E | R |           | 4 | 5 | 6 | D |
+---+---+---+---+    =>     +---+---+---+---+
| A | S | D | F |           | 7 | 8 | 9 | E |
+---+---+---+---+           +---+---+---+---+
| Z | X | C | V |           | A | 0 | B | F |
+---+---+---+---+           +---+---+---+---+
```

For example, pressing the `Q` key results in `00010000 00000000` as it is the binary representation of the `uint16` keys field.

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

In Rust script, you can parse the keyboard state by checking the bit value:

```rust
let keys = chip8.getKeys().call().await.unwrap();
println!("keys: {:?}", keys._0);

// Check if key is not pressed. If not, send transaction.
if keys._0 & (1 << k) == 0 {
    let tx = builder.send().await.unwrap();
    println!("⭐️ key {:?} down tx: {:?}", key, tx);
}
```

### Infrastructure

As this CHIP-8 emulator is a smart contract, it has to send a `tick()` transaction to run one clock cycle but then has to wait to actually change the state before calling the transaction `getDisplay()`. This means the clock cycle, frame of the emulator cannot be faster than the block time. To make it playable, feel like around at least 0.2s block time, single-slot finality is needed (demo video was 0.02s block time), which at the moment I'm not aware of any of the EVM chain is working on like this—so decided to test locally with Anvil.

```
anvil -b 0.02 --no-request-size-limit --disable-block-gas-limit --disable-code-size-limit --disable-min-priority-fee --slots-in-an-epoch 1 --order fifo
```

As you can see, I added a few flags to help make the EVM infrastructure as much as it could be just like I run CHIP-8 emulator written in Rust on my machine.

Briefly go through the script:

First, deploy the contract, which `Solchip8` is defined in `sol!` macro.

```rust
let chip8 = Solchip8::deploy(&provider).await.unwrap();
```

Then I load the CHIP-8 instruction to the emulator contract; in this case, as the load step is necessary for further logic, we wait until we get the transaction receipt, which takes around 250ms.

```rust
let mut rom = File::open(&args[1]).expect("Unable to open file");
let mut buffer = Vec::new();
rom.read_to_end(&mut buffer).unwrap();
println!("Loaded ROM with {:?} bytes", buffer);
let builder = chip8.load(buffer.to_vec());
builder.call().await.unwrap();
// 250ms
let tx = builder.send().await.unwrap().get_receipt().await.unwrap();
println!("load tx: {:?}", tx);
```

From now on, we just do an infinite loop and the main logic is executing `tick()` and `drawScreen()` steps:

```rust
// Tick implies fetch, execute.
let builder = chip8.tick();
builder.call().await.unwrap();
let tx = builder.send().await.unwrap();
println!("tx for tick:{:?}", tx);
draw_screen(&chip8, &mut canvas).await;
```

## Thoughts

I'd been interested in recent discussions around scaling blockchain infrastructures. Naturally questioning—"how fast is what we want to reach"—and by making a contract (program) that is expected to compute the same job as the original machine actually helped give a clearer intuition about computational throughput on blockchain as comparision. I'm a bit curious on how future scaling numbers will turn out and whether this emulator could be able to reach the same computational performance as the original machine on top of decentralization or verifiability.

In general, I was happy to implement the full features of CHIP-8 that provide quite rich example programs like PONG, BRIX running fully onchain :)
