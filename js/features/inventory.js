"use strict";

/**
 * CHALLENGE 6 - Inventory Range Dashboard (pure logic, no DOM)
 *
 * Inventory value of a product = price x stock.
 *
 * Initial approach (naive)
 *   Every query scans all n products, keeps those inside [min, max]
 *   and adds up price x stock.
 *   Time: O(n) per query    Space: O(1) extra
 *
 * Optimized approach
 *   Preprocess ONCE on the price-sorted array:
 *     valuePrefix[i] = sum of price x stock of the first i products
 *     unitsPrefix[i] = sum of stock of the first i products
 *   A query is then:
 *     lo, hi = two binary searches (PriceSearch.rangeIndices)
 *     count  = hi - lo
 *     value  = valuePrefix[hi] - valuePrefix[lo]
 *   Preprocessing: O(n log n) time (the sort), O(n) space - paid once.
 *   Each query: O(log n) for count / value / units.
 *   Listing the matching products costs O(m) - unavoidable, since the
 *   UI has to draw m rows anyway.
 */
const Inventory = (() => {
  /** valuePrefix[0] = 0, so the sum of window [lo, hi) is prefix[hi] - prefix[lo]. */
  function buildPrefix(sorted) {
    const value = new Array(sorted.length + 1).fill(0);
    const units = new Array(sorted.length + 1).fill(0);
    for (let i = 0; i < sorted.length; i++) {
      value[i + 1] = value[i] + sorted[i].price * sorted[i].stock;
      units[i + 1] = units[i] + sorted[i].stock;
    }
    return { value, units };
  }

  function query(sorted, prefix, min, max) {
    const { lo, hi } = PriceSearch.rangeIndices(sorted, min, max);
    return {
      count: hi - lo,
      totalValue: prefix.value[hi] - prefix.value[lo],
      totalUnits: prefix.units[hi] - prefix.units[lo],
      products: sorted.slice(lo, hi),
    };
  }

  /** Reference implementation used only by the self-check in app.js. */
  function queryNaive(products, min, max) {
    let count = 0;
    let totalValue = 0;
    let totalUnits = 0;
    for (const p of products) {
      if (p.price >= min && p.price <= max) {
        count++;
        totalValue += p.price * p.stock;
        totalUnits += p.stock;
      }
    }
    return { count, totalValue, totalUnits };
  }

  return { buildPrefix, query, queryNaive };
})();
