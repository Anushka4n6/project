"use strict";

/**
 * All DOM rendering lives here. It never decides *what* to show
 * (that is app.js + features/*) - it only draws what it is given.
 */
const UI = (() => {
  const { el, formatINR } = Utils;
  const byId = (id) => document.getElementById(id);

  const clampPct = (value, axisMax) => Math.min(100, Math.max(0, (value / axisMax) * 100));

  /* ---------- small formatters ---------- */

  function discountPercent(p) {
    if (!Number.isFinite(p.originalPrice) || p.originalPrice <= p.price) return 0;
    return Math.round((1 - p.price / p.originalPrice) * 100);
  }

  function stockInfo(stock) {
    if (stock <= 0) return { text: "Out of stock", cls: "card__stock--out" };
    if (stock <= 5) return { text: `Only ${stock} left`, cls: "card__stock--low" };
    return { text: `${stock} in stock`, cls: "" };
  }

  const ACRONYMS = { ram: "RAM", dpi: "DPI", os: "OS" };

  function prettyKey(key) {
    if (ACRONYMS[key.toLowerCase()]) return ACRONYMS[key.toLowerCase()];
    return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
  }

  function diffLabel(price, target) {
    const diff = price - target;
    if (diff === 0) return "Exactly your target";
    return `${formatINR(Math.abs(diff))} ${diff < 0 ? "below" : "above"} your target`;
  }

  /* ---------- pieces ---------- */

  function ratingNode(p) {
    if (!Number.isFinite(p.rating)) return el("p", { class: "card__rating muted", text: "No ratings yet" });
    const reviews = Number.isFinite(p.reviews) ? p.reviews : 0;
    return el(
      "p",
      { class: "card__rating" },
      el("span", { class: "star", "aria-hidden": "true", text: "★" }),
      ` ${p.rating.toFixed(1)} `,
      el("span", { class: "muted", text: `(${reviews.toLocaleString("en-IN")} reviews)` })
    );
  }

  function priceNode(p) {
    const discount = discountPercent(p);
    return el(
      "p",
      { class: "card__price" },
      el("strong", { text: formatINR(p.price) }),
      discount ? el("s", { text: formatINR(p.originalPrice) }) : null,
      discount ? el("span", { class: "card__off", text: `${discount}% off` }) : null
    );
  }

  function productCard(p, { target = null, isClosest = false } = {}) {
    const stock = stockInfo(p.stock);
    return el(
      "article",
      { class: "card" },
      el(
        "div",
        { class: "card__top" },
        el("span", { class: "chip", text: p.subcategory }),
        isClosest ? el("span", { class: "badge", text: "Closest" }) : null
      ),
      el("h3", { class: "card__title", text: p.name }),
      el("p", { class: "card__brand", text: p.brand ?? "Unknown brand" }),
      priceNode(p),
      ratingNode(p),
      target !== null ? el("p", { class: "card__diff", text: diffLabel(p.price, target) }) : null,
      el("p", { class: `card__stock ${stock.cls}`.trim(), text: stock.text }),
      el("button", {
        class: "btn btn--ghost",
        type: "button",
        text: "View Product",
        "aria-label": `View ${p.name}`,
        onClick: () => openProduct(p),
      })
    );
  }

  /* ---------- Challenge 1: result cards ---------- */

  function renderCards(container, products, { target = null } = {}) {
    let closestId = null;
    if (target !== null && products.length) {
      closestId = products.reduce((best, p) =>
        Math.abs(p.price - target) < Math.abs(best.price - target) ? p : best
      ).id;
    }
    container.replaceChildren(
      ...products.map((p) => productCard(p, { target, isClosest: p.id === closestId }))
    );
  }

  /* ---------- Price ruler (shared by Challenge 1 and 6) ---------- */

  /**
   * Draws every product as a tick on a price scale.
   * hitIds   -> ticks drawn as tall pins (the matches)
   * target   -> dashed marker with a label (Challenge 1)
   * range    -> shaded band between min and max (range queries, Challenge 6)
   */
  function renderRuler(container, sorted, axisMax, { target = null, range = null, hitIds = new Set() } = {}) {
    const scale = el("div", { class: "ruler__scale" });

    if (range) {
      const lo = clampPct(range.min, axisMax);
      const hi = clampPct(range.max, axisMax);
      scale.append(el("div", { class: "ruler__band", style: `left:${lo}%;width:${Math.max(hi - lo, 0)}%` }));
    }

    for (const p of sorted) {
      scale.append(
        el("span", {
          class: hitIds.has(p.id) ? "ruler__tick is-hit" : "ruler__tick",
          style: `left:${clampPct(p.price, axisMax)}%`,
          title: `${p.name} - ${formatINR(p.price)}`,
        })
      );
    }

    if (target !== null) {
      const pct = clampPct(target, axisMax);
      const align = pct > 85 ? " is-right" : pct < 15 ? " is-left" : "";
      const offScale = target > axisMax ? " (off scale)" : "";
      scale.append(
        el(
          "div",
          { class: "ruler__target", style: `left:${pct}%` },
          el("span", { class: `ruler__target-label${align}`, text: `Target ${formatINR(target)}${offScale}` })
        )
      );
    }

    const divisions = Math.max(1, Math.min(Math.round(axisMax / 50000), 4));
    const axis = el("div", { class: "ruler__axis", "aria-hidden": "true" });
    for (let i = 0; i <= divisions; i++) {
      const value = (axisMax / divisions) * i;
      const cls = i === 0 ? " is-first" : i === divisions ? " is-last" : "";
      axis.append(
        el("span", { class: `ruler__axis-label${cls}`, style: `left:${(i / divisions) * 100}%`, text: formatINR(value) })
      );
    }

    container.replaceChildren(scale, axis);
  }

  /* ---------- Challenge 6: dual slider + summary + table ---------- */

  function setSliderFill(sliderEl, min, max, axisMax) {
    sliderEl.style.setProperty("--lo", clampPct(min, axisMax));
    sliderEl.style.setProperty("--hi", clampPct(max, axisMax));
  }

  function renderInventory(result) {
    byId("inv-count").textContent = result.count.toLocaleString("en-IN");
    byId("inv-units").textContent = result.totalUnits.toLocaleString("en-IN");
    byId("inv-value").textContent = formatINR(result.totalValue);

    byId("inv-tbody").replaceChildren(
      ...result.products.map((p) =>
        el(
          "tr",
          {},
          el("td", { text: p.name }),
          el("td", { text: p.brand ?? "-" }),
          el("td", { class: "num", text: formatINR(p.price) }),
          el("td", { class: "num", text: String(p.stock) }),
          el("td", { class: "num", text: formatINR(p.price * p.stock) }),
          el(
            "td",
            {},
            el("button", {
              class: "btn btn--ghost btn--small",
              type: "button",
              text: "View",
              "aria-label": `View ${p.name}`,
              onClick: () => openProduct(p),
            })
          )
        )
      )
    );
    byId("inv-table-wrap").hidden = result.count === 0;
  }

  /* ---------- messages ---------- */

  function showError(node, message) {
    node.textContent = message;
    node.hidden = false;
    node.closest("form")?.querySelectorAll("input").forEach((i) => i.setAttribute("aria-invalid", "true"));
  }

  function clearError(node) {
    node.textContent = "";
    node.hidden = true;
    node.closest("form")?.querySelectorAll("input").forEach((i) => i.removeAttribute("aria-invalid"));
  }

  function showEmpty(node, title, hint) {
    node.replaceChildren(el("strong", { text: title }), hint);
    node.hidden = false;
  }

  function hide(node) {
    node.hidden = true;
  }

  /* ---------- product dialog ---------- */

  function openProduct(p) {
    const dialog = byId("product-dialog");
    const body = dialog.querySelector(".dialog__body");
    const stock = stockInfo(p.stock);
    const specs = Object.entries(p.specifications ?? {});

    body.replaceChildren(
      el("p", { class: "chip chip--inline", text: `${p.category}, ${p.subcategory}` }),
      el("h2", { id: "dialog-title", text: p.name }),
      el("p", { class: "muted", text: `by ${p.brand ?? "an unknown brand"}` }),
      priceNode(p),
      ratingNode(p),
      el("p", { class: `card__stock ${stock.cls}`.trim(), text: stock.text }),
      p.tags.length
        ? el("ul", { class: "tags", "aria-label": "Tags" }, p.tags.map((t) => el("li", { class: "chip", text: t })))
        : null,
      specs.length
        ? el(
            "div",
            {},
            el("h3", { text: "Specifications" }),
            el(
              "dl",
              { class: "specs" },
              specs.flatMap(([key, value]) => [el("dt", { text: prettyKey(key) }), el("dd", { text: String(value) })])
            )
          )
        : null
    );
    dialog.showModal();
  }

  function initDialog() {
    const dialog = byId("product-dialog");
    dialog.querySelector(".dialog__close").addEventListener("click", () => dialog.close());
    // Clicking the dimmed backdrop targets the <dialog> element itself.
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  return { renderCards, renderRuler, setSliderFill, renderInventory, showError, clearError, showEmpty, hide, openProduct, initDialog };
})();
