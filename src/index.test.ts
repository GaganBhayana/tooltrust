import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSION } from './index.ts';

test('exports a semver version string', () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
});
