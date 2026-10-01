"use strict";

/**
 * CHALLENGE 1 - Smart Price Finder (pure logic, no DOM)
 *
 * Initial approach (naive)
 *   For every query, compute |price - target| for all n products, sort them,
 *   take the first k.
 *   Time: O(n log n) per query    Space: O(n)
 *
 * Optimized approach
 *   Sort the products by price ONCE (O(n log n)). After that:
 *   - binary search finds where the target would sit         -> O(log n)
 *   - two pointers (left / right) walk outwards from there,
 *     always taking the nearer neighbour, k times             -> O(k)
 *   - range query = two binary searches + slice               -> O(log n + m)
 *   Time per query: O(log n + k)   Extra space: O(k)
 *   (the sorted array itself is O(n), built once and reused)
 */
const PriceSearch = (() => {
  /** Sort once. Ties on price are broken by id so results are deterministic. */
  function sortByPrice(products) {
    return [...products].sort((a, b) => a.price - b.price || String(a.id).localeCompare(String(b.id)));
  }

  /** First index whose price is >= x (n if none). */
  function lowerBound(sorted, x) {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (sorted[mid].price < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** First index whose price is > x (n if none). */
  function upperBound(sorted, x) {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (sorted[mid].price <= x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /**
   * The k products closest to `target`, returned cheapest first.
   * On an exact tie in distance the cheaper product wins.
   */
  function findClosest(sorted, target, k) {
    const n = sorted.length;
    const want = Math.min(k, n);
    if (want <= 0) return [];

    let right = lowerBound(sorted, target); // first price >= target
    let left = right - 1; // last price < target
    const picked = [];

    while (picked.length < want) {
      const distLeft = left >= 0 ? target - sorted[left].price : Infinity;
      const distRight = right < n ? sorted[right].price - target : Infinity;
      if (distLeft <= distRight) picked.push(sorted[left--]);
      else picked.push(sorted[right++]);
    }

    return picked.sort((a, b) => a.price - b.price || String(a.id).localeCompare(String(b.id)));
  }

  /** Index window [lo, hi) of products with min <= price <= max. */
  function rangeIndices(sorted, min, max) {
    if (min > max) return { lo: 0, hi: 0 };
    return { lo: lowerBound(sorted, min), hi: upperBound(sorted, max) };
  }

  /** Products with min <= price <= max, cheapest first. */
  function findInRange(sorted, min, max) {
    const { lo, hi } = rangeIndices(sorted, min, max);
    return sorted.slice(lo, hi);
  }

  /** Reference implementation used only by the self-check in app.js. */
  function findClosestNaive(products, target, k) {
    return [...products]
      .sort((a, b) => Math.abs(a.price - target) - Math.abs(b.price - target) || a.price - b.price)
      .slice(0, k);
  }

  return { sortByPrice, lowerBound, upperBound, findClosest, rangeIndices, findInRange, findClosestNaive };
})();
