# The Ledger

A dead-simple web app for tracking money won and lost across many games on a group trip
(Yahtzee, poker, "screw your neighbor," whatever), then settling everything up at the end
in the **fewest possible payments**.

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
   **Other…** to type a custom name — custom names are saved for next time), set the
   buy-in for that game (it defaults to the last game's, since money is per-game), pick who
   played (or add someone on the spot). Each player has a **−/+ buy-in** control for
   **rebuys** (e.g. someone busts and buys back in — tap **+** to add another buy-in; the
   pot updates). Then tap the winner (takes the whole pot), or flip **"Split the pot / edit
   amounts"** for multiple winners (a live check makes payouts equal the pot).
   **Don't know the result yet?** Just **Save** — the game stays **in progress** and is
   left out of Tally/Settle Up until you open it later and set the winner.
4. **Tally** tab — the running scoreboard (green = owed money, red = owes).
5. **Settle Up** tab — the final who-pays-whom list, minimized.
6. **Share** button — copies the trip link. Send it to the group; everyone joins the same
   live trip.
7. **History** (button on the home screen) — totals across every trip: money that changed
   hands all-time, **by trip** (tap to open it), by year, by game, and by person.

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

## Notes & tradeoffs

- **Needs internet.** Live sync means the app talks to Supabase; it does not work fully
  offline.
- **Access is link-based.** Anyone with a trip's link can view and edit that trip. The
  embedded Supabase key is the **anon** (public) key — safe to expose by design; it only
  grants what the database's row-level-security policies allow. This is appropriate for a
  low-stakes private tool. To harden later, add Supabase Auth and a per-trip membership
  table and tighten the RLS policies.
- **Money is whole dollars.**
