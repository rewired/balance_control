import type { ActionEnvelope, GameConfig, GameSnapshot } from './protocol';
export declare function createInitialState(config: GameConfig & {
    sessionId: string;
}): GameSnapshot;
export type ApplyResult = {
    ok: true;
    next: GameSnapshot;
    events: Array<{
        id: string;
        at: number;
        kind: string;
        message: string;
    }>;
} | {
    ok: false;
    error: {
        code: 'UNKNOWN_ACTION' | 'VALIDATION_ERROR';
        message: string;
    };
};
export declare function applyAction(current: GameSnapshot, action: ActionEnvelope): ApplyResult;
