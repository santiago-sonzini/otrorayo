/* Object motion only: editorial images and a camera move, headings remain still. */
(() => {
  "use strict";
  const gallery = document.querySelector("#invitacion");
  const experience = document.querySelector("#experiencias");
  const contact = document.querySelector("#contacto");
  const cards = [...gallery.querySelectorAll(".invitation-example")];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  let frame = 0;
  const clamp = (n) => Math.max(0, Math.min(1, n));
  function progress(section) {
    const origin = section.previousElementSibling?.classList.contains(
      "scene-stop",
    )
      ? section.previousElementSibling
      : section;
    return clamp(
      (innerHeight - origin.getBoundingClientRect().top) /
        (innerHeight + section.offsetHeight * 0.45),
    );
  }
  function paint() {
    frame = 0;
    if (document.hidden) return;
    const p = reduced.matches ? 1 : progress(gallery);
    cards.forEach((card, i) =>
      card.style.setProperty(
        "--editorial-shift",
        `${innerWidth < 768 ? 0 : (1 - p) * [64, -56, 96][i]}px`,
      ),
    );
    window.dispatchEvent(
      new CustomEvent("otrorayo:scene-progress", {
        detail: { progress: reduced.matches ? 0.4 : progress(experience) },
      }),
    );
  }
  function queue() {
    if (!frame) frame = requestAnimationFrame(paint);
  }
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue, { passive: true });
  reduced.addEventListener("change", queue);
  document.addEventListener("visibilitychange", queue);
  contact.addEventListener(
    "pointermove",
    (event) => {
      if (!fine.matches || reduced.matches) return;
      const r = contact.getBoundingClientRect();
      contact.style.setProperty(
        "--prism-angle",
        `${((event.clientY - r.top) / r.height - 0.5) * 5}deg`,
      );
    },
    { passive: true },
  );
  contact.addEventListener("pointerleave", () =>
    contact.style.removeProperty("--prism-angle"),
  );
  queue();
})();
