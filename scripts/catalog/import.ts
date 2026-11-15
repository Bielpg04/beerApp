/**
 * Catalog importer.
 *   npm run catalog:import -- --source obdb|off|all [--dry-run] [--off-file <path>]
 * Writes to local Supabase unless CATALOG_DB_URL is set. --dry-run never connects.
 */
import { parseArgs } from 'node:util';

import { connect } from './db.ts';
import { importObdb } from './obdb.ts';

const { values } = parseArgs({
  options: {
    source: { type: 'string', default: 'all' },
    'dry-run': { type: 'boolean', default: false },
    'off-file': { type: 'string' },
  },
});

const source = values.source;
if (!['obdb', 'off', 'all'].includes(source)) {
  console.error(`Unknown --source ${source} (obdb | off | all)`);
  process.exit(2);
}
const dryRun = values['dry-run'];
const sql = dryRun ? null : connect();

try {
  if (source === 'obdb' || source === 'all') {
    const r = await importObdb(sql);
    console.log(`Open Brewery DB: ${r.read} read, ${r.inScope} in Europe/US, ${r.written} written`);
  }
} finally {
  await sql?.end();
}
