const KNOB_MAX = 100;
const TOTAL_BUDGET = 200;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateSliderFill(slider, value) {
  const fill = (value / KNOB_MAX) * 100;
  slider.style.setProperty("--fill", `${fill}%`);
}

function initTradeoffs() {
  const sliders = Array.from(document.querySelectorAll(".knob-slider"));
  const formEl = document.querySelector("[data-contact-form]");
  const messageEl = document.querySelector("[data-tradeoffs-message]");
  const statusEl = document.querySelector("[data-contact-status]");
  const presetWorkstyleEl = document.querySelector("[data-preset-workstyle]");
  const qualityField = document.querySelector("[data-tradeoff-quality]");
  const speedField = document.querySelector("[data-tradeoff-speed]");
  const lowcostField = document.querySelector("[data-tradeoff-lowcost]");
  const outputMap = {
    quality: document.getElementById("value-quality"),
    speed: document.getElementById("value-speed"),
    lowcost: document.getElementById("value-lowcost"),
  };
  const totalUsedEl = document.querySelector("[data-total-used]");

  if (!sliders.length || !totalUsedEl) return;

  let values = sliders.map((slider) => Number.parseInt(slider.value, 10));
  let lastChangedIndex = 0;

  function buildTradeoffsBlock() {
    const quality = values[0] ?? 0;
    const speed = values[1] ?? 0;
    const lowcost = values[2] ?? 0;
    return [
      `- quality: ${quality}`,
      `- speed: ${speed}`,
      `- low cost: ${lowcost}`,
    ].join("\n");
  }

  function syncUI() {
    let total = 0;
    sliders.forEach((slider, index) => {
      const value = clamp(Math.round(values[index]), 0, KNOB_MAX);
      values[index] = value;
      slider.value = String(value);
      updateSliderFill(slider, value);
      const key = slider.dataset.knob;
      if (key && outputMap[key]) {
        outputMap[key].textContent = String(value);
      }
      total += value;
    });
    totalUsedEl.textContent = String(total);
    if (qualityField) qualityField.value = String(values[0] ?? 0);
    if (speedField) speedField.value = String(values[1] ?? 0);
    if (lowcostField) lowcostField.value = String(values[2] ?? 0);
  }

  function reduceFromOthers(activeIndex, overflow) {
    if (overflow <= 0) return;

    const otherIndexes = sliders
      .map((_, idx) => idx)
      .filter((idx) => idx !== activeIndex);

    const reductionOrder = [
      ...otherIndexes.filter((idx) => idx === lastChangedIndex),
      ...otherIndexes.filter((idx) => idx !== lastChangedIndex),
    ];

    let remaining = overflow;

    for (const idx of reductionOrder) {
      if (remaining <= 0) break;
      const available = values[idx];
      const cut = Math.min(available, remaining);
      values[idx] -= cut;
      remaining -= cut;
    }

    if (remaining > 0) {
      values[activeIndex] = Math.max(0, values[activeIndex] - remaining);
    }
  }

  sliders.forEach((slider, activeIndex) => {
    slider.addEventListener("input", () => {
      const previous = values[activeIndex];
      const next = clamp(Number.parseInt(slider.value, 10), 0, KNOB_MAX);
      values[activeIndex] = next;

      if (next > previous) {
        const total = values.reduce((sum, value) => sum + value, 0);
        const overflow = Math.max(0, total - TOTAL_BUDGET);
        reduceFromOthers(activeIndex, overflow);
      }

      lastChangedIndex = activeIndex;
      syncUI();
    });
  });

  if (presetWorkstyleEl) {
    presetWorkstyleEl.addEventListener("click", () => {
      values = [100, 50, 50];
      lastChangedIndex = 0;
      syncUI();
    });
  }

  if (formEl) {
    formEl.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(formEl);
      const payload = {
        name: String(formData.get("name") || "").trim(),
        contact: String(formData.get("contact") || "").trim(),
        info: String(formData.get("info") || "").trim(),
      };
      const tradeoffsBlock = buildTradeoffsBlock();
      const composedInfo = payload.info
        ? `${payload.info}\n\n${tradeoffsBlock}`
        : tradeoffsBlock;

      if (!payload.name || !payload.contact) {
        if (statusEl) {
          statusEl.textContent = "Please fill name and contact.";
        }
        return;
      }

      if (statusEl) {
        statusEl.textContent = "Sending...";
      }

      try {
        await fetch("https://api.artemshar.space/api/chat/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            info: composedInfo,
          }),
        });
        if (statusEl) {
          statusEl.textContent = "Message sent. Thank you!";
        }
      } catch (_) {
        if (statusEl) {
          statusEl.textContent = "Failed to send info. Please try again.";
        }
      }
    });
  }

  syncUI();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTradeoffs, { once: true });
} else {
  initTradeoffs();
}
