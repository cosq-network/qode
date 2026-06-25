---
name: qemu
description: "QEMU virtualization workflows: disk image creation, VM runs, snapshot management, and image discovery."
tags: [qemu, virtualization, kvm, vm, disk, iso, snapshots]
---

Use QEMU tooling when the user asks to create, run, inspect, snapshot, or connect to a QEMU virtual machine.
Preferred sources of truth:
- local registered tools: qemu_create_vm, qemu_run_vm, qemu_snapshot, qemu_list_vms
Every QEMU action must map directly to one of those tools or another validated QEMU workflow.
