---
title: "Part 6: Making the leap from hypervisor to supervisor"
date: "2026-05-20"
byline: "Chris Williams"
summary: "Entering the root VM and begin guest kernel execution"
---

All the preparation leads to this: the moment the hypervisor cedes the CPU to the guest. This isn't a simple jump instruction; it's a carefully orchestrated state transition.

### 1. The Main Loop
**Location:** `hypervisor/core/main.zig`

Once initialization is finished, every core enters an infinite loop:
```zig
while (true) {
    scheduler.schedule();
    if (pcore.this().active_vcore) |ptr| {
        // ... update hgatp ...
        pcore.hw_run_vcore(&vc.context, &vc.machine, &vc.guest_state);
    }
    riscv.pause(); // wfi
}
```

If the scheduler found work, `hw_run_vcore` is called. This function **does not return** in the traditional sense; instead, it transitions to guest mode. When the guest eventually traps back to the hypervisor, execution resumes in the trap handler, which then loops back around to the top of this `while` loop.

### 2. Restoring State
**Function:** `hw_run_vcore`
**Location:** `hypervisor/hw/qemu/util.s`

This assembly routine is the "inverse" of the trap handler. It takes three pointers:
- `a0`: The guest's 32 general-purpose registers.
- `a1`: The machine-level CSRs (`mepc`, `mstatus`, `hstatus`, etc.).
- `a2`: The VS-mode (Virtual Supervisor) CSRs.

#### Step A: CSR Setup
The hypervisor restores the guest's architectural state. Crucially, it sets `mstatus.MPV=1` (Machine Previous Virtualization) and `mstatus.MPP=1` (Machine Previous Privilege = Supervisor). This tells the hardware that when we execute `mret`, it should land in **Virtual Supervisor Mode**.

#### Step B: G-Stage TLB Flush
```asm
  hfence.gvma
```
We flush the guest-physical TLB to ensure that no stale translations from a previous guest (or a previous version of the current guest's page tables) remain.

#### Step C: GPR Restoration
Finally, it loads all 32 general-purpose registers from the `ThreadContext` frame.

```asm
  ld x1, 8(a0)
  # ... load x3 to x31 ...
  ld x10, 80(a0) # Restore a0 last
```

### 3. The Jump: `mret`
The last instruction is `mret`.
1. The hardware sets the PC to the value in `mepc` (the translated ELF entry point).
2. It sets the privilege mode to Supervisor and enables Virtualization.
3. The guest Linux kernel begins executing its first instruction at `0x80000000` (GPA).

The hypervisor is now "gone." It will only reappear when the guest does something it's not allowed to do, like execute an `ecall` or access unmapped memory.
