// Node-runnable tests for the settlement engine. Run: node tests/settlement.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { netBalances, minimize, residual, pairwiseFlows, presetSplit, chipPayouts, proportionalSplit, sidePots } from '../settlement.mjs';

// Apply payments to a copy of balances and assert everyone lands at 0.
function assertSettles(balances, payments) {
  const b = { ...balances };
  for (const p of payments) {
    b[p.from] = (b[p.from] ?? 0) + p.amount; // debtor pays: rises toward 0
    b[p.to] = (b[p.to] ?? 0) - p.amount;     // creditor receives: falls toward 0
  }
  for (const [name, value] of Object.entries(b)) {
    assert.equal(value, 0, `${name} not settled (residual ${value})`);
  }
}

test('Yahtzee example nets', () => {
  // 4 players, $50 buy-in, Person #3 wins the whole $200 pot.
  const lines = [
    { name: 'P1', contribution: 50, payout: 0 },
    { name: 'P2', contribution: 50, payout: 0 },
    { name: 'P3', contribution: 50, payout: 200 },
    { name: 'P4', contribution: 50, payout: 0 },
  ];
  const nets = netBalances(lines);
  assert.equal(nets.P3, 150);
  assert.equal(nets.P1, -50);
  assert.equal(nets.P2, -50);
  assert.equal(nets.P4, -50);
  assert.equal(residual(nets), 0);
});

test('multi-game balances accumulate and sum to zero', () => {
  const lines = [
    { name: 'P1', contribution: 30, payout: 90 }, // Game A: P1 wins $30 x3
    { name: 'P2', contribution: 30, payout: 0 },
    { name: 'P3', contribution: 30, payout: 0 },
    { name: 'P2', contribution: 20, payout: 40 }, // Game B: P2 wins $20 x2
    { name: 'P3', contribution: 20, payout: 0 },
  ];
  const nets = netBalances(lines);
  assert.equal(nets.P1, 60);
  assert.equal(nets.P2, -10);
  assert.equal(nets.P3, -50);
  assert.equal(residual(nets), 0);
});

test('worked settlement collapses to exactly 3 payments', () => {
  const balances = { Jared: 120, Ryan: 30, Bill: -90, Dugan: -60 };
  const payments = minimize(balances);
  assert.equal(payments.length, 3);
  assertSettles(balances, payments);
  assert.deepEqual(payments, [
    { from: 'Bill', to: 'Jared', amount: 90 },
    { from: 'Dugan', to: 'Jared', amount: 30 },
    { from: 'Dugan', to: 'Ryan', amount: 30 },
  ]);
});

test('split pot (two winners) settles cleanly', () => {
  const lines = [
    { name: 'P1', contribution: 25, payout: 50 },
    { name: 'P2', contribution: 25, payout: 50 },
    { name: 'P3', contribution: 25, payout: 0 },
    { name: 'P4', contribution: 25, payout: 0 },
  ];
  const nets = netBalances(lines);
  assert.equal(nets.P1, 25);
  assert.equal(nets.P2, 25);
  assert.equal(nets.P3, -25);
  assert.equal(nets.P4, -25);
  const payments = minimize(nets);
  assert.equal(payments.length, 2);
  assertSettles(nets, payments);
});

test('already settled yields no payments', () => {
  assert.deepEqual(minimize({ P1: 0, P2: 0, P3: 0 }), []);
});

test('empty input is safe', () => {
  assert.deepEqual(minimize({}), []);
  assert.equal(residual({}), 0);
});

test('pairwiseFlows: winner-takes-all attributes exact loser amounts', () => {
  const games = [[
    { name: 'P1', net: -50 },
    { name: 'P2', net: -50 },
    { name: 'P3', net: 150 },
    { name: 'P4', net: -50 },
  ]];
  const flows = pairwiseFlows(games);
  assert.equal(flows.length, 3);
  for (const f of flows) {
    assert.equal(f.to, 'P3');
    assert.equal(f.amount, 50);
  }
});

test('pairwiseFlows: split pot distributes losses pro-rata by winner nets', () => {
  // P1 +75, P2 +25; P3 -60, P4 -40. P1 takes 3/4 of each loss, P2 takes 1/4.
  const games = [[
    { name: 'P1', net: 75 },
    { name: 'P2', net: 25 },
    { name: 'P3', net: -60 },
    { name: 'P4', net: -40 },
  ]];
  const flows = pairwiseFlows(games);
  const get = (from, to) => flows.find((f) => f.from === from && f.to === to)?.amount;
  assert.equal(get('P3', 'P1'), 45);
  assert.equal(get('P3', 'P2'), 15);
  assert.equal(get('P4', 'P1'), 30);
  assert.equal(get('P4', 'P2'), 10);
  // total attributed equals total lost
  assert.equal(flows.reduce((s, f) => s + f.amount, 0), 100);
});

test('pairwiseFlows: opposing flows across games are netted', () => {
  const games = [
    [{ name: 'A', net: 100 }, { name: 'B', net: -100 }], // A wins 100 off B
    [{ name: 'A', net: -30 }, { name: 'B', net: 30 }],   // B wins 30 back
  ];
  const flows = pairwiseFlows(games);
  assert.deepEqual(flows, [{ from: 'B', to: 'A', amount: 70 }]);
});

test('pairwiseFlows: rounding remainder lands on the biggest winner and conserves the loss', () => {
  // Winners +7 and +3 (total 10); loser -10. 7/10 of 10 = 7, 3/10 = 3 exactly;
  // make it uneven: loser -11 can't happen in a balanced game, so use nets 7/4 vs -11.
  const games = [[
    { name: 'W1', net: 7 },
    { name: 'W2', net: 4 },
    { name: 'L', net: -11 },
  ]];
  const flows = pairwiseFlows(games);
  const total = flows.reduce((s, f) => s + f.amount, 0);
  assert.equal(total, 11);
  const w1 = flows.find((f) => f.to === 'W1').amount;
  const w2 = flows.find((f) => f.to === 'W2').amount;
  assert.equal(w2, Math.floor((11 * 4) / 11)); // floored share
  assert.equal(w1, 11 - w2);                   // biggest winner absorbs remainder
});

test('presetSplit: 70/20/10 of $200 and remainder-to-first', () => {
  assert.deepEqual(presetSplit(200, [70, 20, 10]), [140, 40, 20]);
  // $205: floors are 143/41/20 (sum 204), remainder $1 goes to 1st
  assert.deepEqual(presetSplit(205, [70, 20, 10]), [144, 41, 20]);
  // always sums to the pot
  for (const pot of [1, 99, 101, 333]) {
    for (const pcts of [[50, 50], [70, 30], [70, 20, 10], [40, 30, 20, 10]]) {
      assert.equal(presetSplit(pot, pcts).reduce((a, b) => a + b, 0), pot);
    }
  }
});

test('payment count never exceeds n - 1', () => {
  const balances = { A: 100, B: 50, C: 25, D: -60, E: -70, F: -45 };
  const payments = minimize(balances);
  assertSettles(balances, payments);
  assert.ok(payments.length <= Object.keys(balances).length - 1);
});

test('chipPayouts: whole-dollar rate converts exactly', () => {
  // $20 = 200 chips; 4 buy-ins = $80 = 800 chips
  const p = chipPayouts([{ id: 'a', chips: 350 }, { id: 'b', chips: 250 }, { id: 'c', chips: 200 }, { id: 'd', chips: 0 }], 20, 200);
  assert.deepEqual(p, { a: 35, b: 25, c: 20, d: 0 });
});

test('chipPayouts: cents round so payouts still sum to the pot', () => {
  // $20 = 200 chips ($0.10 each); 3 buy-ins = $60 = 600 chips
  const stacks = [{ id: 'a', chips: 347 }, { id: 'b', chips: 186 }, { id: 'c', chips: 67 }];
  const p = chipPayouts(stacks, 20, 200); // exact 34.7, 18.6, 6.7
  assert.equal(p.a + p.b + p.c, 60);
  assert.deepEqual(p, { a: 35, b: 18, c: 7 });
});

test('chipPayouts: every stack is within $1 of its exact value', () => {
  for (let trial = 0; trial < 300; trial++) {
    const dollars = 1 + Math.floor(Math.random() * 50), count = 1 + Math.floor(Math.random() * 500);
    const n = 2 + Math.floor(Math.random() * 8);
    // build a balanced table: whole buy-ins, chips redistributed randomly
    const totalChips = n * count;
    const cuts = Array.from({ length: n - 1 }, () => Math.floor(Math.random() * (totalChips + 1))).sort((a, b) => a - b);
    const chips = [...cuts, totalChips].map((c, i) => c - (i ? cuts[i - 1] : 0));
    const p = chipPayouts(chips.map((c, i) => ({ id: 'p' + i, chips: c })), dollars, count);
    const vals = Object.values(p);
    assert.equal(vals.reduce((a, b) => a + b, 0), n * dollars);
    chips.forEach((c, i) => assert.ok(Math.abs(p['p' + i] - (c * dollars) / count) < 1));
  }
});

test('proportionalSplit: chop by buy-in', () => {
  assert.deepEqual(proportionalSplit(100, [{ id: 'jared', w: 50 }, { id: 'bill', w: 20 }]), { jared: 71, bill: 29 });
  assert.deepEqual(proportionalSplit(90, [{ id: 'a', w: 30 }, { id: 'b', w: 30 }, { id: 'c', w: 30 }]), { a: 30, b: 30, c: 30 });
  assert.deepEqual(proportionalSplit(10, [{ id: 'a', w: 0 }, { id: 'b', w: 0 }]), { a: 5, b: 5 });
});

test('proportionalSplit: always sums to the pot, each share within $1 of exact', () => {
  for (let t = 0; t < 300; t++) {
    const pot = Math.floor(Math.random() * 1000);
    const ws = Array.from({ length: 1 + Math.floor(Math.random() * 6) }, (_, i) => ({ id: 'p' + i, w: 1 + Math.floor(Math.random() * 100) }));
    const out = proportionalSplit(pot, ws);
    const tot = ws.reduce((s, x) => s + x.w, 0);
    assert.equal(Object.values(out).reduce((a, b) => a + b, 0), pot);
    for (const x of ws) assert.ok(Math.abs(out[x.id] - (pot * x.w) / tot) < 1);
  }
});

test('sidePots: short stack wins only what he covered', () => {
  const e = [{ id: 'jared', c: 50 }, { id: 'ryan', c: 30 }, { id: 'bill', c: 20 }];
  const r = sidePots(e, ['bill', 'jared']);
  assert.deepEqual(r.payouts, { jared: 40, ryan: 0, bill: 60 }); // main $60 → Bill; side $20 → Jared; Jared's extra $20 back
  assert.equal(r.unresolved, 0);
  assert.deepEqual(r.pots.map((p) => [p.amount, p.winner, p.refund]), [[60, 'bill', false], [20, 'jared', false], [20, 'jared', true]]);
});

test('sidePots: partial ranking leaves later pots unresolved', () => {
  const e = [{ id: 'jared', c: 50 }, { id: 'ryan', c: 30 }, { id: 'bill', c: 20 }];
  const r = sidePots(e, ['bill']);
  assert.equal(r.unresolved, 1);
  assert.equal(r.payouts.bill, 60);
  assert.deepEqual(sidePots(e, ['jared']).payouts, { jared: 100, ryan: 0, bill: 0 }); // big stack wins all
});

test('sidePots: equal entries = winner takes all; random tables balance and respect the cap', () => {
  assert.deepEqual(sidePots([{ id: 'a', c: 20 }, { id: 'b', c: 20 }], ['b']).payouts, { a: 0, b: 40 });
  for (let t = 0; t < 300; t++) {
    const n = 2 + Math.floor(Math.random() * 6);
    const e = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, c: 1 + Math.floor(Math.random() * 10) * 5 }));
    const order = e.map((x) => x.id).sort(() => Math.random() - 0.5);
    const r = sidePots(e, order);
    assert.equal(r.unresolved, 0);
    assert.equal(Object.values(r.payouts).reduce((a, b) => a + b, 0), e.reduce((s, x) => s + x.c, 0));
    // nobody wins more from the table than everyone's stake capped at their own
    for (const x of e) assert.ok(r.payouts[x.id] <= e.reduce((s, y) => s + Math.min(y.c, x.c), 0) || r.pots.some((p) => p.refund && p.winner === x.id));
  }
});
