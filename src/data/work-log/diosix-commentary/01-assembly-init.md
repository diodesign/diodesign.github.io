---
title: "Part 1: From bootloader to Zig"
date: "2026-05-15"
byline: "Chris Williams"
summary: "Pre-Zig assembly-level initialization of Diosix, straight from the bootloader."
---

Welcome to this commentary series on [Diosix](https://diosix.org), which is an open-source bare-metal hypervisor written in [Zig](https://ziglang.org/) for 64-bit [RISC-V](https://docs.riscv.org/reference/home/index.html) systems. This guide is for systems developers curious about how this low-level software works. To learn about the motivation behind the commentary, see [this introduction](/work-log/diosix-commentary-introduction.html).

Let's dive in, starting with a high-level overview, followed by the assembly code that initializes the hypervisor.

### Diosix architectural overview

A hypervisor, or virtual machine monitor (VMM), is a privileged software layer that abstracts physical hardware into isolated execution environments called virtual machines (VMs).

As a type-1 hypervisor, Diosix executes closest to the silicon, typically in RISC-V's Machine (M) or Hypervisor-Extended Supervisor (HS) modes. While it performs standard VMM duties like resource multiplexing and hardware-enforced isolation of VMs, its design is more akin to a recursive microkernel than a traditional monolithic VMM. It implements a hierarchical governance model that delegates guest orchestration away from the hypervisor core.

The key architectural pillars of Diosix include:

Recursive management model
: Rather than a flat list of guests managed by the VMM, Diosix organizes VMs into a tree-like lineage. The **root VM**, created at boot, acts as the progenitor. Any VM can fork children and manage their entire lifecycle, effectively acting as a management domain for its own subtree.

Subtree resource quotas
: Resources are partitioned through recursive quotas. A parent VM allocates a slice of its own harts (RISC-V CPU cores), RAM, and scheduling priority to its descendants. This ensures that no branch of the hierarchy can consume more than its allocated share of the physical system.

Lineage-based isolation
: Isolation is enforced through restricted communication paths. VMs are strictly limited to interacting with their immediate parent and children. Sibling VMs and distant branches are entirely invisible to one another, minimizing the system's attack surface.

Hardware trust delegation
: Diosix separates guest management from hardware control. Only VMs with a **hardware trust** flag can map physical memory-mapped I/O (MMIO) or route hardware interrupts. The **root VM** is initialized with this trust, enabling it to provide drivers, file systems, and other system services to the rest of the hierarchy. This model keeps complex driver logic out of the hypervisor and allows Diosix to leverage the mature hardware support of kernels like Linux. Typically, a child VM will use its inherited trust to load a guest image from storage before dropping its trusted status to run as a standard, isolated guest.

By acting as a secure, minimal orchestrator, Diosix provides the plumbing necessary to host multiple, heterogeneous operating systems while keeping the hypervisor core focused on the fundamental task of hardware arbitration.

### After power-on or reset

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
