/* Tres pasos y envío al endpoint privado de consultas. */
(() => {
  "use strict";
  function init(config) {
    const dialog = document.querySelector("#contact-dialog");
    const form = document.querySelector("#contact-form");
    if (!dialog || !form || !dialog.showModal) return;
    const body = dialog.querySelector(".wizard-body");
    const panels = [...dialog.querySelectorAll("[data-step]")];
    const progress = dialog.querySelector(".wizard-progress-track");
    const title = dialog.querySelector("#wizard-title");
    const description = dialog.querySelector("#wizard-description");
    const nextLabel = dialog.querySelector("#wizard-next-label");
    const back = dialog.querySelector("#wizard-back");
    const footer = dialog.querySelector(".wizard-footer");
    const result = dialog.querySelector("#wizard-result");
    const heading = dialog.querySelector(".wizard-heading");
    const choices = [...form.querySelectorAll('input[name="interest"]')];
    const typeTrigger = dialog.querySelector("#event-type-trigger");
    const typeList = dialog.querySelector("#event-type-options");
    const typeOptions = [...typeList.querySelectorAll('[role="option"]')];
    const budget = dialog.querySelector("#budget");
    const budgetValue = dialog.querySelector("#budget-value");
    const prepared = dialog.querySelector("#prepared-message");
    let step = 0,
      trigger = null,
      finished = false,
      scrollY = 0,
      sending = false,
      requestId = crypto.randomUUID();
    const value = (name) => (form.elements.namedItem(name)?.value || "").trim();
    const selected = () => choices.filter((choice) => choice.checked);
    const money = (n) => Number(n).toLocaleString("es-AR");
    const headings = [
      "Empecemos por tu evento.",
      "¿Qué te interesa?",
      "¿Cuál es tu presupuesto para la experiencia?",
    ];
    const descriptions = [
      "Contanos lo esencial.",
      "Elegí una o más. Armá tu propia combinación.",
      "Mové el punto. Encontrá tu punto de partida.",
    ];
    function closeSelect(restore = false) {
      typeList.hidden = true;
      typeTrigger.setAttribute("aria-expanded", "false");
      if (restore) typeTrigger.focus();
    }
    function openSelect(index) {
      typeList.hidden = false;
      typeTrigger.setAttribute("aria-expanded", "true");
      const active =
        index ??
        Math.max(
          0,
          typeOptions.findIndex(
            (option) => option.dataset.value === value("eventType"),
          ),
        );
      typeOptions.forEach((option, i) => {
        option.tabIndex = i === active ? 0 : -1;
      });
      typeOptions[active].focus({ preventScroll: true });
      typeList.scrollIntoView({ block: "nearest", behavior: "instant" });
    }
    typeTrigger.addEventListener("click", () =>
      typeList.hidden ? openSelect() : closeSelect(),
    );
    typeTrigger.addEventListener("keydown", (event) => {
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        openSelect(event.key === "End" ? typeOptions.length - 1 : 0);
      }
    });
    typeOptions.forEach((option, index) => {
      option.addEventListener("click", () => {
        form.elements.eventType.value = option.dataset.value;
        dialog.querySelector("#event-type-value").textContent =
          option.dataset.value;
        typeOptions.forEach((item) =>
          item.setAttribute("aria-selected", String(item === option)),
        );
        typeTrigger.classList.add("has-value");
        closeSelect(true);
        validate("eventType");
      });
      option.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeSelect(true);
          return;
        }
        if (event.key === "Tab") {
          closeSelect(true);
          return;
        }
        let target = index;
        if (event.key === "ArrowDown")
          target = (index + 1) % typeOptions.length;
        else if (event.key === "ArrowUp")
          target = (index - 1 + typeOptions.length) % typeOptions.length;
        else if (event.key === "Home") target = 0;
        else if (event.key === "End") target = typeOptions.length - 1;
        else if (event.key.length === 1 && event.key !== " ") {
          const found = typeOptions.findIndex((item) =>
            item.dataset.value
              .toLocaleLowerCase()
              .startsWith(event.key.toLocaleLowerCase()),
          );
          if (found >= 0) target = found;
          else return;
        } else return;
        event.preventDefault();
        typeOptions.forEach((item, i) => {
          item.tabIndex = i === target ? 0 : -1;
        });
        typeOptions[target].focus();
      });
    });
    dialog.addEventListener("pointerdown", (event) => {
      if (!event.target.closest(".event-select")) closeSelect();
    });
    function field(name) {
      return name === "eventType" ? typeTrigger : form.elements.namedItem(name);
    }
    function validate(name) {
      const messages = {
        name: "Escribí tu nombre.",
        eventType: "Elegí el tipo de evento.",
        city: "Contanos en qué ciudad sería.",
      };
      let error = messages[name] && !value(name) ? messages[name] : "";
      if (name === "phone") {
        const phone = value(name);
        if (
          !/^[+()\d .-]+$/.test(phone) ||
          phone.replace(/\D/g, "").length < 8 ||
          phone.replace(/\D/g, "").length > 16
        )
          error = "Dejanos un WhatsApp válido, con código de área.";
      }
      if (
        name === "email" &&
        value(name) &&
        !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value(name))
      )
        error = "Revisá el formato del email.";
      if (
        name === "guests" &&
        (field(name).validity.badInput ||
          (value(name) &&
            (!Number.isInteger(Number(value(name))) ||
              Number(value(name)) < 1 ||
              Number(value(name)) > 1000000)))
      )
        error = "Ingresá una cantidad entera entre 1 y 1.000.000.";
      const errorNode = form.querySelector(`[data-error-for="${name}"]`);
      if (errorNode) errorNode.textContent = error;
      field(name)?.setAttribute("aria-invalid", String(Boolean(error)));
      return !error;
    }
    ["name", "city", "guests", "phone", "email"].forEach((name) =>
      field(name).addEventListener("input", () => {
        if (field(name).getAttribute("aria-invalid") === "true") validate(name);
      }),
    );
    function selectionChanged() {
      const count = selected().length;
      dialog.querySelector("#selection-count").textContent = count
        ? `${count} ${count === 1 ? "experiencia elegida" : "experiencias elegidas"}. Tu universo toma forma.`
        : "Tu universo empieza con una elección.";
      dialog
        .querySelectorAll(".selection-sparks i")
        .forEach((spark, index) =>
          spark.classList.toggle("is-lit", index < count),
        );
      if (count) {
        dialog.querySelector("#error-interest").textContent = "";
        choices.forEach((choice) => choice.removeAttribute("aria-invalid"));
      }
    }
    choices.forEach((choice) =>
      choice.addEventListener("change", selectionChanged),
    );
    function updateBudget() {
      const percent = (Number(budget.value) - 500) / 9500;
      budgetValue.value = money(budget.value);
      budget.setAttribute(
        "aria-valuetext",
        `${money(budget.value)} dólares estadounidenses`,
      );
      dialog.style.setProperty("--budget-progress", `${percent * 100}%`);
      dialog.style.setProperty("--budget-scale", String(0.75 + percent * 0.45));
      dialog.style.setProperty("--budget-rotation", `${percent * 100}deg`);
    }
    budget.addEventListener("input", updateBudget);
    updateBudget();
    function showStep(next, focus = true) {
      step = Math.max(0, Math.min(2, next));
      finished = false;
      closeSelect();
      result.hidden = true;
      heading.hidden = false;
      footer.hidden = false;
      panels.forEach((panel, index) => {
        panel.hidden = index !== step;
      });
      progress.style.setProperty(
        "--wizard-progress",
        `${((step + 1) / 3) * 100}%`,
      );
      progress.setAttribute("aria-valuenow", String(step + 1));
      progress.setAttribute("aria-valuetext", `Paso ${step + 1} de 3`);
      title.textContent = headings[step];
      description.textContent = descriptions[step];
      nextLabel.textContent = [
        "Elegir experiencias",
        "Definir presupuesto",
        "Enviar consulta",
      ][step];
      back.hidden = step === 0;
      dialog.querySelector("#wizard-footer-note").hidden = step !== 0;
      dialog.dataset.step = String(step);
      if (step === 2)
        dialog.querySelector("#event-recap").textContent = [
          value("name"),
          value("eventType"),
          value("city"),
          selected()
            .map((choice) => choice.dataset.label)
            .join(" + "),
        ]
          .filter(Boolean)
          .join(" · ");
      body.scrollTop = 0;
      if (focus) title.focus({ preventScroll: true });
    }
    back.addEventListener("click", () => showStep(step - 1));
    dialog
      .querySelector("#edit-experiences")
      .addEventListener("click", () => showStep(1));
    function open(opener) {
      if (dialog.open) return;
      trigger = opener || document.activeElement;
      const interest = opener?.dataset.interest;
      if (interest) {
        const choice = choices.find((choice) => choice.value === interest);
        if (choice) choice.checked = true;
        selectionChanged();
        if (finished) showStep(0, false);
      }
      scrollY = window.scrollY;
      document.body.style.setProperty("--modal-scroll-y", `-${scrollY}px`);
      document.body.classList.add("contact-is-open");
      dialog.showModal();
      title.focus({ preventScroll: true });
      document.dispatchEvent(
        new CustomEvent("otrorayo:contact", { detail: { open: true } }),
      );
    }
    function close() {
      if (dialog.open) dialog.close();
    }
    dialog.querySelector(".wizard-close").addEventListener("click", close);
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        close();
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
    dialog.addEventListener("close", () => {
      closeSelect();
      document.body.classList.remove("contact-is-open");
      document.body.style.removeProperty("--modal-scroll-y");
      window.scrollTo({ top: scrollY, behavior: "instant" });
      if (location.hash === "#contacto")
        history.replaceState(null, "", location.pathname + location.search);
      document.dispatchEvent(
        new CustomEvent("otrorayo:contact", { detail: { open: false } }),
      );
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    });
    document.querySelectorAll('a[href="#contacto"]').forEach((opener) => {
      opener.setAttribute("aria-haspopup", "dialog");
      opener.setAttribute("aria-controls", "contact-dialog");
      opener.addEventListener("click", (event) => {
        event.preventDefault();
        open(opener);
      });
    });
    function openFromHash() {
      if (location.hash !== "#contacto") return;
      const intro = document.querySelector("#intro");
      if (!intro || intro.hidden) open();
      else {
        const observer = new MutationObserver(() => {
          if (intro.hidden) {
            observer.disconnect();
            if (location.hash === "#contacto") open();
          }
        });
        observer.observe(intro, {
          attributes: true,
          attributeFilter: ["hidden"],
        });
      }
    }
    window.addEventListener("hashchange", openFromHash);
    requestAnimationFrame(openFromHash);
    form.addEventListener("input", () => {
      requestId = crypto.randomUUID();
    });
    form.addEventListener("change", () => {
      requestId = crypto.randomUUID();
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (sending || finished) return;
      if (step === 0) {
        const invalid = ["name", "phone", "eventType", "city", "guests"].filter(
          (name) => !validate(name),
        );
        if (invalid.length) {
          field(invalid[0]).focus();
          return;
        }
        showStep(1);
        return;
      }
      if (step === 1) {
        if (!selected().length) {
          dialog.querySelector("#error-interest").textContent =
            "Elegí al menos una experiencia. También podemos imaginarla juntos.";
          choices.forEach((choice) =>
            choice.setAttribute("aria-invalid", "true"),
          );
          choices[0].focus();
          return;
        }
        showStep(2);
        return;
      }
      if (!validate("email")) {
        field("email").focus();
        return;
      }
      const message = [
        "Hola, OTRORAYO. Quiero crear una experiencia para mi evento.",
        "",
        `Nombre: ${value("name")}`,
        `WhatsApp: ${value("phone")}`,
        ...(value("email") ? [`Email: ${value("email")}`] : []),
        `Tipo de evento: ${value("eventType")}`,
        `Fecha aproximada: ${value("eventDate") || "A definir"}`,
        `Ciudad: ${value("city")}`,
        `Invitados: ${value("guests") || "A definir"}`,
        `Me interesa: ${selected()
          .map((choice) => choice.dataset.label)
          .join(", ")}`,
        `Presupuesto para la experiencia: ${money(budget.value)} USD`,
      ].join("\n");
      prepared.value = message;
      const link = dialog.querySelector("#form-instagram");
      link.href = `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(message)}`;
      link.textContent = "Continuar en WhatsApp";
      const payload = {
        name: value("name"),
        eventType: value("eventType"),
        eventDate: value("eventDate"),
        city: value("city"),
        guests: value("guests") ? Number(value("guests")) : "",
        interests: selected().map((choice) => choice.value),
        budget: Number(budget.value),
        phone: value("phone"),
        email: value("email"),
        website: value("website"),
        requestId,
      };
      const sendError = dialog.querySelector("#send-error");
      sendError.textContent = "";
      sending = true;
      form.setAttribute("aria-busy", "true");
      nextLabel.textContent = "Enviando…";
      const controls = [...form.querySelectorAll("input, button")].map(
        (element) => [element, element.disabled],
      );
      controls.forEach(([element]) => {
        element.disabled = true;
      });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      try {
        const response = await fetch(config.contactEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const received = await response.json().catch(() => ({}));
        if (!response.ok || received.ok !== true)
          throw new Error(
            received.error ||
              "No pudimos enviar la consulta. Intentá de nuevo o escribinos por WhatsApp.",
          );
      } catch (error) {
        sendError.textContent =
          error.name === "AbortError"
            ? "El envío está tardando. Podés reintentar o escribirnos por WhatsApp."
            : error.message === "Failed to fetch"
              ? "No pudimos conectar. Revisá tu conexión o escribinos por WhatsApp."
              : error.message;
        sendError.scrollIntoView({ block: "nearest", behavior: "smooth" });
        return;
      } finally {
        clearTimeout(timeout);
        sending = false;
        form.removeAttribute("aria-busy");
        controls.forEach(([element, disabled]) => {
          element.disabled = disabled;
        });
        nextLabel.textContent = "Enviar consulta";
      }
      dialog.querySelector("#form-status").textContent =
        "Recibimos tu consulta. Te vamos a responder al contacto que nos dejaste.";
      panels.forEach((panel) => {
        panel.hidden = true;
      });
      heading.hidden = true;
      footer.hidden = true;
      result.hidden = false;
      progress.setAttribute("aria-valuetext", "Consulta enviada");
      finished = true;
      body.scrollTop = 0;
      result.querySelector("h3").tabIndex = -1;
      result.querySelector("h3").focus({ preventScroll: true });
    });
    dialog
      .querySelector("#copy-consultation")
      .addEventListener("click", async (event) => {
        try {
          await navigator.clipboard.writeText(prepared.value);
          event.target.textContent = "Copiada ✓";
        } catch {
          prepared.focus();
          prepared.select();
          event.target.textContent = "Seleccionada: copiá el texto";
        }
      });
    showStep(0, false);
  }
  window.OtrorayoContact = { init };
})();
