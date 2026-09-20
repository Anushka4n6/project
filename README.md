# TechMart Product Explorer

HTML + CSS + JavaScript only (no frameworks, no libraries). Data comes from `js/data.js`.

Implemented challenges:

| Challenge | Marks | Where |
|---|---|---|
| 1 - Smart Price Finder (+ range follow-up) | 50 | `js/features/search.js`, "Price finder" tab |
| 6 - Inventory Range Dashboard (+ slider follow-up) | 120 | `js/features/inventory.js`, "Inventory range" tab |

## Run

Open `index.html` in a browser. There is no build step. The scripts are plain
`<script>` tags (not ES modules), so it also works when opened straight from disk.
Open the browser console: a self-check compares the fast algorithms with naive
scans on 300 random queries and prints the result.

## Structure

```
index.html
css/style.css
js/
  data.js                 provided dataset
  utils.js                flatten nested data, ₹ formatting, input parsing, DOM helper
  ui.js                   all rendering (cards, price ruler, table, product dialog)
  app.js                  wiring: events, validation, tabs, first paint
  features/
    search.js             Challenge 1 logic (no DOM)
    inventory.js          Challenge 6 logic (no DOM)
```

## Challenge 1 - Smart Price Finder

n = number of products, k = number of results, m = number of matches in a range.

**Initial approach:** for each query compute `|price - target|` for every product,
sort, take the first k.
- Time: O(n log n) per query
- Space: O(n)

**Optimized approach:** sort by price once. For a query, binary search finds where
the target sits, then two pointers walk outwards and always take the nearer
neighbour, k times. A range query is two binary searches plus a slice.
- Preprocessing (once): O(n log n) time, O(n) space
- Closest-k per query: O(log n + k) time, O(k) extra space
- Range per query: O(log n + m) time

Tie rule: if two products are equally close, the cheaper one is picked.

## Challenge 6 - Inventory Range Dashboard

Inventory value of a product = `price × stock`.

**Initial approach:** for each query scan every product, keep those inside the range,
add up `price × stock`.
- Time: O(n) per query
- Space: O(1) extra

**Optimized approach:** on the price-sorted array build prefix sums once
(`valuePrefix[i]` = value of the first i products, same for units). A query is two
binary searches (`lo`, `hi`), then `count = hi - lo` and
`value = valuePrefix[hi] - valuePrefix[lo]`.
- Preprocessing (once): O(n log n) time (the sort), O(n) space
- Count / units / value per query: O(log n)
- Drawing the matching rows: O(m), unavoidable because m rows must be rendered

This is what makes the slider cheap: every movement of a thumb is one O(log n) query.

## Edge cases handled

- Empty or non-numeric input, `₹` and commas in input (`₹70,000` works)
- Minimum higher than maximum (error message, nothing is silently swapped)
- Very large input (limit of ₹100 crore, marker shows "off scale" beyond the ruler)
- Target below the cheapest / above the most expensive product
- Fewer products than k
- Range with no products (empty state)
- Products with equal prices
- Missing `price` (product skipped), missing `stock` (treated as 0), missing rating
- Out-of-stock and low-stock labels

## Git workflow (from the challenge rules)

One branch and one Pull Request per challenge:

```
feature/challenge-01   -> search.js + Price finder tab
feature/challenge-06   -> inventory.js + Inventory range tab
```
