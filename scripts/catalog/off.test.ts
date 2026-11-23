import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

import { acceptRow, groupRows, normalizeGtin } from '../../supabase/functions/_shared/catalog/index.ts';
import type { OffRow } from '../../supabase/functions/_shared/catalog/index.ts';
import { readOffRows } from './off.ts';

const FIXTURE = readFileSync(new URL('./fixtures/off-sample.tsv', import.meta.url));

function streamOf(bytes: Uint8Array, chunk = 4096): ReadableStream<Uint8Array> {
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) return controller.close();
      controller.enqueue(bytes.subarray(offset, offset + chunk));
      offset += chunk;
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<OffRow[]> {
  const rows: OffRow[] = [];
  for await (const r of readOffRows(stream)) rows.push(r);
  return rows;
}

test('readOffRows reads the real OFF columns by header name', async () => {
  const rows = await collect(streamOf(FIXTURE));
  const porter = rows.find((r) => r.code === '0009439002579');
  assert.ok(porter);
  assert.equal(porter.productName, 'London Porter');
  assert.equal(porter.brands, "Fuller's");
  assert.ok(porter.categoriesTags.includes('en:beers'));
  assert.deepEqual(porter.countriesTags, ['en:france']);
  assert.equal(typeof porter.lastModified, 'number');
  assert.ok(porter.lastModified > 0);
});

test('readOffRows only yields rows that may be beers', async () => {
  const rows = await collect(streamOf(FIXTURE));
  assert.equal(rows.length, 27);
  assert.ok(rows.every((r) => r.categoriesTags.includes('en:beers')));
});

test('the fixture pipeline keeps beers sold in Europe or the US', async () => {
  const accepted = (await collect(streamOf(FIXTURE))).filter(acceptRow);
  assert.equal(accepted.length, 22);
  const groups = groupRows(accepted);
  const codes = groups.flatMap((g) => g.barcodes.map((b) => b.code));
  assert.ok(codes.includes('0009439002579'), 'London Porter (France) is kept');
  assert.ok(!codes.includes('0062067335341'), 'Budweiser sold only in Canada is dropped');
  assert.ok(codes.every((c) => normalizeGtin(c) === c));
  assert.ok(groups.length <= accepted.length);
});

test('a gzipped dump gives the same rows', async () => {
  const plain = await collect(streamOf(FIXTURE));
  const zipped = await collect(streamOf(gzipSync(FIXTURE), 1000));
  assert.deepEqual(zipped, plain);
});

test('readOffRows decodes HTML entities in names and brands', async () => {
  const tsv = [
    'code\tproduct_name\tbrands\tcategories_tags',
    '2999999000017\tCerveza &quot;Judas&quot;\tSmith &amp; Sons\ten:beverages,en:beers',
  ].join('\n');
  const [r] = await collect(streamOf(new TextEncoder().encode(tsv)));
  assert.equal(r.productName, 'Cerveza "Judas"');
  assert.equal(r.brands, 'Smith & Sons');
});
