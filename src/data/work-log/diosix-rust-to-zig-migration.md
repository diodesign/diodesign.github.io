---
title: "Migrating Diosix to Zig"
date: "2026-04-30"
byline: "Chris Williams"
permalink: "diosix-rust-to-zig-migration.html"
summary: "Migrating the Diosix hypervisor from Rust to Zig."
---

I've decided to move the [Diosix](https://diosix.org/) [RISC-V](https://riscv.org/) hypervisor codebase from [Rust](https://www.rust-lang.org/) to [Zig](https://ziglang.org/). While I appreciate Rust's safety, and it is a fantastic language, I find Zig's approach to low-level systems programming more productive. This isn't a critique of Rust’s capabilities, but rather a preference for a different development flow. Zig allows me to write as I think from an overall design, giving me the mechanisms for safety without the restrictiveness of a mandatory borrow checker.

You can find this ongoing Zig work in the [zig branch](https://github.com/diodesign/diosix/tree/zig) of the Diosix git repository.

The road ahead for Diosix is focused on demonstrating its architecture as a mesh of autonomous gossiping nodes. 

The next phase of the project will see Diosix evolve into a self-organizing mesh, where localized reasoning within a sovereign root VM allows it and its peer VMs to negotiate resources and maintain resilience across the mesh without a central controller. This shift toward decentralized intent is going to be an interesting challenge to pull off, and I’m curious to see how this new environment handles the stress of 1,000 or more VMs.

I’ll be pushing these experiments out as they stabilize; I'm wondering what others might build on top of a system that manages itself.