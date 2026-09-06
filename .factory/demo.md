# Demo sandbox

- URL: `https://shared-capacity-slots.sociobot.in/?demo=1`
- Entry action: **Try it with sample data** on the first screen.
- Sample: Maya and Leo, a studio room, a treatment table, two services, and four realistic busy blocks. Fourteen days of results are calculated immediately.
- Isolation: demo state exists only in the page's memory. Demo actions never open or write the real IndexedDB database or license storage.
- Reset: **Reset demo** restores the original sample and calculated results.
- Exit: **Start for real** reloads `/`, discards demo changes, and opens the user's real IndexedDB plan.
