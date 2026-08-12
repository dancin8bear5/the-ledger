// The Ledger — settlement engine.
//
// Pure functions, no dependencies. This is the single source of truth for the
// who-owes-whom math; it is imported by the Node tests and inlined into
// index.html at build time. All money is whole-dollar integers.

// Net balance per player across a set of game lines.
// lines: [{ name, contribution, payout }]
// Returns { [name]: net } where net = sum(payout - contribution).
// Positive = the player is owed money; negative = the player owes.
export function netBalances(lines) {
  const balances = {};
  for (const l of lines) {
    balances[l.name] = (balances[l.name] ?? 0) + (l.payout - l.contribution);
  }
  return balances;
}

// Minimize the number of payments that settle everyone.
// Greedy max-creditor / max-debtor: repeatedly match the person owed the most
// with the person who owes the most, settling the smaller amount each time.
// Produces at most (n - 1) payments. Deterministic (ties broken by name).
// Returns [{ from, to, amount }] (from pays to).
export function minimize(balances) {
  const cmp = (a, b) =>
    a.amount !== b.amount ? b.amount - a.amount : a.name < b.name ? -1 : 1;

  const creditors = Object.entries(balances)
    .filter(([, v]) => v > 0)
    .map(([name, amount]) => ({ name, amount }))
    .sort(cmp);
  const debtors = Object.entries(balances)
    .filter(([, v]) => v < 0)
    .map(([name, amount]) => ({ name, amount: -amount }))
    .sort(cmp);

  const payments = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const pay = Math.min(creditors[ci].amount, debtors[di].amount);
    if (pay > 0) {
      payments.push({ from: debtors[di].name, to: creditors[ci].name, amount: pay });
    }
    creditors[ci].amount -= pay;
    debtors[di].amount -= pay;
    if (creditors[ci].amount === 0) ci++;
    if (debtors[di].amount === 0) di++;
  }
  return payments;
}

// Sum of all balances. 0 for a well-formed trip; nonzero means some game's pot
// was entered unbalanced.
export function residual(balances) {
  return Object.values(balances).reduce((a, b) => a + b, 0);
}
