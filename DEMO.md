# Demo: a 3-minute walkthrough

**Setup:** `npm install && npm run dev`, open the app on a 1440 px wide window. It opens on Germany, Wed 18 Mar 2026 (tomorrow), 18:00. Mention once, at the start, that all data is synthetic (there is a badge in the header).

**The story:** a trader sees a €145/MWh forecast for tomorrow evening and needs to decide whether to believe it. The tool does not tell them why. It gets them to the data that lets them judge for themselves in seconds.

## Walkthrough

### 0:00 — 1. Open the Germany price chart

"This is the day-ahead price for Germany tomorrow. The headline already asks the question: *Why is electricity expected to cost €145/MWh in Germany tomorrow at 18:00?* The dotted line and grey band are what is typical for each hour, so I can read the shape of the day against normal."

### 0:20 — 2. Identify the evening price spike

"Two things are flagged for me automatically: negative prices around midday, and a spike at 18:00. The spike bar is orange because it is more than 1.25σ above typical for that hour. I did not have to scan 24 bars for it."

### 0:35 — 3. Click the spike

Click the 18:00 bar (or the "Price spike 18:00" chip).

"One click and *everything* moves to 18:00: the price chart, all the fundamentals charts, and the panel on the right. That shared hour is the core of the product."

Point at the panel header: **€145, well above typical, +1.7σ, the highest hour of the day, +€47 on 17:00**. "This answers *what happened* in two seconds, and the mini-strip shows the neighbouring hours."

### 0:55 — 4. Explore solar, wind and demand

Hover along the charts to show the shared crosshair, then step with ← →.

- **Solar:** "Solar is 0.8 GW, 98% below this day's midday peak of 42 GW. The sun is going down."
- **Wind:** "Wind is 7.8 GW, 54% below what is typical at this hour. Look at the wind chart: it was windy at midday and has dropped off since."
- **Demand and net load:** "Demand is close to its daily peak, but the more interesting line is net load, demand minus wind and solar. At 18:00 it is the highest of the day, 60 GW. At midday it was below zero, which is why prices were negative then."

"The panel says these are *observations and leads*. The orange arrows mean 'conditions like this are usually associated with higher prices'. It does not say they caused anything."

### 1:30 — 5. Compare the hour with typical conditions

"A value only means something against normal." Switch **Compare with** between *Previous hour*, *Same hour yesterday* and *Typical for this hour*, and watch the reference on every chart change. Then click **Wind** in the panel.

"Wind is 31% below yesterday's same hour, and 54% below typical. Solar is *not* unusual for dusk, but it fell by 22 GW in three hours. The same number can be normal or alarming depending on the reference."

### 2:00 — 6. Investigate a potential transmission constraint

Click the **Net imports** observation (or the chart title "Is there room to import or export more?").

"Germany is importing 8.1 GW, which is 100% of the import capacity available at this hour. Typical available capacity is 11 GW, so something has reduced it. The bars turn orange when capacity is nearly used up. If the interconnector is full, extra imports cannot cap the price."

Show the **Where to look next** note: "The tool tells me to go and check border-level capacity and outage notices. It does not pretend to know."

Optionally open the **Hypothesis** box: "When several fundamentals agree, it offers a hedged reading, clearly marked *not verified*, and how to test it."

### 2:30 — 7. Return to the overview with a clearer picture

Click the 12:00 negative-price chip. "The same tool explains the other extreme: solar and wind are high, net load is negative, and exports are full."

Return to 18:00. "My working hypothesis: the evening is expensive because solar disappears, wind is low, and imports are maxed out, with plants running at 84% of capacity. I know what to verify next, and I got there without leaving the screen."

## Optional detours (if there is time)

| Detour | What to click | What it shows |
| --- | --- | --- |
| Forecast vs reality | Tue 17 Mar, press ← ten times to reach 08:00, click the wind lead | Wind came in ~8 GW below forecast, outside P10–P90. Past hours show observed values; future hours show forecasts only |
| Interconnector decoupling | Market: Denmark DK1, Tue 17 Mar, 14:00 | Export capacity is cut from 6.2 to 2.2 GW, so DK1 prices go negative while Germany does not |
| Demand shock | Market: France, Wed 18 Mar, 08:00 | Cold-snap demand about 11% above typical, price spike in the morning |

## Why these interactions matter to a trader

- **Speed to the right question.** Traders do not need to be told the answer, they need to know where to dig. Flags, ranked leads and a shared hour cut the time to the first useful question.
- **Context built in.** "Unusual" is always relative to this hour's normal, yesterday, or the previous hour, so a trader can calibrate without opening another tool.
- **Honest about certainty.** Observed vs forecast, correlation vs hypothesis, and "no verified causal explanation" are all visible. A tool that overclaims gets ignored after the first miss.
- **Keeps the trader in control.** The tool surfaces evidence and the next place to look. The judgment stays with the user.

## What I would validate with real traders before building for production

1. **Is the primary question right?** Do traders ask "why is this price high?" in practice, or is the real question "will it still be this high at gate closure?" This changes whether forecast revisions matter more than explanations.
2. **Which fundamentals do they actually look at first?** Is it net load, residual load, cross-border flows, fuel prices, outages, or reservoir levels? The set here is plausible but unvalidated.
3. **What counts as "unusual"?** σ against a typical value is a simple definition. Do traders prefer percentiles, the same weekday, similar weather days, or a market-specific yardstick?
4. **Do ranked leads help or distract?** Is surfacing 4–5 leads right, or do experts want everything visible and sort it themselves?
5. **How much do they trust a hypothesis box?** Does a hedged reading help, or does it risk anchoring? Would they prefer a "similar past hours" view with outcomes instead?
6. **Granularity and timing.** Do they work in hourly or 15-minute products? What time before gate closure do they need this, and on which screen (desk monitor, second screen, mobile alert)?
7. **Which leads must be one click from here?** Outage notices, forecast revisions, neighbouring prices, intraday prices. Pick the one or two that unblock the most decisions.
8. **Data trust.** What accuracy and provenance information (forecast skill, source, update time) do they need to rely on a number?
9. **Does it change decisions?** Test with real past episodes: do traders reach a different, better-informed position with the explorer than without it?
