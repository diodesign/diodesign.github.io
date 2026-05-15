---
title: "Lions' Commentary on Diosix: Chapter 3"
date: "2026-05-11"
byline: "By Chris Williams"
summary: "The Map of the World: Device Tree Handling"
---

Diosix doesn't guess what hardware it's running on; it reads the Device Tree Blob (DTB). This chapter explores how Diosix parses the host's hardware map and generates a custom map for its guests.

### 1. Pre-parsing the Blob
**Function:** `DeviceTreeBlob.init`
**Location:** `hypervisor/core/dt.zig`

When the boot CPU starts `bootCpuInit`, it first wraps the raw DTB pointer in a `DeviceTreeBlob` structure.

```zig
const pre_parse_dtb = try dt.DeviceTreeBlob.init(cpu_allocator, dtb);
```

The `init` function performs sanity checks: it verifies the "magic number" (`0xd00dfeed`) and ensures the version is supported. It then takes a **complete heap copy** of the blob. This is important because the original blob might be in memory that we eventually want to give to a guest.

### 2. Building the Structured Tree
**Function:** `DeviceTreeBlob.parse`
**Location:** `hypervisor/core/dt.zig`

The raw DTB is a flat, byte-oriented format. Diosix converts this into a `DeviceTree` object—a sorted, queryable list of nodes and properties.

The parser walks the "structure block," tracking its current position in the tree hierarchy using a stack of path components. When it sees an `FdtProp` token, it reads the property name from the "strings block" and the value from the current offset.

```zig
try dt.editProperty(full_path, prop_name, value);
```

By the end of `parse()`, we have a structured representation of every CPU, memory region, and peripheral on the host.

### 3. Tailoring for the Guest
Diosix doesn't just pass the host's DTB to the guest. It **clones and modifies** it. This is a crucial step for virtualization.

**Location:** `hypervisor/core/main.zig`

In `bootCpuInit`, the hypervisor performs several "surgeries" on the tree:
1. **Memory:** It finds the `/memory` node and updates its `reg` property to reflect the 512MB of RAM assigned to the Root VM, starting at its guest-physical base (`0x80000000`).
2. **Boot Arguments:** It injects `console=hvc0 earlycon=sbi` into the `/chosen` node. This tells the guest Linux kernel to use the SBI console instead of trying to talk to hardware UARTs directly.
3. **CPU Count:** It counts the physical CPUs and ensures the guest knows how many virtual CPUs it has.

### 4. Re-serializing: `toBlob`
**Function:** `DeviceTree.toBlob`
**Location:** `hypervisor/core/dt.zig`

Once the modifications are done, Diosix uses `toBlob()` to convert the structured tree back into the flat DTB format. This new blob is then copied into the guest's RAM at a high address (usually 1MB from the end of its RAM reservation).

The serialized blob is what the guest's bootloader or kernel will eventually parse to understand its virtual environment.
