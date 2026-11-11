# Data assumptions

Everything in the app is **synthetic and illustrative**. None of it is, or is derived from, real market data. It is generated deterministically in [src/data/generate.ts](src/data/generate.ts) from the designed inputs in [src/data/markets.ts](src/data/markets.ts). Presentation components only read the generated dataset; they never produce data.

## Time

- Timezone **Europe/Berlin (CET, UTC+1)** for all three markets. Timestamps are ISO 8601 strings with a fixed `+01:00` offset.
- Fixed dates: **Tue 17 Mar 2026** ("today") and **Wed 18 Mar 2026** ("tomorrow"), 24 hourly steps each (48 h per market).
- A third day, **Mon 16 Mar 2026**, exists only as lookback, so "previous hour" and "same hour yesterday" work for 17 Mar 00:00. It is not selectable.
- Daylight saving time in Europe starts on 29 Mar 2026, so there is no ambiguous or missing hour in the dataset.
- The generator uses no `Math.random`, no `Date`, and no system timezone. The same data is produced on every machine on any day. A unit test checks this.
- **As-of time: 17 Mar 2026, 13:00 CET.** Actuals exist for every hour before that. Day-ahead prices for both days are treated as already cleared (the 18 Mar auction results are published around 12:45).

## Units and sign conventions

- Power in MW (shown as MW or GW), prices in EUR/MWh.
- Net imports: positive = importing, negative = exporting.
- Available import/export capacity are positive MW. Export capacity is drawn below zero on the flow chart.
- Hours are delivery hours: "18:00" is 18:00–19:00 local time.

## Quantities per hour

| Field | Meaning |
| --- | --- |
| `price.dayAhead` | Cleared day-ahead price (computed from forecasts, see below) |
| `solar`, `wind`, `demand` | Forecast, actual (if observed), P10–P90 forecast range, typical mean and σ for that hour |
| `conventional`, `netImports` | Day-ahead schedule, actual residual (if observed), typical |
| `capacity` | Available and typical import/export capacity |
| `curtailed` | Renewable output curtailed to keep the system balanced (already deducted from solar/wind) |

"Typical" is the model's own result for a normal day (average cloudiness, average wind, normal capacities, regular neighbour prices), not a statistic computed from history. The σ values are rough assumptions: price 0.16 × typical + €7, solar 0.3 × typical + 2% of peak, wind 55% of mean, demand 4.5%, net imports 20% of import capacity, conventional 10% of its maximum.

## The model

1. **Inputs.** Demand is a typical weekday profile with a small smooth deterministic noise. Solar is a clear-sky curve (market-specific sunrise and day length) times a clearness index. Wind is a smooth curve interpolated between hand-set control points every 3 hours. Cross-border capacity starts at a market-specific value. Scenarios are applied as time windows that multiply or shift these inputs (the `effects` in `markets.ts`).
2. **Neighbour price.** A typical hourly price profile for the coupled neighbouring markets, scaled by this zone's net-load anomaly (weather is regionally correlated), plus scenario shifts.
3. **Clearing.** For each hour, the zone trades until its marginal dispatchable plant costs the same as the neighbour price, or until the interconnector is full:
   - dispatchable plants follow a piecewise-linear supply curve per market,
   - if import capacity binds, the local price rises above the neighbour price,
   - if export capacity binds, it falls below,
   - if output would drop below the must-run floor, wind and then solar are curtailed and the price turns negative in proportion to the surplus.
4. **Balance.** `demand = solar + wind + conventional + net imports` holds for every hour, in both the forecast and the actual series (a test checks this to within rounding).
5. **Actuals.** Only for hours before the as-of time. Solar, demand and wind deviate slightly from the forecast with deterministic noise, net imports deviate a little, and conventional generation absorbs the residual. The one scenario with a large miss is the wind forecast error below.
6. **Price.** Cleared from the *forecast* inputs, as a day-ahead market would be. Actual deviations therefore do not change the displayed price.

## Designed scenarios

These are designed, not empirically established, and not a statement about how the real market works.

| # | Scenario | Market, time | Mechanism in the model |
| --- | --- | --- | --- |
| 1 | Evening price spike | DE, 18 Mar 18:00, **€145/MWh** | Solar ramps down at sunset, wind drops from ~30 GW at midday to ~8 GW, demand peaks, planned grid maintenance cuts import capacity to ~74% in the evening, so imports saturate and the local price separates upwards |
| 2 | Midday negative prices | DE, 18 Mar 11:00–13:00 (min about −€12) | Peak solar plus strong wind and low neighbour prices push net load below zero; exports hit their cap, so conventional output sits at its floor and renewables are curtailed |
| 3 | Wind forecast error | DE, 17 Mar 06:00–10:00 (observed) | Wind actual about 58% of forecast, below P10 |
| 4 | Unusually high demand | FR, 18 Mar 06:00–10:00 | Demand +11% (cold snap), with a matching lift in neighbouring prices |
| 5 | Interconnector constraint | DK1, 17 Mar 13:00–20:00 | Export capacity cut to 35% (outage). Windy afternoon, so DK1 exports are capped and the price falls below neighbours (negative 13:00–15:00) |

The default hour was calibrated so that the Germany 18 Mar 18:00 price is exactly €145.0 (the maintenance depth in `markets.ts` is set accordingly). A test locks this in.

## Known simplifications

- One representative neighbour price per market, not real borders.
- No storage, hydro, demand response, ramping or start-up constraints, fuel or carbon price dynamics.
- Net imports of the future are a schedule, not a physical flow.
- Forecast ranges (P10–P90) are simple proportional bands, not derived from an ensemble.
- Correlations in the panel are computed over only 48 hours of designed data, so they are illustrative.
- Prices are hourly. Real day-ahead markets in Europe now clear in 15-minute products.
