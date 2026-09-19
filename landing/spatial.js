/* Movimiento nativo, sin alterar el scroll ni el comportamiento de los enlaces. */
(() => {
  "use strict";

  let cleanup = null;

  function initialize() {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const pointerStates = [];
    const stacks = [];
    const removers = [];
    let frame = 0;

    const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));
    const suspended = () => reducedMotion.matches || document.hidden;
    const set = (element, name, value) =>
      element.style.setProperty(name, value);
    const on = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      removers.push(() => target.removeEventListener(type, handler, options));
    };
    const onMedia = (query, handler) => {
      if (query.addEventListener) on(query, "change", handler);
      else {
        query.addListener(handler);
        removers.push(() => query.removeListener(handler));
      }
    };

    function schedule() {
      if (!frame && !suspended()) frame = window.requestAnimationFrame(update);
    }

    function update() {
      frame = 0;
      if (suspended()) return;
      const writes = [];

      pointerStates.forEach((state) => {
        if (!state.dirty || !state.point) return;
        state.dirty = false;
        const bounds = state.element.getBoundingClientRect();
        const x = clamp(
          ((state.point.x - bounds.left) / Math.max(1, bounds.width) - 0.5) * 2,
          1,
        );
        const y = clamp(
          ((state.point.y - bounds.top) / Math.max(1, bounds.height) - 0.5) * 2,
          1,
        );
        writes.push([
          state.element,
          state.xName,
          `${(x * state.xLimit).toFixed(2)}${state.unit}`,
        ]);
        writes.push([
          state.element,
          state.yName,
          `${(y * state.yLimit).toFixed(2)}${state.unit}`,
        ]);
      });

      // Leer todas las posiciones antes de escribir evita recalcular el layout entre elementos.
      writes.forEach(([element, name, value]) => set(element, name, value));
    }

    function resetPointer(state) {
      state.point = null;
      state.dirty = false;
      set(state.element, state.xName, `0${state.unit}`);
      set(state.element, state.yName, `0${state.unit}`);
    }

    function trackPointer(element, options) {
      const state = { element, point: null, dirty: false, ...options };
      pointerStates.push(state);
      const move = (event) => {
        if (
          suspended() ||
          !finePointer.matches ||
          event.pointerType === "touch"
        )
          return;
        state.point = { x: event.clientX, y: event.clientY };
        state.dirty = true;
        schedule();
      };
      on(element, "pointerenter", move, { passive: true });
      on(element, "pointermove", move, { passive: true });
      on(element, "pointerleave", () => resetPointer(state));
      on(element, "pointercancel", () => resetPointer(state));
      return state;
    }

    function updateActive(stack) {
      const focused = stack.cards.find((card) =>
        card.contains(document.activeElement),
      );
      const active = suspended() ? null : focused || stack.hovered;
      stack.cards.forEach((card) =>
        card.classList.toggle("is-active", card === active),
      );
    }

    document.querySelectorAll(".invitation-examples").forEach((element) => {
      trackPointer(element, {
        xName: "--pointer-x",
        yName: "--pointer-y",
        xLimit: 7,
        yLimit: -5,
        unit: "deg",
      });
      const stack = {
        element,
        cards: [...element.querySelectorAll(".invitation-example")],
        hovered: null,
      };
      stacks.push(stack);
      stack.cards.forEach((card) => {
        on(card, "pointerenter", (event) => {
          if (
            suspended() ||
            !finePointer.matches ||
            event.pointerType === "touch"
          )
            return;
          stack.hovered = card;
          updateActive(stack);
        });
        on(card, "pointerleave", () => {
          if (stack.hovered === card) stack.hovered = null;
          updateActive(stack);
        });
      });
      on(element, "focusin", (event) => {
        updateActive(stack);
        const card = stack.cards.find((item) => item.contains(event.target));
        if (card?.matches(":focus-visible")) {
          card.scrollIntoView({
            block: "nearest",
            inline: "nearest",
            behavior: "auto",
          });
        }
      });
      on(element, "focusout", (event) => {
        const next = stack.cards.find((card) =>
          card.contains(event.relatedTarget),
        );
        stack.cards.forEach((card) => {
          card.classList.toggle(
            "is-active",
            !suspended() && card === (next || stack.hovered),
          );
        });
      });
      on(element, "pointercancel", () => {
        stack.hovered = null;
        updateActive(stack);
      });
      updateActive(stack);
    });

    function resetEffects() {
      window.cancelAnimationFrame(frame);
      frame = 0;
      pointerStates.forEach(resetPointer);
      stacks.forEach((stack) => {
        stack.hovered = null;
        stack.cards.forEach((card) => card.classList.remove("is-active"));
      });
    }

    on(window, "resize", schedule, { passive: true });
    on(window, "blur", () => {
      pointerStates.forEach(resetPointer);
      stacks.forEach((stack) => {
        stack.hovered = null;
        updateActive(stack);
      });
    });
    on(document, "visibilitychange", () => {
      resetEffects();
      if (!suspended()) {
        stacks.forEach(updateActive);
        schedule();
      }
    });
    onMedia(reducedMotion, () => {
      resetEffects();
      if (!suspended()) {
        stacks.forEach(updateActive);
        schedule();
      }
    });
    onMedia(finePointer, () => {
      pointerStates.forEach(resetPointer);
      stacks.forEach((stack) => {
        stack.hovered = null;
        updateActive(stack);
      });
    });

    if (suspended()) resetEffects();
    else schedule();

    return () => {
      resetEffects();
      removers.forEach((remove) => remove());
    };
  }

  function mount() {
    if (!cleanup) cleanup = initialize();
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();

  window.addEventListener("pagehide", () => {
    cleanup?.();
    cleanup = null;
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) mount();
  });
})();
