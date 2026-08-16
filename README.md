# The Ledger 🐻🏈

A dead-simple, **Chicago Bears–themed** web app for tracking money won and lost across
many games on a group trip (Yahtzee, poker, "screw your neighbor," whatever), then
settling everything up at the end in the **fewest possible payments**. Navy and orange
everywhere — Bear Down.

Trip names are **unique** (case-insensitive): creating "lake weekend" when "Lake Weekend"
exists shows a *Trip already exists* error.

Inside a trip, the top bar holds **＋** (add a game) to the left of **Share**, and a red
**✕ Delete Trip** button that permanently deletes the trip — games, tallies, everything,
for everyone — after a confirmation.

- **One shared link, live on every device.** Open the link on any phone or laptop and you
  see the same trip update in real time. Anyone can log a game.
- **Winner-takes-all by default**, with a "split the pot" override for multi-winner games.
- **Live tally** of who's up and who's down, and a **Settle Up** screen that collapses all
  the back-and-forth into the minimum number of payments.

Live app: enable GitHub Pages (see below) — it will be at
`https://dancin8bear5.github.io/the-ledger/`.

## How to use it

1. Open the app. Create a trip — give it a name and (optionally) add the people on it.
   Your past trips are listed on the home screen to reopen with one tap.
2. **Players** tab — add or remove people any time.
3. **Games** tab — tap **＋** to log a game: pick the game from the dropdown (or choose
   **Other…** to type a custom name — custom names are saved for next time), then pick who
   played (or add someone on the spot). **Each player's row carries their buy-in** as a
   **slider**: drag normally for **$5 steps**, drag slowly for **$1 precision**, or type
   any exact amount in the field. Newly selected players default to the last-used amount,
   so one edit usually covers everyone.
   A **rebuy** is just raising that player's total (busted at $50, bought back in → set
   them to $100); the pot updates live. Then tap the winner (takes the whole pot), or flip
   **"Split the pot / edit amounts"** for multiple winners (a live check makes payouts
   equal the pot). **Don't know the result yet?** Just **Save** — the game stays
   **in progress** and is left out of Tally/Settle Up until you open it later and set the
   winner.
4. **Tally** tab — the running scoreboard (green = owed money, red = owes).
5. **Settle Up** tab — the final who-pays-whom list, minimized.
6. **Share** button — copies the trip link. Send it to the group; everyone joins the same
   live trip.
7. **Cash / expenses** (button on the Games tab) — money outside of games:
   - *Cash handoff*: someone hands someone cash mid-trip (a loan or early payment). The
     payer is owed it back at settlement.
   - *Shared expense*: someone fronts a bill (pizza, gas) split evenly among whoever you
     pick; odd dollars are eaten by the payer.
   Both flow into the Tally and Settle Up, but are **excluded from gambling stats**.
8. **Statements** (Settle Up tab) — 📋 copy the settlement for the group chat, expand any
   player's personal statement (every game, adjustments, total, who they pay) and copy it,
   or ⬇️ download the full journal as CSV.
9. **History** (button on the home screen) — across every trip, finished games only:
   - **Leaderboard** — W–L record, win %, biggest single win, lifetime net (🥇🥈🥉).
   - **Head-to-head** — who owns whom: losses attributed to winners pro-rata per game,
     netted all-time ("Jared over Dugan · $340").
   - **Records** — biggest pot, biggest single win, longest win streak, largest stake.
   - **Player profiles** — each person's best & worst games; tap to expand the full
     per-game breakdown.
   - Plus totals **by trip** (tap to open), by year, and by game.
10. **Payout presets** (game editor, split mode) — one-tap **70/30**, **70/20/10**,
    **50/50 chop**, or **Custom %**: tap players in finishing order and the pot divides
    itself (odd dollars to 1st).

On the winner screen, every player shows their **live net** (winner's gain, everyone
else's loss) so you can see the outcome as you add rebuys, before saving.

## How it works

- **Frontend:** a single static `index.html` (built from `index.template.html`). No build
  toolchain, no framework — plain HTML/CSS/JS. The Supabase client is loaded from a CDN.
- **Backend:** a [Supabase](https://supabase.com) project — Postgres tables
  (`trips`, `players`, `games`, `game_lines`) plus **Realtime** for live sync. See
  `supabase/migrations/0001_init.sql`.
- **Settlement math:** `settlement.mjs` — a pure, dependency-free module
  (`netBalances` + a greedy `minimize` that yields at most *n − 1* payments). It's the
  single source of truth: `build.mjs` inlines it into `index.html`, and the Node tests
  import it directly.

## Develop

```bash
node tests/settlement.test.mjs   # run the settlement engine tests
node build.mjs                   # regenerate index.html from the template + engine
```

`index.html` is a generated file — edit `index.template.html` or `settlement.mjs`, then
re-run `node build.mjs`.

## Hosting (GitHub Pages)

This repo is public so free GitHub Pages works. One-time setup:

1. GitHub → this repo → **Settings → Pages**.
2. **Source:** *Deploy from a branch*. **Branch:** `main`, folder `/ (root)`. **Save.**
3. After a minute the site is live at `https://dancin8bear5.github.io/the-ledger/`.

`.nojekyll` is included so Pages serves the files as-is.

Tapping outside an entry sheet never silently discards your work — if you've entered
anything, the app asks before closing.

## Notes & tradeoffs

- **Needs internet.** Live sync means the app talks to Supabase; it does not work fully
  offline.
- **Access is link-based.** Anyone with a trip's link can view and edit that trip. The
  embedded Supabase key is the **anon** (public) key — safe to expose by design; it only
  grants what the database's row-level-security policies allow. This is appropriate for a
  low-stakes private tool. To harden later, add Supabase Auth and a per-trip membership
  table and tighten the RLS policies.
- **Money is whole dollars.**
