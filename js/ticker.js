/**
 * Tech stack carousel: swipeable on touch, slow autoplay with bounce settle.
 */
(function () {
  const AUTO_MS = 2600;
  const STEP_MS = 920;
  const RESUME_MS = 4200;
  const COPIES = 3;

  /** Soft overshoot bounce (easeOutBack). */
  function easeOutBounce(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function initTicker(root) {
    const track = root.querySelector(".ticker-track");
    if (!track) return;

    const originals = Array.from(track.children);
    if (!originals.length) return;

    for (let c = 1; c < COPIES; c += 1) {
      originals.forEach((node) => {
        const clone = node.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        track.appendChild(clone);
      });
    }

    const items = Array.from(track.children);
    const setSize = originals.length;
    let setWidth = 0;
    let animating = false;
    let paused = false;
    let autoId = 0;
    let resumeId = 0;
    let rafId = 0;
    let interacting = false;

    function paddingLeft() {
      return parseFloat(getComputedStyle(root).paddingInlineStart) || 0;
    }

    /** scrollLeft value that aligns item's start with the content edge. */
    function scrollLeftFor(item) {
      const rootRect = root.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      return root.scrollLeft + (itemRect.left - rootRect.left) - paddingLeft();
    }

    function measure() {
      if (!items[0] || !items[setSize]) return;
      setWidth = scrollLeftFor(items[setSize]) - scrollLeftFor(items[0]);
      if (setWidth > 0) {
        const offsetInSet = ((root.scrollLeft % setWidth) + setWidth) % setWidth;
        root.scrollLeft = setWidth + offsetInSet;
      }
    }

    function normalizeLoop() {
      if (setWidth <= 0) return;
      if (root.scrollLeft < setWidth * 0.5) {
        root.scrollLeft += setWidth;
      } else if (root.scrollLeft >= setWidth * 1.5) {
        root.scrollLeft -= setWidth;
      }
    }

    function nearestIndex() {
      const x = root.scrollLeft;
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < items.length; i += 1) {
        const dist = Math.abs(scrollLeftFor(items[i]) - x);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      }
      return best;
    }

    function targetForIndex(index) {
      const clamped = Math.max(0, Math.min(items.length - 1, index));
      return scrollLeftFor(items[clamped]);
    }

    function animateTo(target, duration) {
      if (rafId) cancelAnimationFrame(rafId);
      const start = root.scrollLeft;
      const delta = target - start;
      if (Math.abs(delta) < 0.5) {
        root.scrollLeft = target;
        normalizeLoop();
        return Promise.resolve();
      }

      animating = true;
      root.classList.add("is-animating");
      const t0 = performance.now();

      return new Promise((resolve) => {
        function frame(now) {
          const t = Math.min(1, (now - t0) / duration);
          const eased = prefersReducedMotion() ? t : easeOutBounce(t);
          root.scrollLeft = start + delta * eased;
          if (t < 1) {
            rafId = requestAnimationFrame(frame);
            return;
          }
          rafId = 0;
          animating = false;
          root.classList.remove("is-animating");
          normalizeLoop();
          resolve();
        }
        rafId = requestAnimationFrame(frame);
      });
    }

    function scheduleAuto() {
      clearTimeout(autoId);
      if (paused || prefersReducedMotion()) return;
      autoId = window.setTimeout(async () => {
        if (paused || interacting || animating) {
          scheduleAuto();
          return;
        }
        const next = nearestIndex() + 1;
        await animateTo(targetForIndex(next), STEP_MS);
        scheduleAuto();
      }, AUTO_MS);
    }

    function pauseAuto() {
      paused = true;
      clearTimeout(autoId);
      clearTimeout(resumeId);
    }

    function resumeAutoSoon() {
      clearTimeout(resumeId);
      resumeId = window.setTimeout(() => {
        paused = false;
        scheduleAuto();
      }, RESUME_MS);
    }

    function stopAnimation() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      animating = false;
      root.classList.remove("is-animating");
    }

    root.addEventListener(
      "pointerdown",
      () => {
        interacting = true;
        pauseAuto();
        stopAnimation();
      },
      { passive: true }
    );

    root.addEventListener(
      "pointerup",
      () => {
        interacting = false;
        normalizeLoop();
        resumeAutoSoon();
      },
      { passive: true }
    );

    root.addEventListener(
      "pointercancel",
      () => {
        interacting = false;
        normalizeLoop();
        resumeAutoSoon();
      },
      { passive: true }
    );

    root.addEventListener(
      "scroll",
      () => {
        if (!animating && !interacting) normalizeLoop();
      },
      { passive: true }
    );

    // Pause only while the pointer rests on the carousel (desktop),
    // but don't cancel a pending resume after a swipe.
    root.addEventListener("mouseenter", () => {
      if (!interacting) {
        clearTimeout(autoId);
        paused = true;
      }
    });
    root.addEventListener("mouseleave", () => {
      if (interacting) return;
      paused = false;
      scheduleAuto();
    });

    root.addEventListener("focusin", pauseAuto);
    root.addEventListener("focusout", () => {
      paused = false;
      scheduleAuto();
    });

    root.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      pauseAuto();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      animateTo(targetForIndex(nearestIndex() + dir), STEP_MS).then(resumeAutoSoon);
    });

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => {
      if (motionQuery.matches) {
        pauseAuto();
      } else {
        paused = false;
        scheduleAuto();
      }
    };
    if (motionQuery.addEventListener) {
      motionQuery.addEventListener("change", onMotionChange);
    } else {
      motionQuery.addListener(onMotionChange);
    }

    let resizeId = 0;
    window.addEventListener("resize", () => {
      clearTimeout(resizeId);
      resizeId = window.setTimeout(measure, 120);
    });

    requestAnimationFrame(() => {
      measure();
      if (setWidth > 0) root.scrollLeft = setWidth;
      scheduleAuto();
    });

    Promise.all(
      Array.from(root.querySelectorAll("img")).map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.addEventListener("load", resolve, { once: true });
                img.addEventListener("error", resolve, { once: true });
              })
      )
    ).then(() => {
      measure();
    });
  }

  function boot() {
    document.querySelectorAll("[data-ticker]").forEach(initTicker);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
