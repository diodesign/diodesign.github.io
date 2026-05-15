---
title: "Lions' Commentary on Diosix: Chapter 7"
date: "2026-05-15"
byline: "By Chris Williams"
summary: "The Dialogue: Environment Calls and SBI"
---

When the guest Linux kernel wants to talk to the "hardware" (e.g., to write to the console or set a timer), it executes an `ecall`. Because we previously delegated most exceptions but **not** `ecall`, the CPU traps into the hypervisor's `xint_machine_entry_handler`.

This chapter covers how Diosix implements the **Supervisor Binary Interface (SBI)**.

### 1. Central Dispatch
**Function:** `xint_handler`
**Location:** `hypervisor/core/xint.zig`

The handler identifies the trap as an `ecall` and calls `handle_exception`.

```zig
case .supervisor_environment_call, .virtual_supervisor_environment_call => {
    sbi.handle(vc, context);
}
```

### 2. SBI Extension and Function
**Function:** `handle`
**Location:** `hypervisor/core/sbi.zig`

SBI calls are multiplexed using two registers:
- `a7`: The SBI Extension ID (EID).
- `a6`: The SBI Function ID (FID).

Diosix switches on the EID to find the right sub-handler.

#### Example: Debug Console (DBCN)
When Linux wants to write a string, it uses the `DBCN` extension (EID `0x4442434E`).

```zig
case interface.EXT.DBCN => handleDebugConsole(vc, context, function, a0, a1),
```

The hypervisor must:
1. Read the string length from `a0` and the Guest Physical Address (GPA) from `a1`.
2. **Translate** each GPA to a Host Physical Address (HPA) using the guest's page tables.
3. Read the byte from host memory and send it to the physical UART using `debug.putcharFromGuest`.

#### Example: Timer (TIME)
When Linux wants to schedule a timer interrupt, it uses the `TIME` extension.

```zig
case interface.EXT.TIME => handleTimer(vc, context, function, a0),
```

Diosix sets the physical hardware timer to the requested value. When that timer eventually fires, it will trigger a `machine_timer` interrupt, which the hypervisor will then "inject" back into the guest as a virtual timer interrupt (`VSTIP`).

### 3. Returning to the Guest
Before returning, the SBI handler must perform one critical task:

```zig
vc.machine.mepc += 4;
```

It must increment the guest's saved `mepc` so that when `mret` is executed, the guest resumes at the instruction **after** the `ecall`. If we forgot this, the guest would be stuck in an infinite loop of executing the same `ecall` over and over.

The result of the call (success or error) is placed in `a0` and `a1` using `setResult`, following the SBI specification.

### 4. Special Case: The Diosix Extension
Diosix provides its own non-standard SBI extension (EID `0x0A000000`) for "hypercall" like functionality, such as `YIELD` (to give up CPU time) or `FORK` (to create a new child VM). This is how the system scales from a single root VM to a tree of isolated guests.
