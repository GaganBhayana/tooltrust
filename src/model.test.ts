import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEVERITIES, compareSeverity, parseRefId, refId } from './model.ts';
import { makeRef, makeServer, makeSkill } from '../test/fixtures/manifests.ts';

test('refId formats ecosystem, name and version', () => {
  assert.equal(refId(makeRef()), 'npm:@acme/weather-mcp@1.2.0');
  assert.equal(refId(makeRef({ ecosystem: 'pypi', name: 'mcp-sql', version: '0.9.1' })), 'pypi:mcp-sql@0.9.1');
});

test('severities are ordered and comparable', () => {
  assert.deepEqual([...SEVERITIES], ['info', 'low', 'medium', 'high', 'critical']);
  assert.ok(compareSeverity('critical', 'high') > 0);
  assert.ok(compareSeverity('low', 'medium') < 0);
  assert.equal(compareSeverity('info', 'info'), 0);
  const sorted = (['medium', 'critical', 'info'] as const).slice().sort(compareSeverity);
  assert.deepEqual(sorted, ['info', 'medium', 'critical']);
});

test('fixture builders produce consistent manifests', () => {
  const server = makeServer();
  assert.equal(server.tools[0]?.name, 'get_forecast');
  assert.deepEqual(server.envVars, ['WEATHER_API_KEY']);
  const skill = makeSkill({ files: ['SKILL.md', 'scripts/build.sh'] });
  assert.equal(skill.ref.ecosystem, 'skill');
  assert.equal(skill.files.length, 2);
});

test('parseRefId round-trips scoped npm, PyPI and skill ids', () => {
  const refs = [
    makeRef(),
    makeRef({ ecosystem: 'pypi', name: 'mcp-sql', version: '0.9.1' }),
    makeRef({ ecosystem: 'skill', name: 'acme/release-notes', version: '0.3.0-beta.1' }),
  ];
  for (const ref of refs) {
    assert.deepEqual(parseRefId(refId(ref)), { ok: true, value: ref });
  }
});

test('parseRefId rejects malformed ids with a reason', () => {
  assert.deepEqual(parseRefId('weather@1.0.0'), { ok: false, error: 'missing-ecosystem' });
  assert.deepEqual(parseRefId(':weather@1.0.0'), { ok: false, error: 'missing-ecosystem' });
  assert.deepEqual(parseRefId('cargo:weather@1.0.0'), { ok: false, error: 'unknown-ecosystem' });
  assert.deepEqual(parseRefId('npm:@acme/weather'), { ok: false, error: 'missing-version' });
  assert.deepEqual(parseRefId('npm:weather@'), { ok: false, error: 'missing-version' });
  assert.deepEqual(parseRefId('npm:@1.0.0'), { ok: false, error: 'missing-version' });
  assert.deepEqual(parseRefId('npm:@@1.0.0'), { ok: false, error: 'missing-name' });
});
