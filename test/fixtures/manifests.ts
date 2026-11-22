import type { PackageRef, ServerManifest, SkillManifest, ToolDef } from '../../src/model.ts';

/** Builds a package reference for tests. */
export function makeRef(overrides: Partial<PackageRef> = {}): PackageRef {
  return { ecosystem: 'npm', name: '@acme/weather-mcp', version: '1.2.0', ...overrides };
}

/** Builds a benign tool definition for tests. */
export function makeTool(overrides: Partial<ToolDef> = {}): ToolDef {
  return {
    name: 'get_forecast',
    description: 'Returns the weather forecast for a city.',
    inputSchema: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
    ...overrides,
  };
}

/** Builds an MCP server manifest for tests. */
export function makeServer(overrides: Partial<ServerManifest> = {}): ServerManifest {
  return { ref: makeRef(), transport: 'stdio', tools: [makeTool()], envVars: ['WEATHER_API_KEY'], ...overrides };
}

/** Builds a skill manifest for tests. */
export function makeSkill(overrides: Partial<SkillManifest> = {}): SkillManifest {
  return {
    ref: makeRef({ ecosystem: 'skill', name: 'acme/release-notes', version: '0.3.0' }),
    skillName: 'release-notes',
    description: 'Use when writing release notes from merged pull requests.',
    body: '# Release notes\n\nRead the merged PRs and group them by type.',
    files: ['SKILL.md'],
    ...overrides,
  };
}
