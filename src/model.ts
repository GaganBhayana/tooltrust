/** Every ecosystem ToolTrust scans. */
export const ECOSYSTEMS = ['npm', 'pypi', 'registry', 'skill'] as const;

/** Where a scanned artefact comes from. */
export type Ecosystem = (typeof ECOSYSTEMS)[number];

/** A specific version of a package, server or skill. */
export interface PackageRef {
  readonly ecosystem: Ecosystem;
  readonly name: string;
  readonly version: string;
}

/** A tool an MCP server exposes, as listed by `tools/list`. */
export interface ToolDef {
  readonly name: string;
  readonly description: string;
  /** JSON Schema for the tool input, kept as plain data. */
  readonly inputSchema: Readonly<Record<string, unknown>>;
}

/** How an MCP server is started. */
export type Transport = 'stdio' | 'streamable-http' | 'sse';

/** What we know about an MCP server version. */
export interface ServerManifest {
  readonly ref: PackageRef;
  readonly transport: Transport;
  readonly tools: readonly ToolDef[];
  /** Environment variable names the server reads (names only, never values). */
  readonly envVars: readonly string[];
  readonly repositoryUrl?: string;
}

/** What we know about an agent skill version. */
export interface SkillManifest {
  readonly ref: PackageRef;
  /** `name` from SKILL.md frontmatter. */
  readonly skillName: string;
  /** `description` from SKILL.md frontmatter. */
  readonly description: string;
  /** SKILL.md body without the frontmatter. */
  readonly body: string;
  /** Paths of files shipped with the skill, relative to its folder. */
  readonly files: readonly string[];
}

/** Ordered from least to most severe. */
export const SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'] as const;

/** One of {@link SEVERITIES}. */
export type Severity = (typeof SEVERITIES)[number];

/** Where a finding was observed. Excerpts are untrusted text. */
export interface FindingEvidence {
  readonly path?: string;
  readonly excerpt: string;
  /** Character offset of the excerpt in its source, if known. */
  readonly offset?: number;
  readonly line?: number;
}

/** One result from a rule. */
export interface Finding {
  readonly ruleId: string;
  readonly severity: Severity;
  readonly message: string;
  readonly evidence: FindingEvidence;
}

/** Compares severities; positive when `a` is more severe than `b`. */
export function compareSeverity(a: Severity, b: Severity): number {
  return SEVERITIES.indexOf(a) - SEVERITIES.indexOf(b);
}

/** A stable, human-readable id for a package version, such as `npm:@acme/mcp@1.2.0`. */
export function refId(ref: PackageRef): string {
  return `${ref.ecosystem}:${ref.name}@${ref.version}`;
}

/** Why a ref id could not be parsed. */
export type RefIdError = 'missing-ecosystem' | 'unknown-ecosystem' | 'missing-version' | 'missing-name';

/**
 * Parses an id produced by {@link refId}. Splits on the first `:` and the last `@`,
 * so scoped npm names such as `@acme/x` keep their leading `@`.
 */
export function parseRefId(id: string): { ok: true; value: PackageRef } | { ok: false; error: RefIdError } {
  const colon = id.indexOf(':');
  if (colon <= 0) return { ok: false, error: 'missing-ecosystem' };
  const ecosystem = id.slice(0, colon);
  if (!(ECOSYSTEMS as readonly string[]).includes(ecosystem)) return { ok: false, error: 'unknown-ecosystem' };
  const rest = id.slice(colon + 1);
  const at = rest.lastIndexOf('@');
  // An '@' at position 0 is an npm scope marker, not a version separator.
  if (at <= 0 || at === rest.length - 1) return { ok: false, error: 'missing-version' };
  const name = rest.slice(0, at);
  if (name === '' || name === '@') return { ok: false, error: 'missing-name' };
  return { ok: true, value: { ecosystem: ecosystem as Ecosystem, name, version: rest.slice(at + 1) } };
}
