---
title: "Lions' Commentary on Diosix: Chapter 5"
date: "2026-05-13"
byline: "By Chris Williams"
summary: "The Pulse: Timer, Scheduler, and Context Switching"
---

A hypervisor is only as good as its ability to juggle multiple threads of execution. Diosix uses a Weighted Fair Queuing (WFQ) scheduler to manage virtual cores (vcores).

### 1. The Global and Local Queues
**Location:** `hypervisor/core/scheduler.zig`

Diosix employs a hybrid scheduling model to minimize lock contention:
- **Local Queues:** Each physical core has a small local run queue (up to 8 vcores).
- **Global Queue:** Overflow work and new vcores are placed in a global queue protected by a spinlock.

Both queues are implemented as **Red-Black Trees** (`dsa.RedBlackTree`), where the key is the `vruntime` (virtual runtime). This ensures that the vcore with the smallest `vruntime`—the one that has had the least amount of CPU time—is always at the "minimum" position and picked next.

### 2. Picking the Next Task
**Function:** `pickNext`
**Location:** `hypervisor/core/scheduler.zig`

The scheduler first checks the local queue. If it's empty, it attempts a "Greedy Pull" from the global queue, grabbing a batch of vcores to fill its local workspace.

A key check here is hardware compatibility:
```zig
if ((vc.required_extensions & misa) == vc.required_extensions)
```
If a vcore requires extensions (like Vector or Float) that the current physical core doesn't support, the scheduler skips it.

### 3. Context Switching
**Function:** `contextSwitch`
**Location:** `hypervisor/core/pcore.zig`

Once a vcore is selected, the physical core must "become" that vcore.
1. It updates `pc.active_vcore` to point to the new vcore.
2. It calls `to_vcore.guest.space.apply()`, which writes the `hgatp` CSR to activate the guest's second-stage page tables.

### 4. The Timer and "Vruntime"
**Function:** `schedule`
**Location:** `hypervisor/core/scheduler.zig`

When a vcore is descheduled, the hypervisor calculates how much time actually passed using the RISC-V `time` CSR.

```zig
const actual_time = if (now > vc.last_queued_time) now - vc.last_queued_time else 1;
const delta: u64 = actual_time * 1024 / vc.weight;
vc.vruntime += delta;
```

The `actual_time` is weighted. A "heavier" vcore (higher priority) will accumulate `vruntime` more slowly, causing it to stay at the "minimum" position in the Red-Black tree for longer and thus receive more CPU time.

### 5. Transition to Hardware
Finally, the hypervisor calls `pcore.hw_run_vcore()`, an assembly routine that loads the saved guest registers and executes `mret` to enter the guest. We'll look at the actual entry mechanics in the next chapter.
