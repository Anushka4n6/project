"use strict";

/**
 * Small shared helpers. No DOM access happens at load time,
 * so the pure functions can also be tested in Node.
 */
const Utils = (() => {
  const inrNumber = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

  /** 114999 -> "₹1,14,999" */
  function formatINR(value) {
    return "₹" + inrNumber.format(Math.round(value));
  }

  /** 114999 -> "1,14,999" (no rupee sign, used inside inputs) */
  function formatNumber(value) {
    return inrNumber.format(Math.round(value));
  }

  /**
   * storeData is nested: category -> subcategory -> products.
   * We walk it once (O(n)) and return one flat array.
   * Products without a numeric price are skipped (missing data),
   * and optional fields get safe defaults.
   */
  function flattenProducts(store) {
    const flat = [];
    for (const category of store?.categories ?? []) {
      for (const sub of category.subcategories ?? []) {
        for (const p of sub.products ?? []) {
          if (!p || typeof p.price !== "number" || !Number.isFinite(p.price)) continue;
          flat.push({
            ...p,
            stock: Number.isFinite(p.stock) ? p.stock : 0,
            category: p.category ?? category.name,
            subcategory: p.subcategory ?? sub.name,
            tags: Array.isArray(p.tags) ? p.tags : [],
            specifications: p.specifications ?? {},
          });
        }
      }
    }
    return flat;
  }

  /**
   * Accepts "70000", "70,000", "₹70,000", " 70 000 ".
   * Returns a number >= 0, or null if the text is not a valid price.
   */
  function parsePrice(raw) {
    const cleaned = String(raw ?? "").replace(/[₹,\s]/g, "");
    if (cleaned === "") return null;
    const value = Number(cleaned);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  /** Tiny DOM builder: el("p", { class: "x", text: "hi" }, child1, child2) */
  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
      else node.setAttribute(key, value === true ? "" : value);
    }
    for (const child of children.flat()) {
      if (child == null || child === false) continue;
      node.append(child);
    }
    return node;
  }

  return { formatINR, formatNumber, flattenProducts, parsePrice, el };
})();
