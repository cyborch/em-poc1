# Price Formation Explorer

An interactive product prototype for Electricity Maps: start from a day-ahead electricity price, explore the fundamentals around it, compare with normal, and form your own hypothesis about why the price is what it is.

All data is **synthetic and illustrative**.

- [PRODUCT_DECISIONS.md](PRODUCT_DECISIONS.md): users, decisions, information hierarchy, what was left out and why
- [DEMO.md](DEMO.md): 3-minute walkthrough and what to validate with real traders
- [DATA_ASSUMPTIONS.md](DATA_ASSUMPTIONS.md): how the synthetic data is built and what it can and cannot show

## Run it

```bash
npm install
npm run dev        # http://localhost:5173, best at 1440 px wide
npm run typecheck  # strict TypeScript
npm test           # data, analysis and UI tests
npm run build      # typecheck + production build
```

`.npmrc` sets `legacy-peer-deps=true`: some current testing-library/vitest peer ranges do not resolve cleanly together.

## Stack

React 19, TypeScript (strict), Vite, Tailwind CSS v4, Recharts, Lucide icons. No backend.

## Structure

| Path | Role |
| --- | --- |
| `src/data/types.ts` | Dataset interfaces |
| `src/data/markets.ts`, `generate.ts` | Designed inputs and deterministic synthetic generator |
| `src/analysis/` | Pure functions: comparisons, observations, flags, hypothesis, chart series |
| `src/components/` | Charts and the investigation panel |
| `src/App.tsx` | Shared state: market, selected hour, comparison basis, focused signal |

## Interaction cheat sheet

- Click a price bar (or a flagged-period chip) to select an hour. Every view follows.
- Hover any chart to see the same hour in all of them. ← → steps through hours.
- Click an observation, or a chart title, to drill into that signal.
- Compare with: previous hour, same hour yesterday, typical for this hour.
