---
name: package-management
version: 0.1.0
description: "Install packages, detect language ecosystems, manage dependencies, and resolve version conflicts."
---

Use this when the user asks to install/upgrade/downgrade packages, audit dependencies, detect ecosystem lock files, or resolve conflicts. Maps from the registered package-management tools. Preferred sources of truth:
- local registered tools: install_package, package_manager_detect, package_manager_list_dependencies, package_manager_audit_dependencies, package_manager_update_dependencies
Every package_management request must map directly to one of those tools.
