---
title: "A commentary on Diosix"
date: "2026-05-15"
byline: "Chris Williams"
permalink: "diosix-commentary-introduction.html"
summary: "Introducing a multi-part series that walks through the Diosix hypervisor function-by-function."
---

Inspired by [_A Commentary on the Sixth Edition UNIX Operating System_](https://warsus.github.io/lions-/) and Mark Moxon's [software archaeology](https://www.bbcelite.com/), which are both super interesting reads, I've started a multi-part commentary of the [Diosix](https://diosix.org/) hypervisor source code.

### What to expect

This read-along walks through the [open-source codebase](https://github.com/diodesign/diosix/) explaining design decisions and implementation details, in the order the code is used, from boot up to running and managing guest operating systems.

It's part explainer for those wanting to learn how it works and part code audit; documenting the system function-by-function should help me spot design issues and bugs not caught by tests. If I see something wrong while writing this guide, I can fix it as I go.

I'll publish the chapters one by one over the next week or so. The structure so far is:

| Part | Topic | Description |
|----- |------ |------------ |
| 1 | **Booting** | Bootstrapping from assembly all the way to a Zig main function. |
| 2 | **Initializing** | The initial setup of the bare-metal hypervisor, such as its memory allocator and management of interrupts and physical CPU cores. |
| 3 | **Hardware enumeration** | Parsing and generating device trees to discover and describe hardware environments dynamically. |
| 4 | **Loading the first guest** | Parsing and unpacking the ELF binary of the root VM, the first guest OS the hypervisor runs. The root VM is granted sufficient host access to provide drivers and other components for itself and guest VMs it spawns. This keeps the hypervisor thin and pushes a lot of hardware management up into supervisor space. |
| 5 | **Scheduling** | The virtual CPU scheduler and manager. |
| 6 | **Starting the first guest** | Moving execution from the machine-level hypervisor to the supervisor-level root VM. |
| 7 | **Managing guests** | How guest VMs, including the root VM, and the hypervisor interact, and the SBI interface. |

The [commentary series starts here](/work-log/diosix-commentary/). If you have any questions, or if anything seems unclear, please do [drop me a note](/contact/).

### A word on history

I've been developing Diosix off and on since about 2007, although I was thinking about the project back in the early 2000s when I was [studying electronics engineering](/life-log/path-to-big-tech.html) at university and realized I liked firmware, drivers, and kernel-level code more than fine-tuning analog circuits.

Diosix started as a hobby microkernel operating system for 32-bit and 64-bit x86 systems, and was then ported to 64-bit Arm. It was influenced by QNX's Neutrino; Minix; L4; Haiku's NewOS kernel; LK; and other microkernel designs.

Once I got as far as providing a multitasking, multiprocessor POSIX-compatible fully protected userspace for processes and threads, with trusted system services providing access to the console and other resources, I realized there was no way I was writing an entire OS by myself.

I developed Diosix to learn how operating system kernels and support services could and should work, and how to bring up x86 and Arm systems from the bootloader to usermode and support applications. What I hadn't explored yet was virtualization.

That led to Diosix pivoting from a C-based microkernel OS to a Rust-based bare-metal hypervisor for 64-bit RISC-V systems that was able to [load and execute](https://asciinema.org/a/395307) multiple Linux-based guests at once. I chose RISC-V because it was new, barely explored, and open, and x86 and Arm felt like a well-trodden path at that point. I moved to Rust because it had memory safety and felt like an intuitve progression from C, which is basically assembly with syntactic sugar.

Diosix is still targeting 64-bit RISC-V as that feels a natural fit for hypervisor-grade systems; if you'd like to maintain a 32-bit RISC-V port as a branch, [let's connect](/contact/).

The project now uses Zig rather than Rust. While Rust is a fine language and is being used in kernel-level code, Zig to me feels closer to a low-level systems language. It is a safer C and so far really intuitive to work with. Also, like RISC-V, it's new and off the beaten path, so I'm personally more inclined to check it out as I'm driven by curiosity more than anything.

Which leads back to this commentary: if you're wondering how a hypervisor or virtualization works, I hope this guide is useful to you.