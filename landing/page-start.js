/* Disable browser scroll restoration before the document is laid out. */
(() => {
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  const reload =
    performance.getEntriesByType("navigation")[0]?.type === "reload";
  function reset() {
    if (!reload) return;
    if (location.hash)
      history.replaceState(
        history.state,
        "",
        location.pathname + location.search,
      );
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }
  reset();
  window.addEventListener("pageshow", reset, { once: true });
  window.OtrorayoPageStart = { reset };
})();
