# Product decisions

Price Formation Explorer is a prototype for one question traders ask every day:

> "Why is electricity expected to cost €145/MWh in Germany tomorrow at 18:00?"

It is a product and UX exercise. All data is synthetic and labelled as illustrative in the header, in the footer and in every chart legend that uses a reference.

## 1. Who is the primary user?

A **short-term power trader or analyst** at an energy company (day-ahead / intraday desk, DE, DK1 and FR in this prototype). They are an expert in the market and not in our product. They already look at a price forecast. They have minutes, not hours, between a price move and a decision, and they distrust anything that sounds more certain than it is.

Secondary users (not designed for): quants who want raw data, and non-experts who want a plain-language explanation.

## 2. What decision are they trying to make?

"Do I trust this price, and should I act on it or against it?" Concretely: take a position on a delivery hour, adjust a bid, or decide what to monitor before gate closure. A price on its own does not support that decision, because the trader needs to judge whether the conditions behind it are plausible, fragile, or about to change.

## 3. What information do they need?

In order of priority:

1. **The price and whether it is unusual.** Compared with nearby hours, with yesterday, and with what is typical for that hour.
2. **Which fundamentals look unusual at the same hour.** Solar, wind, demand, net load, cross-border headroom, and how hard dispatchable plants are working.
3. **How far to trust those fundamentals.** Forecast versus actual, forecast uncertainty (P10–P90), and which parts are already observed versus still forecast.
4. **Where to look next.** A lead they can follow outside the tool (outage notices, forecast revisions, fuel prices).

## 4. What is the minimum useful interaction?

**Click a price, see the same hour everywhere.**

One selected hour drives every view (price chart, four fundamentals charts, a supply-mix chart and a forecast-deviation chart, investigation panel, headline question). Everything else supports that loop:

- Hover shows the same hour in all charts, so relationships can be read by eye.
- ← → step through hours, across the date boundary.
- A comparison basis (previous hour / same hour yesterday / typical) changes the reference drawn on every chart and the deltas in the panel.
- Flagged periods (spikes, negative prices) are one click away, so the user does not have to find them.

### Information hierarchy (progressive disclosure)

| Level | Question | Where | What is shown |
| --- | --- | --- | --- |
| 1 | What happened? | Headline question, price chart, panel header | Price, verdict ("well above typical", +1.7σ), rank in the day, change vs neighbouring hours |
| 2 | What might explain it? | Fundamentals charts, "What might explain it" | The few signals that are unusual for this hour, with direction hints, plus a hedged hypothesis |
| 3 | Investigate the details | "Investigate the details", forecast-vs-reality chart | Comparison with previous hour / yesterday / typical, forecast ranges and misses, net-load composition, interconnector capacity, correlations |

Nothing at level 3 is visible until the user asks for it by clicking an observation or a chart title.

## 5. What is deliberately excluded

- **Attribution models** ("solar contributed +€30/MWh"). We have no defensible model, and a plausible-looking number would be worse than none.
- **A backend, real data, or real market integrations.** The task is a product prototype; data realism only has to be good enough for the interactions to be meaningful.
- **A price forecast or its uncertainty.** The prototype starts from a price that already exists.
- **Intraday and balancing prices, 15-minute resolution.** Hourly day-ahead only. A production tool must handle 15-minute products.
- **Per-border flows, per-plant availability, fuel and carbon prices, hydro and storage.** All plausible next leads, all out of scope. The panel names them as "where to look next" instead of pretending to cover them.
- **Alerts, saved views, collaboration, export.**
- **Mobile layout.** Designed for a 1440 px desktop.
- **Accessibility beyond the basics** (keyboard stepping, button semantics, aria labels). Charts are not screen-reader friendly yet.

## Claims the product makes, and the ones it refuses to make

The panel keeps four kinds of statements visibly apart:

| Kind | Example in the product | How it is marked |
| --- | --- | --- |
| **Observed** | "Wind came in 8.1 GW below its forecast" | Tag `OBSERVED`, solid lines |
| **Forecast** | "Net load is forecast at 60.3 GW" | Tag `FORECAST`, dashed lines, shaded "Forecast only" region. Actual values are never drawn for future hours |
| **Correlation** | "Price vs net load r = +0.97 across these 48 hours (Germany)" | Under "Co-movement (correlation)", with a note that it is not an explanation |
| **Hypothesis** | "€145/MWh may be elevated because these conditions coincide…" | Dashed box labelled *Hypothesis · not verified*, only shown when several fundamentals agree |
| **Verified causal explanation** | — | **Deliberately not offered.** The panel says so |

The up/down arrows next to observations mean "conditions like this are usually associated with higher/lower prices". They are a heuristic for ordering attention, not a claim that this signal caused this price. Observation wording is neutral ("Wind is forecast at 7.8 GW, 54% below typical for 18:00"), never causal ("wind pushed the price up").

## Key design tradeoffs

- **Questions as chart titles.** Each chart is titled with the question it answers ("Is there room to import or export more?"), and shows the selected hour's value and its deviation from the chosen reference. If a chart does not answer a question a trader would ask, it does not exist. There is deliberately no KPI grid; the supply-mix chart exists to show total generation against demand and how much is covered by conventional plants and imports.
- **Typical, with a band, as the default reference.** "Unusual" only means something relative to normal. A 2 GW solar reading is normal at dusk and extreme at noon, so every signal is scored against a typical value for that hour of day (±1σ) and the verdict is shown as a level, not a rank across all signals.
- **Surface 4–5 leads, hide the rest.** The panel ranks signals by how unusual they are (and a few special cases: steep solar ramp-downs, net load rank in the day, interconnector utilisation, forecast misses outside P10–P90). Everything else sits behind "Other signals checked".
- **Forecast hours look different.** For hours that have not happened, the chart only draws forecasts and a P10–P90 band, and the deviation chart says "No actuals yet" instead of showing an empty line.
- **Flags instead of alerts.** Spikes (≥1.25σ above typical and >120% of typical) and negative prices are computed from the data and shown as chips. Clicking a chip selects the peak hour.
- **Prices cleared before actuals existed.** The day-ahead price is formed from forecasts. The prototype keeps that distinction: a wind miss on 17 Mar morning is shown as an observed deviation with the note "The day-ahead price was cleared before this deviation was known".
- **Shared state, no router.** One `selectedIndex`, one market, one basis, one focus signal, all in `App`. No state library, no URL sync (a first production step).

## Why these scenarios

The synthetic data contains five designed situations so every part of the interface has something to show. They are designed scenarios, not empirical findings.

| # | Scenario | Where | What to look at |
| --- | --- | --- | --- |
| 1 | Evening spike: high net load and limited import flexibility | Germany, Wed 18 Mar 18:00, €145/MWh | Solar ramps down, wind is low, net load is the day's highest, import capacity is reduced and fully used |
| 2 | Midday negative prices | Germany, Wed 18 Mar 11:00–13:00 | High solar and wind, low net load, export capacity fully used, curtailment |
| 3 | Wind forecast error | Germany, Tue 17 Mar 06:00–10:00 (observed) | Wind about 8 GW below forecast, outside P10–P90 |
| 4 | Unusually high demand | France, Wed 18 Mar 06:00–10:00 | Cold-snap demand about 11% above typical, regional price lift |
| 5 | Interconnector constraint | Denmark DK1, Tue 17 Mar 13:00–20:00 | Export capacity cut; DK1 prices decouple and go negative |

## What I would change first with more time

1. Replace the typical value with a proper climatology (same weekday type, season, similar weather regime).
2. Show forecast revisions (what did the forecast say 6 h ago?). That is often the real story.
3. Let the user pin two hours and compare them side by side.
4. Link the investigation to the neighbour's price, since the interconnector story is only half-told without it.
