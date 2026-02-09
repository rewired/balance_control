export function createInitialState(config) {
    const now = Date.now();
    return {
        sessionId: config.sessionId,
        revision: 0,
        createdAt: now,
        updatedAt: now,
        config: { mode: 'hotseat', enabledExpansions: config.enabledExpansions ?? [] },
        state: { extensions: {} },
        log: [],
    };
}
export function applyAction(current, action) {
    // Only accept a trivial action at this stage; unknown actions are rejected.
    if (action.type !== 'core.noop' && action.type !== 'core.ping') {
        return { ok: false, error: { code: 'UNKNOWN_ACTION', message: `Unknown action type: ${action.type}` } };
    }
    const at = Date.now();
    const entry = { id: action.actionId, at, kind: action.type, message: 'No-op applied' };
    const next = {
        ...current,
        revision: current.revision + 1,
        updatedAt: at,
        log: [...current.log, entry],
    };
    return { ok: true, next, events: [entry] };
}
//# sourceMappingURL=engine.js.map