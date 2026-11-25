import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('only New York and Las Vegas remain selectable maps', () => {
  for (const map of ['alaska', 'dc', 'valley', 'coast', 'chongqing']) {
    assert.match(html, new RegExp(`value="${map}" disabled`));
  }
  assert.doesNotMatch(html, /value="random"/);
  assert.match(html, /value="manhattan" checked/);
  assert.match(html, /value="vegas"/);
  assert.match(html, /assets\/chongqing\/chongqing-night-photo\.png/);
});

test('UFO is removed from the launcher and renderer', () => {
  assert.doesNotMatch(html, /UFO|saucer|buildSaucerMesh/);
});
