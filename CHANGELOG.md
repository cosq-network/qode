# Changelog

## 1.2.2

- Added bundled Ionic, MSBuild, NPX, and QEMU tools and matching skills.
- Copied bundled skills into `dist/skills` during production builds so npm installs include them.
- Added production verification scripts for build, lint, tests, package contents, and CLI smoke checks.
- Removed compiled tests from production builds and package contents.
- Redacted sensitive tool-call logging values.
- Normalized filesystem mutation permissions to the existing `edit` category.
