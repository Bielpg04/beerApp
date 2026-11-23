import type { ImportReport } from './off.ts';

/** Markdown summary: printed to the console and to the GitHub Actions job summary. */
export function formatReport(r: ImportReport, dryRun: boolean): string {
  const lines = [
    `### Open Food Facts${dryRun ? ' (dry run)' : ''}`,
    '',
    `| Read (en:beers) | In Europe/US | Beers | Barcodes | Created | Updated | Barcodes added | Conflicts | Skipped |`,
    `| --- | --- | --- | --- | --- | --- | --- | --- | --- |`,
    `| ${r.read} | ${r.accepted} | ${r.groups} | ${r.barcodes} | ${r.created} | ${r.updated} | ${r.barcodesAdded} | ${r.conflicts} | ${r.skipped} |`,
  ];
  if (r.conflicts > 0) {
    lines.push(
      '',
      'Conflicts are listed in `catalog_import.conflicts`; fix them with `catalog_import.merge_beers()`.',
    );
  }
  if (r.skipped > 0) {
    lines.push(
      '',
      'Skipped groups (rejected by the database) are in `catalog_import.errors` with their error.',
    );
  }
  if (r.samples.length > 0) {
    lines.push(
      '',
      '<details><summary>Beers that merged several products (check for wrong merges)</summary>',
      '',
    );
    for (const g of r.samples) {
      lines.push(`- **${g.brand}** · ${g.name} — ${g.barcodes.map((b) => b.code).join(', ')}`);
    }
    lines.push('', '</details>');
  }
  return lines.join('\n');
}
