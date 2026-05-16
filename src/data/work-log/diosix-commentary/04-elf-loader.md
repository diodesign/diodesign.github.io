---
title: "Part 4: Loading the first guest VM"
date: "2026-05-18"
byline: "Chris Williams"
summary: "Unpacking the root VM ELF from the hypervisor payload"
---

The "Root VM" is the first guest Diosix runs. It's usually a Linux kernel. In the current build, this ELF binary is actually embedded directly inside the hypervisor's own binary in a section called `.rootvm`.

This chapter examines how Diosix extracts this ELF and prepares it for execution in a virtualized address space.

### 1. Locating the Image
The hypervisor uses linker symbols to find the start and end of the embedded ELF image:

```zig
extern const __rootvm_start: u8;
extern const __rootvm_end: u8;
```

These symbols are defined in the linker script.

### 2. The Loading Strategy
**Function:** `Loader.load`
**Location:** `hypervisor/core/loader.zig`

Diosix's ELF loader is "two-pass." It doesn't assume the ELF is linked to the same physical address where it will be loaded.

#### Pass 1: Finding the Base
The loader first scans all `PT_LOAD` segments to find the **minimum virtual address** (`min_vaddr`). This is effectively the virtual base address of the entire binary.

```zig
if (p_type == elf_spec.PT_LOAD) {
    const p_vaddr = readU64(source, off + elf_spec.PHDR.VADDR);
    if (p_vaddr < min_vaddr) { min_vaddr = p_vaddr; }
}
```

#### Pass 2: Mapping and Copying
In the second pass, the loader calculates the target Guest Physical Address (GPA) for each segment relative to this base.

```zig
const offset = p_vaddr - min_vaddr;
const gpa = root_vm.space.base_gpa + @as(usize, @intCast(offset));
```

For each segment, the loader:
1. **Translates GPA to HPA:** It converts the guest physical address to a host physical address (where the hypervisor has reserved RAM).
2. **Copies Data:** It performs a `@memcpy` from the embedded ELF source to the destination RAM.
3. **Zeroes BSS:** If the segment's memory size is larger than its file size, it zeroes the remainder.
4. **Sets Permissions:** It maps the region in the guest's second-stage page tables (G-stage) as RWX.

### 3. Calculating the Entry Point
The entry point specified in the ELF header is also a virtual address. The loader translates it using the same `min_vaddr` offset to get the correct GPA for the guest's starting PC.

```zig
const entry_offset = entry_point - min_vaddr;
return root_vm.space.base_gpa + @as(usize, @intCast(entry_offset));
```

By the time `Loader.load` returns, the guest's RAM is populated, its page tables are set, and we know exactly where the virtual CPU should start executing. Interestingly, Diosix maps all segments as **RWX** by default for the root VM—a simplification that avoids complex permission management during early boot.
