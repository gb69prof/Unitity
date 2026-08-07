(function () {
  "use strict";

  const C = window.DeskCommon;
  const limits = { min: .25, max: 3.5 };
  const $ = selector => document.querySelector(selector);
  const viewport = $("#deskViewport");
  const content = $("#deskContent");
  const connectorLayer = $("#connectorLayer");
  const emptyDesk = $("#emptyDesk");
  const toast = $("#toast");
  const viewerElements = {
    dialog: $("#viewerDialog"), title: $("#viewerTitle"), viewer: $("#viewer"), external: $("#externalLink")
  };

  let state = C.emptyState();
  let toastTimer = 0;
  let gesture = null;
  const pointers = new Map();

  function showToast(message, duration = 2700) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), duration);
  }

  function applyTransform() {
    content.style.transform = `translate(${state.view.tx}px, ${state.view.ty}px) scale(${state.view.scale})`;
    $("#zoomLabel").textContent = `${Math.round(state.view.scale * 100)}%`;
  }

  function renderConnectors() {
    connectorLayer.replaceChildren();
    state.connectors.forEach(link => {
      const cardA = state.cards.find(card => card.id === link.a);
      const cardB = state.cards.find(card => card.id === link.b);
      if (!cardA || !cardB) return;
      const d = C.connectorPath(cardA, cardB);
      const glow = document.createElementNS("http://www.w3.org/2000/svg", "path");
      glow.setAttribute("d", d);
      glow.setAttribute("fill", "none");
      glow.setAttribute("stroke", link.color);
      glow.setAttribute("stroke-width", "14");
      glow.setAttribute("stroke-linecap", "round");
      glow.setAttribute("opacity", ".12");
      const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
      line.setAttribute("d", d);
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", link.color);
      line.setAttribute("stroke-width", "5");
      line.setAttribute("stroke-linecap", "round");
      connectorLayer.append(glow, line);
    });
  }

  function renderCards() {
    content.querySelectorAll(".desk-card").forEach(card => card.remove());
    state.cards.forEach(card => {
      const source = C.sourceForCard(state, card);
      const element = document.createElement("article");
      element.className = "desk-card";
      element.style.left = `${card.x}px`;
      element.style.top = `${card.y}px`;
      element.style.width = `${card.w}px`;
      element.style.height = `${card.h}px`;
      element.tabIndex = 0;
      element.setAttribute("role", "button");
      element.setAttribute("aria-label", `Apri ${card.title}`);

      const header = document.createElement("header");
      header.className = "card-header";
      const titleWrap = document.createElement("div");
      titleWrap.className = "card-title-wrap";
      const badge = document.createElement("span");
      badge.className = "card-badge";
      badge.textContent = card.type;
      const title = document.createElement("span");
      title.className = "card-title";
      title.textContent = card.title;
      titleWrap.append(badge, title);
      header.appendChild(titleWrap);
      const body = document.createElement("div");
      body.className = "card-body";
      const preview = document.createElement("div");
      preview.className = "card-preview";
      C.renderPreview(preview, source);
      body.appendChild(preview);
      element.append(header, body);
      element.addEventListener("click", event => { event.stopPropagation(); C.openViewer(source, viewerElements); });
      element.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); C.openViewer(source, viewerElements); }
      });
      content.appendChild(element);
    });
    renderConnectors();
    emptyDesk.hidden = state.cards.length > 0;
  }

  function fitToView(notify = true) {
    if (!state.cards.length) { if (notify) showToast("Nessuna card da adattare."); return; }
    state.view = C.fitView(state.cards, viewport, limits);
    applyTransform();
    if (notify) showToast("Vista adattata.");
  }

  function zoom(factor, clientX, clientY) {
    state.view = C.zoomAt(state.view, viewport, state.view.scale * factor, clientX, clientY, limits);
    applyTransform();
  }

  function startPinch() {
    if (pointers.size < 2) return;
    const [a, b] = Array.from(pointers.values()).slice(0, 2);
    const rect = viewport.getBoundingClientRect();
    const midX = (a.x + b.x) / 2 - rect.left;
    const midY = (a.y + b.y) / 2 - rect.top;
    gesture = {
      type: "pinch",
      distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      scale: state.view.scale,
      anchorX: (midX - state.view.tx) / state.view.scale,
      anchorY: (midY - state.view.ty) / state.view.scale
    };
  }

  viewport.addEventListener("pointerdown", event => {
    if (event.button > 0 || event.target.closest(".desk-card")) return;
    viewport.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) startPinch();
    else gesture = { type: "pan", x: event.clientX, y: event.clientY, tx: state.view.tx, ty: state.view.ty };
  });
  viewport.addEventListener("pointermove", event => {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!gesture) return;
    if (gesture.type === "pan" && pointers.size === 1) {
      state.view.tx = gesture.tx + event.clientX - gesture.x;
      state.view.ty = gesture.ty + event.clientY - gesture.y;
    } else if (gesture.type === "pinch" && pointers.size >= 2) {
      const [a, b] = Array.from(pointers.values()).slice(0, 2);
      const rect = viewport.getBoundingClientRect();
      const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      const scale = C.clamp(gesture.scale * distance / gesture.distance, limits.min, limits.max);
      const midX = (a.x + b.x) / 2 - rect.left;
      const midY = (a.y + b.y) / 2 - rect.top;
      state.view = { scale, tx: midX - gesture.anchorX * scale, ty: midY - gesture.anchorY * scale };
    }
    applyTransform();
  }, { passive: false });
  function endPointer(event) {
    pointers.delete(event.pointerId);
    if (gesture && gesture.type === "pinch" && pointers.size === 1) {
      const remaining = Array.from(pointers.values())[0];
      gesture = { type: "pan", x: remaining.x, y: remaining.y, tx: state.view.tx, ty: state.view.ty };
    } else if (pointers.size < 2) gesture = null;
  }
  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);
  viewport.addEventListener("wheel", event => { event.preventDefault(); zoom(event.deltaY < 0 ? 1.09 : .92, event.clientX, event.clientY); }, { passive: false });

  $("#zoomIn").addEventListener("click", () => zoom(1.15));
  $("#zoomOut").addEventListener("click", () => zoom(.87));
  $("#fitButton").addEventListener("click", () => fitToView());
  $("#closeViewer").addEventListener("click", () => viewerElements.dialog.close());
  viewerElements.dialog.addEventListener("click", event => { if (event.target === viewerElements.dialog) viewerElements.dialog.close(); });
  viewerElements.dialog.addEventListener("close", () => viewerElements.viewer.replaceChildren());
  $("#fullscreenViewer").addEventListener("click", async () => {
    try {
      const shell = viewerElements.dialog.querySelector(".viewer-shell");
      if (!document.fullscreenElement) await shell.requestFullscreen();
      else await document.exitFullscreen();
    } catch (_) { showToast("Schermo intero non disponibile in questo browser."); }
  });

  $("#presentationImport").addEventListener("change", async event => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      state = C.normalizeState(JSON.parse(await file.text()));
      renderCards();
      fitToView(false);
      showToast("Desk importato per la presentazione.");
    } catch (error) {
      console.error(error);
      showToast(error.message || "Importazione non riuscita.", 4200);
    }
  });

  async function init() {
    try {
      const saved = await DeskStorage.load();
      if (saved) state = C.normalizeState(saved);
    } catch (error) { console.warn(error); }
    renderCards();
    applyTransform();
    if (state.cards.length) {
      requestAnimationFrame(() => fitToView(false));
      showToast("Ultimo desk caricato automaticamente.");
    } else showToast("Crea un desk oppure importa un file JSON.");
  }
  init();
})();
