import type { GameState, HexCoord } from './protocol';
import { computeMajority } from './majority';

export type RoundSettlementResult = {
  payoutsByPlayerId: Record<string, Record<string, number>>;
  noiseDelta: Record<string, number>;
};

function zeroResources(state: GameState): Record<string, number> {
  const all = state.resources?.registry ?? [];
  const out: Record<string, number> = {};
  for (const r of all) out[r.id] = 0;
  return out;
}

export function computeRoundSettlement(state: GameState): RoundSettlementResult {
  const payoutsByPlayerId: Record<string, Record<string, number>> = {};
  for (const p of state.players) payoutsByPlayerId[p.id] = zeroResources(state);
  const noiseDelta: Record<string, number> = zeroResources(state);

  const cells = state.board?.cells ?? [];
  for (const c of cells) {
    const coord: HexCoord = c.tile.coord;
    const prod = c.tile.tile.production ?? {};
    // Skip non-producing tiles entirely
    if (!prod || Object.keys(prod).length === 0) continue;
    const maj = computeMajority(state, coord);
    if (maj.max === 0) continue; // no influence at all -> no yield

    // Build list of top influencers when there's a tie; when single leader, winnerIds has one element.
    const winnerIds: string[] = [];
    if (!maj.isTie && maj.leaderId) {
      winnerIds.push(maj.leaderId);
    } else if (maj.isTie && maj.max > 0) {
      for (const p of state.players) {
        const v = maj.totalByPlayerId[p.id] ?? 0;
        if (v === maj.max) winnerIds.push(p.id);
      }
    }
    if (winnerIds.length === 0) continue; // defensive

    for (const [resId, amount] of Object.entries(prod)) {
      const y = Math.max(0, amount | 0);
      if (y <= 0) continue;
      if (winnerIds.length === 1) {
        const pid = winnerIds[0]!;
        (payoutsByPlayerId[pid] ?? (payoutsByPlayerId[pid] = zeroResources(state)))[resId] = ((payoutsByPlayerId[pid] ?? (payoutsByPlayerId[pid] = zeroResources(state)))[resId] ?? 0) + y;
      } else {
        const n = winnerIds.length;
        const share = Math.floor(y / n);
        const remainder = y - share * n;
        for (const pid of winnerIds) {
          (payoutsByPlayerId[pid] ?? (payoutsByPlayerId[pid] = zeroResources(state)))[resId] = ((payoutsByPlayerId[pid] ?? (payoutsByPlayerId[pid] = zeroResources(state)))[resId] ?? 0) + share;
        }
        noiseDelta[resId] = (noiseDelta[resId] ?? 0) + remainder;
      }
    }
  }

  return { payoutsByPlayerId, noiseDelta };
}

export function settleRound(state: GameState): { nextState: GameState; result: RoundSettlementResult } {
  const { payoutsByPlayerId, noiseDelta } = computeRoundSettlement(state);
  // Apply deterministically to resource pools and noise; do not mutate input state.
  const pools = { ...(state.resourcesByPlayerId ?? {}) };
  const nextPools: Record<string, Record<string, number>> = {};
  for (const p of state.players) {
    const cur = { ...(pools[p.id] ?? {}) };
    const add = payoutsByPlayerId[p.id] ?? {};
    const out: Record<string, number> = { ...cur };
    for (const [r, v] of Object.entries(add)) {
      out[r] = Math.max(0, (out[r] ?? 0) + (v | 0));
    }
    nextPools[p.id] = out;
  }
  const nextNoise: Record<string, number> = { ...state.noise ?? zeroResources(state) };
  for (const [r, v] of Object.entries(noiseDelta)) {
    nextNoise[r] = Math.max(0, (nextNoise[r] ?? 0) + (v | 0));
  }
  const nextState: GameState = ({ ...state, resourcesByPlayerId: nextPools, noise: nextNoise } as GameState);
  return { nextState, result: { payoutsByPlayerId, noiseDelta } };
}




import { GameSnapshotSchema } from './protocol';
import type { GameSnapshot } from './protocol';
import type { EngineRegistries } from './expansion/types';

export function finalizeGame(snapshot: GameSnapshot, registries: EngineRegistries): GameSnapshot {
  const at = Date.now();
  const { nextState } = settleRound(snapshot.state);
  const entry = { id: 'finalize-' + at, at, kind: 'core.finalizeGame', message: 'Final settlement at game end' };
  let next: GameSnapshot = { ...snapshot, revision: snapshot.revision + 1, updatedAt: at, state: nextState, log: [...snapshot.log, entry] } as GameSnapshot;
  const onEnd = registries.hooks.onGameEnd ?? [];
  for (const h of onEnd) {
    try {
      const maybe = h(next);
      if (maybe && typeof maybe === 'object' && 'state' in maybe) {
        next = GameSnapshotSchema.parse(maybe) as GameSnapshot;
      }
    } catch {
      // ignore
    }
  }
  return GameSnapshotSchema.parse(next) as GameSnapshot;
}

