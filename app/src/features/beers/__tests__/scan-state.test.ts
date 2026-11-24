import { initialScanState, scanReducer, type ScanState } from '../lib/scan-state';

const looking: ScanState = { kind: 'looking', code: '5410228142249' };

it('starts scanning', () => {
  expect(initialScanState).toEqual({ kind: 'scanning' });
});

it('looks a code up once it is detected', () => {
  expect(scanReducer(initialScanState, { type: 'detected', code: '5410228142249' })).toEqual(looking);
});

it('ignores more detections while a code is being looked up', () => {
  expect(scanReducer(looking, { type: 'detected', code: '5410228142249' })).toBe(looking);
  expect(scanReducer(looking, { type: 'detected', code: '96385074' })).toBe(looking);
});

it('keeps the result of the lookup with its code', () => {
  expect(scanReducer(looking, { type: 'resolved', result: { status: 'not_found' } })).toEqual({
    kind: 'result',
    code: '5410228142249',
    result: { status: 'not_found' },
  });
});

it('ignores more detections while showing a result, until retry', () => {
  const result = scanReducer(looking, { type: 'resolved', result: { status: 'not_beer' } });
  expect(scanReducer(result, { type: 'detected', code: '96385074' })).toBe(result);
  expect(scanReducer(result, { type: 'retry' })).toEqual({ kind: 'scanning' });
});
