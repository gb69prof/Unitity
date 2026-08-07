(function () {
  "use strict";

  const C = window.DeskCommon;
  const limits = { min: .3, max: 3 };
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  const appShell = $("#appShell");
  const viewport = $("#deskViewport");
  const content = $("#deskContent");
  const connectorLayer = $("#connectorLayer");
  const sourcesList = $("#sourcesList");
  const emptyDesk = $("#emptyDesk");
  const saveStatus = $("#saveStatus");
  const toast = $("#toast");
  const viewerElements = {
    dialog: $("#viewerDialog"),
    title: $("#viewerTitle"),
    viewer: $("#viewer"),
    external: $("#externalLink")
  };

  let state = C.emptyState();
  let mode = "move";
  let selectedCardId = null;
  let connectingFrom = null;
  let saveTimer = 0;
  let toastTimer = 0;
  let gesture = null;
  const pointers = new Map();

  function showToast(message, duration = 2600) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), duration);
  }

  function setSaveStatus(kind, label) {
    saveStatus.className = `save-status ${kind}`;
    saveStatus.querySelector("b").textContent = label;
  }

  function scheduleSave() {
    state.updatedAt = new Date().toISOString();
    setSaveStatus("saving", "Salvataggio…");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 420);
  }

  async function saveNow() {
    clearTimeout(saveTimer);
    try {
      await DeskStorage.save(C.serializableState(state));
      setSaveStatus("saved", "Salvato");
    } catch (error) {
      console.error(error);
      setSaveStatus("error", "Non salvato");
      showToast("Spazio locale insufficiente: esporta il desk e alleggerisci immagini o PDF.", 5200);
    }
  }

  function applyTransform() {
    content.style.transform = `translate(${state.view.tx}px, ${state.view.ty}px) scale(${state.view.scale})`;
    $("#zoomLabel").textContent = `${Math.round(state.view.scale * 100)}%`;
  }

  function updateStats() {
    $("#documentStats").textContent = `${state.cards.length} card · ${state.sources.length} fonti`;
    emptyDesk.hidden = state.cards.length > 0;
  }

  function sourceThumb(source) {
    const thumb = document.createElement("div");
    thumb.className = "source-thumb";
    if (source.type === "image" && source.dataUrl) {
      const image = new Image();
      image.src = source.dataUrl;
      image.alt = "";
      thumb.appendChild(image);
    } else {
      thumb.textContent = C.sourceSymbol(source.type);
    }
    return thumb;
  }

  function renderSources() {
    sourcesList.replaceChildren();
    if (!state.sources.length) {
      const empty = document.createElement("div");
      empty.className = "empty-sources";
      empty.textContent = "Il deposito è vuoto. Aggiungi un'immagine, un PDF, un testo o un link.";
      sourcesList.appendChild(empty);
      updateStats();
      return;
    }
    state.sources.forEach(source => {
      const item = document.createElement("article");
      item.className = "source-item";
      item.appendChild(sourceThumb(source));

      const meta = document.createElement("div");
      meta.className = "source-meta";
      const title = document.createElement("div");
      title.className = "source-title";
      title.textContent = source.title;
      const type = document.createElement("div");
      type.className = "source-type";
      type.textContent = C.sourceLabel(source.type);
      const actions = document.createElement("div");
      actions.className = "source-actions";

      const add = document.createElement("button");
      add.className = "button primary";
      add.type = "button";
      add.textContent = "＋ Card";
      add.addEventListener("click", () => addCardFromSource(source.id));
      const open = document.createElement("button");
      open.className = "button";
      open.type = "button";
      open.textContent = "Apri";
      open.addEventListener("click", () => C.openViewer(source, viewerElements));
      const remove = document.createElement("button");
      remove.className = "button danger";
      remove.type = "button";
      remove.textContent = "Elimina";
      remove.addEventListener("click", () => removeSource(source.id));
      actions.append(add, open, remove);
      meta.append(title, type, actions);
      item.appendChild(meta);
      sourcesList.appendChild(item);
    });
    updateStats();
  }

  function removeSource(sourceId) {
    const dependent = state.cards.filter(card => card.sourceId === sourceId);
    const detail = dependent.length ? ` Saranno eliminate anche ${dependent.length} card collegate.` : "";
    if (!confirm(`Eliminare questa fonte?${detail}`)) return;
    const removedIds = new Set(dependent.map(card => card.id));
    state.sources = state.sources.filter(source => source.id !== sourceId);
    state.cards = state.cards.filter(card => card.sourceId !== sourceId);
    state.connectors = state.connectors.filter(link => !removedIds.has(link.a) && !removedIds.has(link.b));
    renderSources();
    renderCards();
    scheduleSave();
  }

  function cardElement(card) {
    const source = C.sourceForCard(state, card);
    const element = document.createElement("article");
    element.className = "desk-card";
    element.dataset.id = card.id;
    element.style.left = `${card.x}px`;
    element.style.top = `${card.y}px`;
    element.style.width = `${card.w}px`;
    element.style.height = `${card.h}px`;
    element.classList.toggle("selected", card.id === selectedCardId);

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
    const controls = document.createElement("div");
    controls.className = "card-controls";
    const open = document.createElement("button");
    open.className = "card-control";
    open.type = "button";
    open.title = "Apri";
    open.setAttribute("aria-label", `Apri ${card.title}`);
    open.textContent = "↗";
    open.addEventListener("pointerdown", event => event.stopPropagation());
    open.addEventListener("click", event => {
      event.stopPropagation();
      C.openViewer(source, viewerElements);
    });
    controls.appendChild(open);
    header.append(titleWrap, controls);

    const body = document.createElement("div");
    body.className = "card-body";
    const preview = document.createElement("div");
    preview.className = "card-preview";
    C.renderPreview(preview, source);
    body.appendChild(preview);
    const handle = document.createElement("div");
    handle.className = "resize-handle";
    handle.setAttribute("aria-hidden", "true");
    element.append(header, body, handle);

    header.addEventListener("pointerdown", event => startCardGesture(event, card.id, "move"));
    handle.addEventListener("pointerdown", event => startCardGesture(event, card.id, "resize"));
    element.addEventListener("click", event => {
      if (event.target.closest("button")) return;
      if (mode === "connect") connectCard(card.id);
      else if (mode === "delete") deleteCard(card.id);
      else selectCard(card.id);
    });
    element.addEventListener("dblclick", event => {
      event.stopPropagation();
      if (mode === "move" || mode === "pan") C.openViewer(source, viewerElements);
    });
    return element;
  }

  function renderCards() {
    content.querySelectorAll(".desk-card").forEach(card => card.remove());
    state.cards.forEach(card => content.appendChild(cardElement(card)));
    renderConnectors();
    updateStats();
  }

  function renderConnectors() {
    connectorLayer.replaceChildren();
    state.connectors.forEach(link => {
      const cardA = state.cards.find(card => card.id === link.a);
      const cardB = state.cards.find(card => card.id === link.b);
      if (!cardA || !cardB) return;
      const pathData = C.connectorPath(cardA, cardB);
      const glow = document.createElementNS("http://www.w3.org/2000/svg", "path");
      glow.setAttribute("d", pathData);
      glow.setAttribute("fill", "none");
      glow.setAttribute("stroke", link.color);
      glow.setAttribute("stroke-width", "14");
      glow.setAttribute("stroke-linecap", "round");
      glow.setAttribute("opacity", ".12");
      const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
      line.setAttribute("d", pathData);
      line.setAttribute("fill", "none");
      line.setAttribute("stroke", link.color);
      line.setAttribute("stroke-width", "5");
      line.setAttribute("stroke-linecap", "round");
      line.classList.add("connector-hit");
      line.addEventListener("click", event => {
        event.stopPropagation();
        if (mode !== "delete") { showToast("Passa a Cancella per rimuovere questa linea."); return; }
        state.connectors = state.connectors.filter(item => item.id !== link.id);
        renderConnectors();
        scheduleSave();
      });
      connectorLayer.append(glow, line);
    });
  }

  function selectCard(cardId) {
    selectedCardId = cardId;
    content.querySelectorAll(".desk-card").forEach(element => element.classList.toggle("selected", element.dataset.id === cardId));
  }

  function addCardFromSource(sourceId) {
    const source = state.sources.find(item => item.id === sourceId);
    if (!source) return;
    const rect = viewport.getBoundingClientRect();
    const x = (rect.width / 2 - state.view.tx) / state.view.scale;
    const y = (rect.height / 2 - state.view.ty) / state.view.scale;
    const countOffset = (state.cards.length % 6) * 18;
    const width = source.type === "text" ? 350 : 370;
    const height = source.type === "image" ? 270 : source.type === "pdf" ? 290 : 245;
    const card = {
      id: C.uid(), sourceId, type: source.type, title: source.title,
      x: C.clamp(x - width / 2 + countOffset, 0, C.WORLD_SIZE - width),
      y: C.clamp(y - height / 2 + countOffset, 0, C.WORLD_SIZE - height),
      w: width, h: height
    };
    state.cards.push(card);
    selectedCardId = card.id;
    renderCards();
    scheduleSave();
    showToast("Card aggiunta al centro del desk.");
  }

  function deleteCard(cardId) {
    state.cards = state.cards.filter(card => card.id !== cardId);
    state.connectors = state.connectors.filter(link => link.a !== cardId && link.b !== cardId);
    if (selectedCardId === cardId) selectedCardId = null;
    renderCards();
    scheduleSave();
    showToast("Card eliminata. La fonte resta nel deposito.");
  }

  function connectCard(cardId) {
    if (!connectingFrom) {
      connectingFrom = cardId;
      selectCard(cardId);
      showToast("Ora tocca la seconda card.");
      return;
    }
    if (connectingFrom === cardId) {
      connectingFrom = null;
      selectedCardId = null;
      renderCards();
      showToast("Connessione annullata.");
      return;
    }
    const duplicate = state.connectors.some(link => (link.a === connectingFrom && link.b === cardId) || (link.a === cardId && link.b === connectingFrom));
    if (!duplicate) {
      state.connectors.push({ id: C.uid(), a: connectingFrom, b: cardId, color: $("#connectorColor").value });
      scheduleSave();
      showToast("Collegamento creato.");
    } else showToast("Queste card sono già collegate.");
    connectingFrom = null;
    selectedCardId = null;
    renderCards();
  }

  function startCardGesture(event, cardId, kind) {
    if (mode !== "move" || event.button > 0) return;
    event.preventDefault();
    event.stopPropagation();
    const card = state.cards.find(item => item.id === cardId);
    if (!card) return;
    selectCard(cardId);
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const start = { x: event.clientX, y: event.clientY, cardX: card.x, cardY: card.y, width: card.w, height: card.h };
    const move = moveEvent => {
      if (moveEvent.pointerId !== event.pointerId) return;
      moveEvent.preventDefault();
      const dx = (moveEvent.clientX - start.x) / state.view.scale;
      const dy = (moveEvent.clientY - start.y) / state.view.scale;
      if (kind === "move") {
        card.x = C.clamp(start.cardX + dx, 0, C.WORLD_SIZE - 100);
        card.y = C.clamp(start.cardY + dy, 0, C.WORLD_SIZE - 80);
      } else {
        card.w = C.clamp(start.width + dx, 180, 1200);
        card.h = C.clamp(start.height + dy, 120, 1000);
      }
      const element = content.querySelector(`.desk-card[data-id="${cardId}"]`);
      if (element) {
        element.style.left = `${card.x}px`;
        element.style.top = `${card.y}px`;
        element.style.width = `${card.w}px`;
        element.style.height = `${card.h}px`;
      }
      renderConnectors();
    };
    const end = endEvent => {
      if (endEvent.pointerId !== event.pointerId) return;
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
      scheduleSave();
    };
    target.addEventListener("pointermove", move, { passive: false });
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
  }

  function setMode(nextMode) {
    mode = nextMode;
    connectingFrom = null;
    selectedCardId = null;
    $$(".mode-button").forEach(button => button.classList.toggle("active", button.dataset.mode === mode));
    viewport.classList.toggle("pan-cursor", mode === "pan");
    const hints = {
      move: "Trascina l'intestazione di una card. Tocca due volte una card per aprirla.",
      pan: "Trascina il fondo per spostarti. Usa due dita per lo zoom.",
      connect: "Tocca due card in successione per collegarle.",
      delete: "Tocca una card o una linea per eliminarla. Le fonti restano nel deposito."
    };
    $("#modeHint").textContent = hints[mode];
    renderCards();
  }

  function zoom(factor, clientX, clientY) {
    state.view = C.zoomAt(state.view, viewport, state.view.scale * factor, clientX, clientY, limits);
    applyTransform();
    scheduleSave();
  }

  function startPinch() {
    if (pointers.size < 2) return;
    const [a, b] = Array.from(pointers.values()).slice(0, 2);
    const rect = viewport.getBoundingClientRect();
    const mid = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
    gesture = {
      type: "pinch",
      distance: Math.hypot(b.x - a.x, b.y - a.y),
      scale: state.view.scale,
      anchorX: (mid.x - state.view.tx) / state.view.scale,
      anchorY: (mid.y - state.view.ty) / state.view.scale
    };
  }

  viewport.addEventListener("pointerdown", event => {
    if (event.button > 0 || event.target.closest(".desk-card")) return;
    viewport.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) startPinch();
    else if (pointers.size === 1 && mode === "pan") {
      gesture = { type: "pan", x: event.clientX, y: event.clientY, tx: state.view.tx, ty: state.view.ty };
    }
  });

  viewport.addEventListener("pointermove", event => {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!gesture) return;
    if (gesture.type === "pan" && pointers.size === 1) {
      state.view.tx = gesture.tx + event.clientX - gesture.x;
      state.view.ty = gesture.ty + event.clientY - gesture.y;
      applyTransform();
    } else if (gesture.type === "pinch" && pointers.size >= 2) {
      const [a, b] = Array.from(pointers.values()).slice(0, 2);
      const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      const rect = viewport.getBoundingClientRect();
      const midX = (a.x + b.x) / 2 - rect.left;
      const midY = (a.y + b.y) / 2 - rect.top;
      const scale = C.clamp(gesture.scale * distance / Math.max(1, gesture.distance), limits.min, limits.max);
      state.view = { scale, tx: midX - gesture.anchorX * scale, ty: midY - gesture.anchorY * scale };
      applyTransform();
    }
  }, { passive: false });

  function endViewportPointer(event) {
    pointers.delete(event.pointerId);
    if (gesture && gesture.type === "pinch" && pointers.size === 1 && mode === "pan") {
      const remaining = Array.from(pointers.values())[0];
      gesture = { type: "pan", x: remaining.x, y: remaining.y, tx: state.view.tx, ty: state.view.ty };
    } else if (pointers.size < 2) gesture = null;
    scheduleSave();
  }
  viewport.addEventListener("pointerup", endViewportPointer);
  viewport.addEventListener("pointercancel", endViewportPointer);
  viewport.addEventListener("wheel", event => {
    event.preventDefault();
    zoom(event.deltaY < 0 ? 1.09 : .92, event.clientX, event.clientY);
  }, { passive: false });
  viewport.addEventListener("click", event => {
    if (event.target.closest(".desk-card") || event.target.closest(".connector-hit")) return;
    connectingFrom = null;
    selectedCardId = null;
    renderCards();
  });

  function fitToView(notify = true) {
    if (!state.cards.length) { if (notify) showToast("Non ci sono card da adattare."); return; }
    state.view = C.fitView(state.cards, viewport, limits);
    applyTransform();
    scheduleSave();
    if (notify) showToast("Tutte le card sono ora visibili.");
  }

  async function addFile(file, type) {
    if (!file) return;
    const hardLimit = 80 * 1024 * 1024;
    const softLimit = 25 * 1024 * 1024;
    if (file.size > hardLimit) { showToast("Il file supera 80 MB: su iPad non sarebbe affidabile.", 4500); return; }
    if (file.size > softLimit && !confirm("Il file supera 25 MB e potrebbe rallentare Safari. Vuoi aggiungerlo comunque?")) return;
    setSaveStatus("saving", "Importazione…");
    try {
      const source = { id: C.uid(), type, title: file.name.slice(0, 120), mime: file.type, size: file.size };
      if (type === "image") source.dataUrl = await C.fileToDataUrl(file);
      else source.pdfBase64 = await C.fileToBase64(file);
      state.sources.unshift(source);
      renderSources();
      addCardFromSource(source.id);
    } catch (error) {
      console.error(error);
      setSaveStatus("error", "Errore");
      showToast("Non sono riuscita a leggere questo file.", 4200);
    }
  }

  $("#imageInput").addEventListener("change", event => { const file = event.target.files[0]; event.target.value = ""; addFile(file, "image"); });
  $("#pdfInput").addEventListener("change", event => { const file = event.target.files[0]; event.target.value = ""; addFile(file, "pdf"); });

  const sourceDialog = $("#sourceDialog");
  let dialogKind = "text";
  function openSourceDialog(kind) {
    dialogKind = kind;
    const isText = kind === "text";
    $("#dialogTitle").textContent = isText ? "Aggiungi testo" : "Aggiungi link";
    $("#textField").hidden = !isText;
    $("#urlField").hidden = isText;
    $("#typeField").hidden = isText;
    $("#sourceTitle").value = "";
    $("#sourceText").value = "";
    $("#sourceUrl").value = "";
    sourceDialog.showModal();
    setTimeout(() => $("#sourceTitle").focus(), 30);
  }
  $("#openTextDialog").addEventListener("click", () => openSourceDialog("text"));
  $("#openLinkDialog").addEventListener("click", () => openSourceDialog("link"));
  $("#sourceForm").addEventListener("submit", event => {
    if (event.submitter && event.submitter.value === "cancel") return;
    event.preventDefault();
    const title = $("#sourceTitle").value.trim();
    if (!title) { $("#sourceTitle").focus(); return; }
    const source = { id: C.uid(), title: title.slice(0, 120) };
    if (dialogKind === "text") {
      source.type = "text";
      source.text = $("#sourceText").value;
    } else {
      let url = $("#sourceUrl").value.trim();
      if (!url) { $("#sourceUrl").focus(); return; }
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      try { new URL(url); } catch (_) { showToast("L'indirizzo non è valido."); return; }
      source.type = $("#sourceType").value;
      source.url = url;
    }
    state.sources.unshift(source);
    sourceDialog.close();
    renderSources();
    addCardFromSource(source.id);
  });

  $("#closeViewer").addEventListener("click", () => viewerElements.dialog.close());
  viewerElements.dialog.addEventListener("click", event => { if (event.target === viewerElements.dialog) viewerElements.dialog.close(); });
  viewerElements.dialog.addEventListener("close", () => viewerElements.viewer.replaceChildren());

  $("#exportButton").addEventListener("click", () => {
    const payload = C.serializableState(state);
    C.downloadJson(`desk-${new Date().toISOString().slice(0, 10)}.json`, payload);
    showToast("Esportazione completa: card, fonti e vista.");
  });

  $("#importInput").addEventListener("change", async event => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const imported = C.normalizeState(JSON.parse(await file.text()));
      if ((state.cards.length || state.sources.length) && !confirm("Sostituire il desk corrente con quello importato?")) return;
      state = imported;
      selectedCardId = null;
      connectingFrom = null;
      renderSources();
      renderCards();
      applyTransform();
      await saveNow();
      showToast("Desk importato. Anche il vecchio formato è stato aggiornato.", 3800);
    } catch (error) {
      console.error(error);
      showToast(error.message || "Importazione non riuscita.", 4200);
    }
  });

  $("#newButton").addEventListener("click", async () => {
    if (!confirm("Azzerare desk e deposito? Il lavoro corrente sarà rimosso dal dispositivo; puoi prima esportarlo.")) return;
    state = C.emptyState();
    await DeskStorage.clear().catch(() => {});
    renderSources();
    renderCards();
    applyTransform();
    scheduleSave();
    showToast("Nuovo desk creato.");
  });
  $("#clearDeskButton").addEventListener("click", () => {
    if (!state.cards.length) { showToast("Il desk è già vuoto."); return; }
    if (!confirm("Eliminare tutte le card e i collegamenti? Le fonti resteranno nel deposito.")) return;
    state.cards = [];
    state.connectors = [];
    selectedCardId = null;
    connectingFrom = null;
    renderCards();
    scheduleSave();
    showToast("Desk svuotato. Le fonti sono ancora disponibili.");
  });
  $("#clearConnectorsButton").addEventListener("click", () => {
    if (!state.connectors.length) { showToast("Non ci sono collegamenti."); return; }
    if (!confirm("Eliminare tutti i collegamenti?")) return;
    state.connectors = [];
    renderConnectors();
    scheduleSave();
    showToast("Collegamenti eliminati.");
  });

  function toggleSidebar(forceCollapsed) {
    const collapsed = typeof forceCollapsed === "boolean"
      ? (appShell.classList.toggle("sidebar-collapsed", forceCollapsed), forceCollapsed)
      : appShell.classList.toggle("sidebar-collapsed");
    $("#sidebarToggle").setAttribute("aria-expanded", String(!collapsed));
    setTimeout(() => { applyTransform(); }, 220);
  }
  $("#sidebarToggle").addEventListener("click", () => {
    toggleSidebar();
  });
  $("#sidebarClose").addEventListener("click", () => toggleSidebar(true));
  $$(".mode-button").forEach(button => button.addEventListener("click", () => setMode(button.dataset.mode)));
  $("#zoomIn").addEventListener("click", () => zoom(1.15));
  $("#zoomOut").addEventListener("click", () => zoom(.87));
  $("#fitButton").addEventListener("click", () => fitToView());
  $("#resetViewButton").addEventListener("click", () => { state.view = C.clone(C.DEFAULT_VIEW); applyTransform(); scheduleSave(); showToast("Vista centrata."); });

  async function init() {
    if (innerWidth <= 900) {
      appShell.classList.add("sidebar-collapsed");
      $("#sidebarToggle").setAttribute("aria-expanded", "false");
    }
    try {
      const saved = await DeskStorage.load();
      if (saved) state = C.normalizeState(saved);
      setSaveStatus("saved", saved ? "Recuperato" : "Pronto");
    } catch (error) {
      console.warn(error);
      setSaveStatus("error", "Archivio non disponibile");
    }
    renderSources();
    renderCards();
    applyTransform();
    setMode("move");
    showToast(state.cards.length ? "Ultimo desk recuperato automaticamente." : "Desk pronto. Aggiungi la prima fonte.");
  }

  window.addEventListener("pagehide", () => { if (saveTimer) saveNow(); });
  init();
})();
