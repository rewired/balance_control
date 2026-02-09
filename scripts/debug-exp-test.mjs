import { createEngine } from "../packages/core/dist/index.js";
import { economyExpansion } from "../packages/exp-economy/dist/index.js";
import { testMeasuresExpansion } from "../packages/exp-test-measures/dist/index.js";

const engine = createEngine({ expansions: [economyExpansion, testMeasuresExpansion] });
let s = engine.createInitialSnapshot({ sessionId: 's', mode: 'hotseat', enabledExpansions: ['economy','test'], seed: 'seed-ct', players: [{id:'p1'},{id:'p2'},{id:'p3'}] });
console.log('faceUp', (s.state.extensions.test.measures.faceUp));
const tid1 = s.state.hands['p1'][0].id;
let r = engine.applyAction(s, { sessionId: 's', actionId: 'p1pl1', type: 'core.placeTile', payload: { coord: { q: 0, r: 0 }, tileId: tid1 }, actorId: 'p1' });
console.log('place ok?', r.ok);
if(!r.ok) { console.log('place err', r.error); process.exit(0);} s = r.next;
r = engine.applyAction(s, { sessionId: 's', actionId: 't1', type: 'exp.test.measure.take', payload: { index: 0 }, actorId: 'p1' });
console.log('take ok?', r.ok);
if(!r.ok) console.log('take err', r.error);

