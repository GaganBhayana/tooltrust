# ToolTrust plan

**Check the grade before you give an agent your keys.**

ToolTrust is a public, continuously updated trust index for MCP servers and agent skills. It crawls registries, runs static and sandboxed dynamic checks, and publishes A–F grades, README badges, a JSON API and a CLI for CI allowlists.

## Why

Agents install MCP servers and skills with broad powers (shell, files, network, credentials). 2026 saw dozens of MCP CVEs and tool-poisoning attacks. There are many one-off scanners, but no always-on public scorecard, the way OpenSSF Scorecard or Socket.dev work for packages.

## Functional requirements

MVP (launch 19 Jul 2027):

1. **Crawl:** the official MCP registry, npm and PyPI packages that declare MCP servers, and public skill repos and marketplaces; queue every new version.
2. **Static checks** on source and manifests:
   - capabilities: shell execution, filesystem writes, network egress, environment and credential reads;
   - tool descriptions: hidden or invisible instructions (zero-width characters, Unicode tag characters, bidi overrides), imperative instructions aimed at the model, cross-tool references ("before using any other tool…"), over-broad claims;
   - secrets handling and logging of inputs;
   - SKILL.md: scripts it runs, network calls, file writes outside its folder;
   - mapping to the OWASP MCP Top 10.
3. **Dynamic checks** (popular or changed packages): start the server in an isolated microVM with egress denied and logged, list tools, fuzz inputs, record attempted connections and file writes.
4. **LLM classifier** for risky description language, with every finding linked to the exact text.
5. **Grades:** A–F per version from a published, versioned rubric; a public page per package; README badge; JSON API; `tooltrust check <pkg>` CLI for CI.
6. **Rug-pull alerts:** diff tool descriptions and capabilities between versions; flag silent changes.

Later: an MCP server agents can query before installing; maintainer appeals and verified-publisher status; SARIF export; org allowlist sync.

## Non-functional requirements

| Area | Requirement |
| --- | --- |
| Isolation | Every dynamic run in a throwaway microVM; no secrets; default-deny egress |
| Transparency | Open rubric, versioned rules, reproducible scan records |
| Scale | 20,000+ packages; rescan each new version within 24 h |
| Cost | Under $150 a month at launch |
| Responsible disclosure | 7-day private notice to maintainers before publishing critical findings |

## Architecture

```
crawlers ─► package queue ─► fetch + unpack ─► static analysers ─► (dynamic sandbox for selected) ─► LLM classifier ─► grader ─► store ─► site + API + badges
```

Pure logic in `src/manifest/`, `src/rules/`, `src/unicode/`, `src/grade/`, `src/diff/`; crawlers and sandbox on forge-core.

## Grading rubric (v0 draft)

Start at 100; deductions by finding severity (critical −40, high −20, medium −8, low −2), capped per rule; any confirmed tool-poisoning text caps the grade at D; unknown dynamic behaviour shows "not yet run" rather than guessing. A ≥ 90, B ≥ 80, C ≥ 65, D ≥ 50, else F.

## Milestones

| Milestone | Target | Scope |
| --- | --- | --- |
| M0 Foundation | Feb–May 2027 (rotation) | Manifest and tool-description models, Unicode trickery detector, instruction-pattern rules, capability detection from source, SKILL.md analyser, rubric + grader, version diff |
| M1 Crawl + static | Jun 2027 | Crawlers, unpacking, static pipeline, storage, site v0 |
| M2 Dynamic + launch | 19 Jul 2027 | microVM sandbox runs, classifier, badges, API, CLI, launch |
