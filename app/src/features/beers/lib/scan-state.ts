import type { LookupResult } from '../types';

export type ScanState =
  | { kind: 'scanning' }
  | { kind: 'looking'; code: string }
  | { kind: 'result'; code: string; result: LookupResult };

export type ScanEvent =
  { type: 'detected'; code: string } | { type: 'resolved'; result: LookupResult } | { type: 'retry' };

export const initialScanState: ScanState = { kind: 'scanning' };

/** The camera fires many times per second: only the first detection while scanning counts. */
export function scanReducer(state: ScanState, event: ScanEvent): ScanState {
  switch (event.type) {
    case 'detected':
      return state.kind === 'scanning' ? { kind: 'looking', code: event.code } : state;
    case 'resolved':
      return state.kind === 'looking' ? { kind: 'result', code: state.code, result: event.result } : state;
    case 'retry':
      return initialScanState;
  }
}
