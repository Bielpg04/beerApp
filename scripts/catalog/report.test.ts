import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatReport } from './report.ts';

const base = {
  read: 10,
  accepted: 8,
  groups: 7,
  barcodes: 9,
  created: 5,
  updated: 1,
  barcodesAdded: 6,
  conflicts: 0,
  skipped: 1,
  samples: [],
};

test('the report shows skipped groups and where to find them', () => {
  const md = formatReport(base, false);
  assert.match(md, /\| Skipped \|/);
  assert.match(md, /\| 10 \| 8 \| 7 \| 9 \| 5 \| 1 \| 6 \| 0 \| 1 \|/);
  assert.match(md, /catalog_import\.errors/);
});

test('no skipped groups, no hint', () => {
  assert.doesNotMatch(formatReport({ ...base, skipped: 0 }, false), /catalog_import\.errors/);
});
