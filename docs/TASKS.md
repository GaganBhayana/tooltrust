# ToolTrust tasks

Status values: `todo`, `review (PR #n)`, `done (PR #n)`, `blocked: <reason>`. Sizes: S (under 150 lines changed), M (150–400). One task per PR. M0 tasks are pure logic with no I/O. Test fixtures that contain attack text must be clearly marked as test data and must never be executable.

## M0 Foundation

### TT-001 Models for packages, tools and findings
- Status: done (PR #1)
- Size: S
- Depends on: none
- Goal: `src/model.ts` with `PackageRef {ecosystem: npm|pypi|registry|skill, name, version}`, `ToolDef {name, description, inputSchema}`, `ServerManifest`, `SkillManifest`, and `Finding {ruleId, severity, message, evidence:{path?, excerpt, offset?}}`.
- Acceptance: exported types and fixture builders in `test/fixtures/`.

### TT-002 Unicode trickery detector
- Status: done (PR #2)
- Size: M
- Depends on: TT-001
- Goal: `src/unicode/detect.ts` finds zero-width characters, Unicode tag characters (U+E0000–U+E007F), bidi overrides and isolates, homoglyph-mixed scripts in identifiers, and decodes tag-character payloads into readable text for the evidence.
- Acceptance: tests for each class, with escaped fixtures (`​` etc.) and positions reported correctly.

### TT-003 Instruction-pattern rules for tool descriptions
- Status: todo
- Size: M
- Depends on: TT-001
- Goal: `src/rules/description.ts` flags model-directed imperatives ("ignore previous", "do not tell the user", "always call", "before using any other tool"), requests to read secrets or files unrelated to the tool's purpose, cross-tool references, and exfiltration hints (URLs with query placeholders). Each rule has an id, severity and rationale.
- Acceptance: 30+ table-driven cases with benign look-alikes that must not fire.

### TT-004 Capability detection in JavaScript and TypeScript source
- Status: todo
- Size: M
- Depends on: TT-001
- Goal: `src/rules/capabilities-js.ts` scans source text (tokenizer-light, no execution) for `child_process`, `exec`, `spawn`, `eval`, `new Function`, `fs` writes, `fetch`/`http(s)` requests, `process.env` reads, dynamic `require`/`import` of computed strings.
- Acceptance: tests that ignore matches in comments and strings, and report file and line.

### TT-005 Capability detection in Python source
- Status: todo
- Size: M
- Depends on: TT-004
- Goal: `src/rules/capabilities-py.ts` for `subprocess`, `os.system`, `eval`/`exec`, `open(..., 'w')`, `requests`/`httpx`/`urllib`, `os.environ`, `importlib` with computed names.
- Acceptance: tests mirroring TT-004.

### TT-006 SKILL.md analyser
- Status: todo
- Size: M
- Depends on: TT-002, TT-003
- Goal: `src/skills/analyse.ts` parses SKILL.md frontmatter and body, lists referenced scripts and commands, network calls, writes outside the skill folder, and runs TT-002/TT-003 on the body.
- Acceptance: tests with benign and risky skill fixtures.

### TT-007 OWASP MCP Top 10 mapping
- Status: todo
- Size: S
- Depends on: TT-003, TT-004
- Goal: `src/rules/owasp.ts` maps rule ids to OWASP MCP Top 10 categories with links; unknown rules map to none.
- Acceptance: every rule id in the repo has a mapping or an explicit "none" (test enumerates rules).

### TT-008 Grader
- Status: todo
- Size: S
- Depends on: TT-001
- Goal: `src/grade/grade.ts` implements the rubric in PLAN.md with per-rule caps and the tool-poisoning cap; returns score, letter and the deduction breakdown.
- Acceptance: tests for boundaries and caps.

### TT-009 Version diff for rug-pull detection
- Status: todo
- Size: S
- Depends on: TT-001
- Goal: `src/diff/versions.ts` compares two manifests: tools added/removed, description changes (with a word diff), new capabilities; flags silent risk increases.
- Acceptance: tests for each change type.

### TT-010 Badge SVG renderer
- Status: todo
- Size: S
- Depends on: TT-008
- Goal: `src/badge.ts` renders a shields-style SVG badge for a grade with accessible title and correct text width estimate.
- Acceptance: snapshot tests; output is valid XML (parsed in test).

## M1 Crawl and static (outline, detailed by the weekly planning session)

- TT-011 npm crawler for MCP packages (keywords, `mcp` fields).
- TT-012 PyPI crawler.
- TT-013 Official MCP registry crawler.
- TT-014 Package fetch and safe unpack (tarball/zip limits, path traversal guard).
- TT-015 Static pipeline and storage.
- TT-016 Site v0: package pages and search.
