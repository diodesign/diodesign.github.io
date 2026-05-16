---
title: "Part 2: Laying the groundwork"
date: "2026-05-16"
byline: "Chris Williams"
summary: "Taking control: Allocators, interrupts, and physical cores"
---

Once we land in Zig's `main`, the hypervisor needs to build its own internal world. This chapter covers how a raw physical core becomes a managed resource.

### Function: `main`
**Location:** `hypervisor/core/main.zig`

The Zig entry point is `export fn main(cpu_core_id: usize, dtb: [*]u8)`. Note that while assembly passed the DTB size in `a2`, Zig's signature here ignores it—it will later re-read the size from the header.

#### 1. The PMP Barrier
The first order of business is `hw_pmp_init()`. RISC-V's Physical Memory Protection (PMP) acts as the ultimate hardware firewall.

**Function:** `hw_pmp_init`
**Location:** `hypervisor/hw/qemu/util.s`

```asm
hw_pmp_init:
  li t0, -1
  csrw pmpaddr0, t0
  li t0, 0x1f
  csrw pmpcfg0, t0
```

Diosix sets a single, all-encompassing PMP entry that allows Read, Write, and Execute (0x1F) for the entire 64-bit address space. This might seem "insecure," but it's intentional: Diosix relies on the **H-extension's G-stage paging** to isolate guests. The PMP here just ensures the hypervisor can actually see the RAM it needs to manage.

#### 2. Local Heap Initialization
Every core gets its own heap. This is a critical design choice: it allows cores to allocate memory for things like page tables or guest metadata without fighting over a global lock.

```zig
cpu_ctx.allocator.init(riscv.getCPUHeapBase(), riscv.getCPUHeapSize())
```

The heap is carved out of the 1MB "slab" assigned in Chapter 1. The allocator itself (`alloc.zig`) is a linked-list based best-fit allocator. It's simple but effective for the hypervisor's relatively static allocation patterns.

#### 3. Interrupt Delegation
Next, `xint.init()` is called, which triggers `hw_xint_init` in assembly.

**Function:** `hw_xint_init`
**Location:** `hypervisor/hw/qemu/xint.s`

This is where Diosix decides what it wants to handle and what it wants the guest to handle. It sets up:
- `mtvec`: Points all machine-mode traps to `xint_machine_entry_handler`.
- `medeleg`: Delegates most exceptions (like page faults) to the guest supervisor. It specifically **retains** `ecall` (9 and 11) and `illegal instruction` (2) for the hypervisor to handle.
- `mideleg`: Delegates timer and software interrupts.

#### 4. The Boot CPU vs. The Workers
In Diosix, CPU 0 is the "Boot CPU." It performs the heavyweight global initialization while other cores wait.

```zig
switch (cpu_core_id) {
    BootCpuID => {
        bootCpuInit(allocator, dtb) catch ...;
        boot_complete_flag.store(true, .release);
    },
    else => {
        while (!boot_complete_flag.load(.acquire)) { riscv.pause(); }
    },
}
```

This synchronization ensures that by the time a worker core enters the scheduler, the root VM and global data structures are ready.

### The Machine Trap Handler
**Function:** `xint_machine_entry_handler`
**Location:** `hypervisor/hw/qemu/xint.s`

When a trap occurs, this assembly shim:
1. Swaps the stack pointer with `mscratch` (finding the IRQ stack).
2. Saves all 32 registers into a `ThreadContext` frame on the stack.
3. Calls the high-level `xint_handler` in Zig.
4. On return, restores the registers and executes `mret`.

This is the heartbeat of the hypervisor—every guest exit passes through this code.
