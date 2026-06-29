# Qode Roadmap

This roadmap captures the current direction for Qode across product, engineering, AI ethics and compliance, security, operations, and go-to-production readiness.

---

## 1. Vision

Qode should become the most trusted AI-native coding CLI for developer teams: fast, local-first where privacy matters, multi-provider by default, and suitable for regulated environments as well as solo developers.

---

## 2. Current Capability Snapshot

- Multi-provider coding CLI with 11+ providers.
- Secure credential storage in `~/.qode/auth.json`.
- Slash commands, TUI themes, semantic search, session management, and skill installation.
- **Context Fusion Panel**: Compare outputs from two providers via `/compare`.
- **Agentic Workspace Map**: Live structural repo digest via `/workspace` and `@workspace`.
- **Tool Audit Trail**: Track file edits and shell executions with risk metadata (`/audit`).
- **Smart Skill Seeds**: Dynamic tech-stack scanning to suggest relevant skills (`/skills suggest`).
- **Terminal Diff Theater**: Interactive before/after terminal modal to accept or revert automated edits.

*(Note: Local model inferencing via llama.cpp has been completely discarded from the plan.)*

---

## 3. Near-Term: Differentiating Tooling (0–3 months)

These integrations are designed to make Qode stand apart from generic AI coding assistants.

### 3.1 Context Fusion Panel (COMPLETED)
- Send the same prompt to two configured providers in parallel.
- Render a compact diff-style summary inside the terminal UI.
- Provide a `/compare <prompt>` command and a key toggle for quick access.
- Goal: turn multi-provider support into a literal cross-provider comparison layer.

### 3.2 Local Sensitive Guard (DISCARDED)
- *This feature has been completely discarded from the plan because local model inferencing is no longer supported.*

### 3.3 Agentic Workspace Map (COMPLETED)
- Build a live structural digest of the active repository: entry points, configs, tests, recent changes.
- Expose it via `/workspace` and integrate with `@`-prefix prompt suggestions.
- Goal: reduce onboarding friction when switching codebases.

### 3.4 Tool Audit Trail (COMPLETED)
- Capture every shell, file, and edit action during a session with risk level metadata.
- Provide a `/audit` command for in-session review and persistent storage in session JSON files.
- Goal: add lightweight accountability for agentic tool runs.

### 3.5 Smart Skill Seeds (COMPLETED)
- Scan the active repository for detected tech stack and propose candidate skills.
- Support `/skills suggest` and guided scaffolding from registry metadata.
- Goal: move the skill system from manual install to repo-aware persona injection.

### 3.6 Terminal Diff Theater (COMPLETED)
- After edits, render an animated before/after view inside the chat UI using the existing blessed terminal layer.
- Expose accept, revert, and expand actions via bound keys.
- Goal: improve trust in automated edits through native terminal review.

---

## 4. Medium-Term: Hardening and Team Readiness (3–9 months)

These items focus on production quality for teams and regulated environments.

### 4.1 Team and Org Standards
- Define branch and release naming conventions.
- Introduce a `CHANGELOG.md` kept in sync with tags.
- Define code review and approval policy for CLI entrypoint and auth changes.

### 4.2 Collaboration Model
- Assign owners for auth, providers, TUI, skills, and docs.
- Use issue templates and PR checklists for:
  - security review
  - test coverage
  - README and `--help` updates
  - changelog entry

### 4.3 Localization and i18n
- Externalize terminal strings for error messages, status panels, and help text.
- Target first pass: English plus one additional language based on user demand.

---

## 5. AI Compliance, Ethics, and Responsibility

This section addresses how Qode will operate as an AI-powered coding assistant.

### 5.1 Transparency
- Every provider and model used in a session is visible in the UI and session metadata.
- Explain model origin, region, data usage constraints, and cost tier where available.

### 5.2 Data Minimization
- Prompt minimization before storage and compression.
- No credential or key logging at any layer.

### 5.3 Human Oversight
- Destructive or mutating commands require explicit session approval by default.
- Audit trail must be reviewable before and after session close.

### 5.4 Fairness and Safety
- Avoid provider defaults that privilege one ecosystem without user consent.
- Maintain balanced model attribution in slash completions and model listings.

### 5.5 Regulatory Alignment
- Track regulations relevant to AI-assisted developer tooling.
- Maintain a public-facing AI use statement in documentation.
- Maintain an incident and misuse report path.

---

## 6. Security Protocols

Security is a first-class requirement, not a late add-on.

### 6.1 Credential Storage
- Continue using encrypted storage at `~/.qode/auth.json`.
- Mask all interactive prompts using `@clack/prompts`.
- Prevent keys from appearing in process arguments or logs.

### 6.2 Permission System
- Enforce ask/allow/deny rules at tool, category, and mode levels.
- Plan mode must deny edits and sensitive bash by default.
- Build mode must require explicit confirmation for destructive commands.

### 6.3 Dependency and Supply Chain Security
- Review dependency updates through automated PRs.
- Pin and audit critical packages used in auth, shell execution, and network calls.
- Block unknown network destinations for download and registry operations unless explicitly allowed.

### 6.4 Vulnerability Reporting
- Provide a security contact in repository metadata.
- Track security findings in a dedicated issue label workflow.

---

## 7. Go to Production Plan

This plan is intended to make Qode ready for external distribution and team adoption.

### 7.1 Package Quality
- Keep `npm run build`, `npm test`, and `npm run lint` green in CI.
- Produce deterministic releases tagged from `main`.
- Maintain `package.json` metadata for GitHub Packages publishing.

### 7.2 Distribution
- Distribute via GitHub Packages npm registry.
- Maintain a public release checklist covering:
  - version bump
  - changelog
  - docs
  - smoke tests

### 7.3 Observability and Support
- Add structured error reporting without leaking secrets.
- Support `--json` output for machine-readable logs.
- Provide common troubleshooting paths in docs.

### 7.4 Rollout and Feedback
- Use staged adoption: personal use first, then small teams, then organization-wide.
- Maintain a `docs/feedback.md` and issue template to collect recurring pain points.
- Define a deprecation policy for old commands and themes.

---

## 8. Future Exploration
- Subagent orchestration for long-running refactors.
- Multi-repository awareness.
- Workspace-aware permission policy templates.
- Marketplace for team-curated skills.

---

## 9. Guiding Principles
- Privacy before convenience.
- Transparency over hidden automation.
- Useful differentiation over feature sprawl.
- Documentation and tests are part of the feature.
