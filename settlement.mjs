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

// Head-to-head money flows across many games.
// games: array of games, each an array of { name, net } lines (net = payout - contribution).
// Within one game, each loser's loss is attributed to the winners pro-rata by the
// winners' net wins (winner-takes-all degenerates to exact loser→winner amounts;
// remainders from integer rounding land on the biggest winner). Flows are then
// aggregated across games and opposing directions netted, so each pair appears at
// most once: [{ from, to, amount }] with amount > 0, sorted largest first.
export function pairwiseFlows(games) {
  const net = {}; // "loser|winner" -> amount won by `winner` off `loser`
  for (const lines of games) {
    const winners = lines.filter((l) => l.net > 0)
      .sort((a, b) => b.net !== a.net ? b.net - a.net : (a.name < b.name ? -1 : 1));
    const losers = lines.filter((l) => l.net < 0);
    const totalWon = winners.reduce((s, w) => s + w.net, 0);
    if (!winners.length || !losers.length || totalWon <= 0) continue;
    for (const loser of losers) {
      const loss = -loser.net;
      // Floor every share but the biggest winner's; the biggest winner takes the
      // remainder so each loss is fully attributed.
      let assigned = 0;
      for (let i = winners.length - 1; i >= 0; i--) {
        const w = winners[i];
        const share = i === 0 ? loss - assigned : Math.floor((loss * w.net) / totalWon);
        assigned += share;
        if (share !== 0) {
          const key = loser.name + '|' + w.name;
          net[key] = (net[key] || 0) + share;
        }
      }
    }
  }
  // Net opposing directions (A won off B in one game, B off A in another).
  const flows = [];
  const seen = new Set();
  for (const key of Object.keys(net)) {
    const [from, to] = key.split('|');
    const pair = from < to ? from + '|' + to : to + '|' + from;
    if (seen.has(pair)) continue;
    seen.add(pair);
    const ab = net[from + '|' + to] || 0;      // `to` won this much off `from`
    const ba = net[to + '|' + from] || 0;      // `from` won this much off `to`
    const diff = ab - ba;
    if (diff > 0) flows.push({ from, to, amount: diff });
    else if (diff < 0) flows.push({ from: to, to: from, amount: -diff });
  }
  flows.sort((a, b) => b.amount !== a.amount ? b.amount - a.amount : (a.from < b.from ? -1 : 1));
  return flows;
}

// Split a pot by percentage places, whole dollars only.
// presetSplit(200, [70, 20, 10]) -> [140, 40, 20]. Each share is floored and the
// odd-dollar remainder goes to 1st place, so the shares always sum to the pot.
export function presetSplit(pot, pcts) {
  const shares = pcts.map((p) => Math.floor((pot * p) / 100));
  shares[0] += pot - shares.reduce((a, b) => a + b, 0);
  return shares;
}

// Cash-game chip counts -> whole-dollar payouts at a rate of `dollars` per
// `count` chips. stacks: [{ id, chips }]. Each exact value is floored and the
// leftover dollars go to the largest fractional remainders (ties: bigger stack),
// so the payouts sum to the exact total whenever that total is whole dollars.
export function chipPayouts(stacks, dollars, count) {
  const rows = stacks.map((s, i) => {
    const num = (s.chips || 0) * dollars;
    return { id: s.id, i, chips: s.chips || 0, base: Math.floor(num / count), rem: num % count };
  });
  const totalNum = rows.reduce((t, r) => t + r.chips, 0) * dollars;
  let left = Math.round(totalNum / count) - rows.reduce((t, r) => t + r.base, 0);
  const order = [...rows].sort((a, b) => (b.rem - a.rem) || (b.chips - a.chips) || (a.i - b.i));
  for (const r of order) { if (left <= 0) break; if (r.rem > 0) { r.base += 1; left -= 1; } }
  const out = {};
  for (const r of rows) out[r.id] = r.base;
  return out;
}

// Chop a pot among winners in proportion to weights (e.g. what each winner put
// in). weights: [{ id, w }]. Whole dollars; remainders go to the largest
// fractions, so the shares always sum to the pot. All-zero weights split evenly.
export function proportionalSplit(pot, weights) {
  const total = weights.reduce((s, x) => s + Math.max(0, x.w || 0), 0);
  const ws = total > 0 ? weights.map((x) => ({ id: x.id, chips: Math.max(0, x.w || 0) })) : weights.map((x) => ({ id: x.id, chips: 1 }));
  return chipPayouts(ws, pot, total > 0 ? total : weights.length);
}

// Poker side pots (all-in rule): a player can win from each opponent at most
// what they themselves put in. entries: [{ id, c }] total put in per player;
// order: player ids best finisher first (may be partial). Each layer of the pot
// goes to the best-ranked player who covered it; a layer only one player
// covered is returned to them. Layers with no ranked eligible player stay
// unawarded and are counted in `unresolved`.
export function sidePots(entries, order) {
  const rank = new Map(order.map((id, i) => [id, i]));
  const levels = [...new Set(entries.map((e) => e.c).filter((c) => c > 0))].sort((a, b) => a - b);
  const payouts = Object.fromEntries(entries.map((e) => [e.id, 0]));
  const pots = [];
  let prev = 0, unresolved = 0;
  for (const L of levels) {
    const eligible = entries.filter((e) => e.c >= L).map((e) => e.id);
    const amount = (L - prev) * eligible.length;
    prev = L;
    let winner = null, refund = false;
    if (eligible.length === 1) { winner = eligible[0]; refund = true; }
    else {
      const ranked = eligible.filter((id) => rank.has(id)).sort((a, b) => rank.get(a) - rank.get(b));
      winner = ranked.length ? ranked[0] : null;
    }
    if (winner == null) unresolved++; else payouts[winner] += amount;
    const last = pots[pots.length - 1];
    if (last && last.winner === winner && last.refund === refund && winner != null) last.amount += amount;
    else pots.push({ amount, eligible, winner, refund });
  }
  return { payouts, pots, unresolved };
}
