// Node-runnable tests for the settlement engine. Run: node tests/settlement.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { netBalances, minimize, residual } from '../settlement.mjs';

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

test('payment count never exceeds n - 1', () => {
  const balances = { A: 100, B: 50, C: 25, D: -60, E: -70, F: -45 };
  const payments = minimize(balances);
  assertSettles(balances, payments);
  assert.ok(payments.length <= Object.keys(balances).length - 1);
});
