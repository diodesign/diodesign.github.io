---
title: "Chapter 1: "
date: "2026-05-14"
byline: "Chris Williams"
summary: "Pre-Zig Assembly Initialization"
---

When the RISC-V hardware fires up or when a bootloader like QEMU's internal ROM hands off control, we find ourselves at `_start`. At this stage, the environment is as "bare metal" as it gets. Each CPU core (or "hart" in RISC-V parlance) enters the same entry point simultaneously.

The primary task of this chapter is to turn this chaotic multi-core stampede into a structured environment where Zig code can safely execute.

### Function: `_start`
**Location:** `hypervisor/hw/qemu/entry.s`

The bootloader provides us with two crucial values:

- `a0`: The per-system unique hardware hart ID.
- `a1`: A pointer to the Device Tree Blob (DTB) describing the hardware.

#### 1. Linearizing the CPU IDs
Hardware hart IDs aren't always contiguous (e.g., you might have harts 0, 1, 4, 5). To make indexing easier for the hypervisor, the first thing we do is assign each core a linear, runtime ID starting from 0.

```asm
    la        t1, cpu_core_id_counter
    li        t2, 1
    amoadd.w  t3, t2, (t1)
    mv        a0, t3
```

We use an atomic fetch-and-add (`amoadd.w`) on a global counter. This ensures that no matter how many cores are racing, each gets a unique, sequential index. This runtime ID is moved into `a0`, which will eventually be passed to Zig's `main`.

#### 2. Claiming a Memory Slab
Each core needs its own private workspace for its stack and private variables. Rather than hardcoding addresses, each core claims a 1MB "slab" of memory starting from the end of the hypervisor binary.

```asm
    la        t1, __hypervisor_end
    slli      t3, t3, CPU_SLAB_SHIFT
    add       t3, t3, t1
```

The runtime CPU ID (now in `t3`) is shifted left by `CPU_SLAB_SHIFT` (20 bits, or 1MB) and added to `__hypervisor_end`. This gives each core a distinct region of RAM.

#### 3. Setting up the Exception Stack
RISC-V's `mscratch` register is used here to hold a pointer to the *top* of the core's exception stack.

```asm
    li        t1, CPU_STACK_BASE
    li        t2, CPU_STACK_SIZE
    add       t4, t2, t1
    add       t4, t4, t3
    csrrw     x0, mscratch, t4
```

This is vital: when an interrupt or exception occurs, the hardware doesn't automatically switch stacks. The assembly handler will later use `mscratch` to find where to save registers without clobbering the interrupted code's stack.

#### 4. The Boot Stack
We use the lower half of the exception stack as a temporary boot stack to get us into Zig.

```asm
    srli      t1, t2, 1
    sub       sp, t4, t1
```

#### 5. Clearing the BSS
The BSS section (uninitialized global variables) must be zeroed before Zig starts. Only the first core to arrive (ID 0) performs this task to avoid redundant work and race conditions.

```asm
clear_bss:
    la        t1, __bss_start
    la        t2, __bss_end
    # ... loop to zero memory ...
```

Other cores wait for the `bss_cleared` flag to be set before proceeding. This is our first "synchronization point."

#### 6. Transition to Zig
Finally, we prepare the arguments for the Zig `main` function:
- `a0`: Linear CPU ID.
- `a1`: Pointer to the host DTB.
- `a2`: The 32-bit size of the DTB (read from the DTB header itself).

```asm
    lw        a2, 4(a1)       # 32-bit size of tree
    la        t0, main
    jalr      ra, t0, 0
```

With that, execution jumps into the compiled Zig code. If `main` ever returns, the core falls into an infinite `wfi` (wait for interrupt) loop.
