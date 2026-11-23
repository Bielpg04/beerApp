/**
 * Open Food Facts CSV dump → beer groups → catalog_import.merge().
 * The dump is ~1.5 GB gzipped (tab-separated, one product per line); it is streamed,
 * never stored, and only lines mentioning en:beers are parsed.
 */
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import type { Sql } from 'postgres';

import {
  USER_AGENT,
  acceptRow,
  decodeHtmlEntities,
  groupRows,
} from '../../supabase/functions/_shared/catalog/index.ts';
import type { BeerGroup, OffRow } from '../../supabase/functions/_shared/catalog/index.ts';

export const OFF_CSV_URL = 'https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz';

const COLUMNS = {
  code: 'code',
  productName: 'product_name',
  brands: 'brands',
  categoriesTags: 'categories_tags',
  countriesTags: 'countries_tags',
  originsTags: 'origins_tags',
  alcohol100g: 'alcohol_100g',
  imageUrl: 'image_url',
  imageSmallUrl: 'image_small_url',
  uniqueScans: 'unique_scans_n',
  lastModified: 'last_modified_t',
} as const;

async function* lines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader();
  const first = await reader.read();
  const head = first.done ? new Uint8Array() : first.value;
  // Put the first chunk back in front of the rest, then gunzip if it is gzip (1f 8b).
  const replay = new ReadableStream<Uint8Array>({
    start(controller) {
      if (head.length > 0) controller.enqueue(head);
    },
    async pull(controller) {
      const next = await reader.read();
      if (next.done) controller.close();
      else controller.enqueue(next.value);
    },
  });
  const bytes =
    head[0] === 0x1f && head[1] === 0x8b ? replay.pipeThrough(new DecompressionStream('gzip')) : replay;

  let buffer = '';
  for await (const text of bytes.pipeThrough(new TextDecoderStream())) {
    buffer += text;
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      yield buffer.slice(0, nl).replace(/\r$/, '');
      buffer = buffer.slice(nl + 1);
    }
  }
  if (buffer) yield buffer;
}

const list = (value: string | undefined) => (value ? value.split(',').filter(Boolean) : []);

/** Rows of the dump that list en:beers among their categories. */
export async function* readOffRows(stream: ReadableStream<Uint8Array>): AsyncGenerator<OffRow> {
  let index: Record<keyof typeof COLUMNS, number> | null = null;
  for await (const line of lines(stream)) {
    if (!index) {
      const header = line.split('\t');
      index = Object.fromEntries(
        Object.entries(COLUMNS).map(([key, name]) => [key, header.indexOf(name)]),
      ) as Record<keyof typeof COLUMNS, number>;
      continue;
    }
    if (!line.includes('en:beers')) continue; // cheap pre-filter: millions of lines
    const f = line.split('\t');
    const get = (key: keyof typeof COLUMNS) => (index![key] >= 0 ? (f[index![key]] ?? '') : '');
    const categoriesTags = list(get('categoriesTags'));
    if (!categoriesTags.includes('en:beers')) continue;
    yield {
      code: get('code'),
      productName: decodeHtmlEntities(get('productName')).trim(),
      brands: decodeHtmlEntities(get('brands')).trim(),
      categoriesTags,
      countriesTags: list(get('countriesTags')),
      originsTags: list(get('originsTags')),
      alcohol100g: get('alcohol100g'),
      imageUrl: get('imageUrl'),
      imageSmallUrl: get('imageSmallUrl'),
      uniqueScans: Number(get('uniqueScans')) || 0,
      lastModified: Number(get('lastModified')) || 0,
    };
  }
}

export type ImportReport = {
  read: number;
  accepted: number;
  groups: number;
  barcodes: number;
  created: number;
  updated: number;
  barcodesAdded: number;
  conflicts: number;
  skipped: number;
  samples: BeerGroup[];
};

async function openDump(file?: string): Promise<ReadableStream<Uint8Array>> {
  if (file) return Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>;
  const res = await fetch(OFF_CSV_URL, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok || !res.body) throw new Error(`Open Food Facts dump: HTTP ${res.status}`);
  return res.body;
}

export async function importOff(
  sql: Sql | null,
  opts: { file?: string; dryRun: boolean },
): Promise<ImportReport> {
  let read = 0;
  const accepted: OffRow[] = [];
  for await (const row of readOffRows(await openDump(opts.file))) {
    read++;
    if (acceptRow(row)) accepted.push(row);
  }
  const groups = groupRows(accepted);
  const report: ImportReport = {
    read,
    accepted: accepted.length,
    groups: groups.length,
    barcodes: groups.reduce((n, g) => n + g.barcodes.length, 0),
    created: 0,
    updated: 0,
    barcodesAdded: 0,
    conflicts: 0,
    skipped: 0,
    samples: groups.filter((g) => g.barcodes.length > 1).slice(0, 50),
  };
  if (opts.dryRun || !sql) return report;

  await sql.begin(async (tx) => {
    for (let i = 0; i < groups.length; i += 1000) {
      const batch = groups.slice(i, i + 1000);
      await tx`
        insert into catalog_import.staged_groups (payload)
        select value from jsonb_array_elements(${tx.json(batch)})`;
    }
    const [r] = await tx`select * from catalog_import.merge()`;
    report.created = r.created;
    report.updated = r.updated;
    report.barcodesAdded = r.barcodes_added;
    report.conflicts = r.conflicts;
    report.skipped = r.skipped;
  });
  return report;
}
