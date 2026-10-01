"use strict";

/**
 * Wires the data, the feature logic and the UI together.
 *   data.js -> utils.js -> features/*.js -> ui.js -> app.js
 */
(() => {
  const MAX_INPUT = 1e9; // very large input guard (₹100 crore)
  const SLIDER_STEP = 100;
  const $ = (id) => document.getElementById(id);
  const { formatINR, formatNumber } = Utils;

  /* ---------- build the data structures ONCE ---------- */

  const products = Utils.flattenProducts(storeData);
  const sorted = PriceSearch.sortByPrice(products); // O(n log n), reused by every query
  const prefix = Inventory.buildPrefix(sorted); // O(n), reused by every inventory query

  $("store-name").textContent = storeData.storeName ?? "Store";
  UI.initDialog();
  initTabs();

  if (sorted.length === 0) {
    // Missing / empty data: tell the user instead of showing a broken page.
    for (const id of ["pf-empty", "inv-empty"]) {
      UI.showEmpty($(id), "No products to show", "The product data is empty or every product is missing a price.");
    }
    document.querySelectorAll("form button, form input, form select").forEach((n) => (n.disabled = true));
    return;
  }

  const maxPrice = sorted[sorted.length - 1].price;
  const AXIS_MAX = Math.max(50000, Math.ceil(maxPrice / 50000) * 50000); // 124,999 -> 1,50,000

  $("catalog-summary").textContent =
    `${sorted.length} products from ${formatINR(sorted[0].price)} to ${formatINR(maxPrice)}.`;

  /* ---------- shared input reading ---------- */

  const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

  /** Returns { value } or { error }. */
  function readPrice(input, label) {
    const raw = input.value.trim();
    if (raw === "") return { error: `Enter a ${label}.` };
    const value = Utils.parsePrice(raw);
    if (value === null) return { error: `${capitalize(label)} must be a number, like 70000 or ₹70,000.` };
    if (value > MAX_INPUT) return { error: `${capitalize(label)} can't be above ${formatINR(MAX_INPUT)}.` };
    return { value };
  }

  /** Reads a min/max pair. Returns { min, max } or { error }. */
  function readRange(minInput, maxInput) {
    const min = readPrice(minInput, "minimum price");
    if (min.error) return min;
    const max = readPrice(maxInput, "maximum price");
    if (max.error) return max;
    if (min.value > max.value) return { error: "Minimum price can't be higher than the maximum price." };
    return { min: min.value, max: max.value };
  }

  /* =====================================================
     CHALLENGE 1 - Price finder
     ===================================================== */

  const pfTarget = $("pf-target");
  const pfCount = $("pf-count");
  const pfMin = $("pf-min");
  const pfMax = $("pf-max");
  const pfClosestError = $("pf-closest-error");
  const pfRangeError = $("pf-range-error");

  function showFinderResults({ title, status, hits, target = null, range = null, emptyTitle, emptyHint }) {
    $("pf-results-title").textContent = title;
    $("pf-status").textContent = status;

    if (hits.length === 0) {
      $("pf-results").replaceChildren();
      UI.showEmpty($("pf-empty"), emptyTitle, emptyHint);
    } else {
      UI.hide($("pf-empty"));
      UI.renderCards($("pf-results"), hits, { target });
    }

    const ruler = $("pf-ruler");
    ruler.setAttribute(
      "aria-label",
      `Price scale from ${formatINR(0)} to ${formatINR(AXIS_MAX)}. ${hits.length} matching products highlighted.`
    );
    UI.renderRuler(ruler, sorted, AXIS_MAX, { target, range, hitIds: new Set(hits.map((p) => p.id)) });
  }

  function searchClosest() {
    const target = readPrice(pfTarget, "target price");
    if (target.error) return UI.showError(pfClosestError, target.error);
    UI.clearError(pfClosestError);

    const hits = PriceSearch.findClosest(sorted, target.value, Number(pfCount.value));
    showFinderResults({
      title: `${hits.length} closest to ${formatINR(target.value)}`,
      status: "Cheapest first. The nearest match is tagged.",
      hits,
      target: target.value,
    });
  }

  function searchRange() {
    const range = readRange(pfMin, pfMax);
    if (range.error) return UI.showError(pfRangeError, range.error);
    UI.clearError(pfRangeError);

    const hits = PriceSearch.findInRange(sorted, range.min, range.max);
    const label = `${formatINR(range.min)} and ${formatINR(range.max)}`;
    showFinderResults({
      title: hits.length === 1 ? `1 product between ${label}` : `${hits.length} products between ${label}`,
      status: "Cheapest first.",
      hits,
      range,
      emptyTitle: `No products between ${label}`,
      emptyHint: "Try a wider range.",
    });
  }

  $("pf-closest-form").addEventListener("submit", (event) => {
    event.preventDefault();
    searchClosest();
  });
  $("pf-range-form").addEventListener("submit", (event) => {
    event.preventDefault();
    searchRange();
  });

  /* =====================================================
     CHALLENGE 6 - Inventory range dashboard
     ===================================================== */

  const invMin = $("inv-min");
  const invMax = $("inv-max");
  const invError = $("inv-error");
  const invSlider = $("inv-slider");
  const sliderMin = $("inv-slider-min");
  const sliderMax = $("inv-slider-max");

  for (const slider of [sliderMin, sliderMax]) {
    slider.min = 0;
    slider.max = AXIS_MAX;
    slider.step = SLIDER_STEP;
  }

  function applyInventory(min, max) {
    const result = Inventory.query(sorted, prefix, min, max); // O(log n) for the numbers
    UI.renderInventory(result);
    UI.setSliderFill(invSlider, min, max, AXIS_MAX);

    const ruler = $("inv-ruler");
    ruler.setAttribute(
      "aria-label",
      `Price scale from ${formatINR(0)} to ${formatINR(AXIS_MAX)}. ${result.count} products inside the selected range.`
    );
    UI.renderRuler(ruler, sorted, AXIS_MAX, {
      range: { min, max },
      hitIds: new Set(result.products.map((p) => p.id)),
    });

    if (result.count === 0) {
      UI.showEmpty(
        $("inv-empty"),
        `No products between ${formatINR(min)} and ${formatINR(max)}`,
        "Drag the sliders or type a wider range."
      );
    } else {
      UI.hide($("inv-empty"));
    }
  }

  /** Typed values -> sliders -> results (Search button / Enter). */
  function searchInventory() {
    const range = readRange(invMin, invMax);
    if (range.error) return UI.showError(invError, range.error);
    UI.clearError(invError);

    sliderMin.value = Math.min(range.min, AXIS_MAX);
    sliderMax.value = Math.min(range.max, AXIS_MAX);
    applyInventory(range.min, range.max);
  }

  /** Slider -> typed values -> results (live while dragging). */
  function onSliderInput(event) {
    let lo = Number(sliderMin.value);
    let hi = Number(sliderMax.value);
    if (lo > hi) {
      // The two thumbs may touch but never cross.
      if (event.target === sliderMin) sliderMin.value = lo = hi;
      else sliderMax.value = hi = lo;
    }
    invMin.value = formatNumber(lo);
    invMax.value = formatNumber(hi);
    UI.clearError(invError);
    applyInventory(lo, hi);
  }

  $("inv-form").addEventListener("submit", (event) => {
    event.preventDefault();
    searchInventory();
  });
  sliderMin.addEventListener("input", onSliderInput);
  sliderMax.addEventListener("input", onSliderInput);

  /* ---------- tabs ---------- */

  function initTabs() {
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach((tab) =>
      tab.addEventListener("click", () => {
        tabs.forEach((other) => {
          const active = other === tab;
          if (active) other.setAttribute("aria-current", "page");
          else other.removeAttribute("aria-current");
          $(other.dataset.panel).hidden = !active;
        });
      })
    );
  }

  /* ---------- self-check: fast versions must match the naive ones ---------- */

  function selfCheck() {
    const distances = (list, target) => list.map((p) => Math.abs(p.price - target)).sort((a, b) => a - b).join(",");
    let failures = 0;

    for (let i = 0; i < 300; i++) {
      const target = Math.random() * AXIS_MAX * 1.2;
      const k = 1 + Math.floor(Math.random() * 8);
      const fast = PriceSearch.findClosest(sorted, target, k);
      const slow = PriceSearch.findClosestNaive(products, target, k);
      if (distances(fast, target) !== distances(slow, target)) failures++;

      const a = Math.random() * AXIS_MAX;
      const b = Math.random() * AXIS_MAX;
      const [min, max] = a <= b ? [a, b] : [b, a];
      const q = Inventory.query(sorted, prefix, min, max);
      const n = Inventory.queryNaive(products, min, max);
      if (q.count !== n.count || q.totalValue !== n.totalValue || q.totalUnits !== n.totalUnits) failures++;
    }

    if (failures) console.error(`Self-check: ${failures} mismatches between fast and naive versions.`);
    else console.info("Self-check passed: binary search / prefix sums match the naive scans.");
  }

  /* ---------- first paint ---------- */

  searchClosest(); // shows the ₹70,000 example from the challenge
  searchInventory(); // shows the ₹5,000 - ₹20,000 example
  selfCheck();
})();
