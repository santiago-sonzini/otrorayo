/* Scene covers: native sticky positioning, without wheel/touch interception. */
(() => {
  "use strict";
  const main = document.querySelector("main");
  if (!main) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const sections = [...main.querySelectorAll(":scope > section")];
  const stops = sections.map((section, index) => {
    const stop = document.createElement("div");
    stop.className = "scene-stop";
    stop.setAttribute("aria-hidden", "true");
    section.before(stop);
    section.style.setProperty("--scene-order", index + 1);
    return stop;
  });
  function measure() {
    sections.forEach((section) => {
      // Taller scenes scroll completely before their bottom rests in the viewport.
      section.style.setProperty(
        "--scene-top",
        `${Math.min(0, innerHeight - section.offsetHeight)}px`,
      );
    });
    main.classList.toggle("scene-covers", !reduced.matches);
  }
  const observer = new ResizeObserver(measure);
  sections.forEach((section) => observer.observe(section));
  window.addEventListener("resize", measure, { passive: true });
  reduced.addEventListener("change", measure);
  function navigate(id, behavior = "smooth") {
    const target = document.getElementById(id);
    const section = target?.closest("main > section");
    const index = sections.indexOf(section);
    if (index < 0) return false;
    const top = stops[index].getBoundingClientRect().top + scrollY;
    window.scrollTo({
      top: Math.max(0, top - 84),
      behavior: reduced.matches ? "instant" : behavior,
    });
    return true;
  }
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (
      !link ||
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return;
    const id = link.hash.slice(1);
    // Contact belongs to the modal; its existing handler owns that action.
    if (id === "contacto" || !navigate(id)) return;
    event.preventDefault();
    if (location.hash !== link.hash) history.pushState(null, "", link.hash);
  });
  window.addEventListener("popstate", () => {
    if (location.hash !== "#contacto")
      navigate(location.hash.slice(1) || "inicio", "instant");
  });
  document.addEventListener("focusin", (event) => {
    const section = event.target.closest?.("main > section");
    const index = sections.indexOf(section);
    if (index < 0 || reduced.matches) return;
    const rect = event.target.getBoundingClientRect();
    const covered = sections
      .slice(index + 1)
      .some((next) => next.getBoundingClientRect().top < rect.bottom);
    if (covered) {
      const localY = rect.top - section.getBoundingClientRect().top;
      window.scrollTo({
        top: Math.max(
          0,
          stops[index].getBoundingClientRect().top + scrollY + localY - 130,
        ),
        behavior: "instant",
      });
    }
  });
  measure();
})();
