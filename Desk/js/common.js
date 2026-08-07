(function () {
  "use strict";

  const WORLD_SIZE = 8000;
  const DEFAULT_VIEW = Object.freeze({ scale: 1, tx: 60, ty: 60 });

  const clone = value => typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));

  function uid() {
    return self.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : `desk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function emptyState() {
    return {
      version: 2,
      title: "Il mio desk",
      updatedAt: new Date().toISOString(),
      view: clone(DEFAULT_VIEW),
      cards: [],
      connectors: [],
      sources: []
    };
  }

  function safeType(type) {
    return ["image", "pdf", "text", "web", "video"].includes(type) ? type : "text";
  }

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (_) { return ""; }
  }

  function sourceFingerprint(card) {
    return [card.type, card.title, card.url, card.text, card.dataUrl, card.pdfBase64].map(value => value || "").join("¦");
  }

  function sourceFromLegacyCard(card) {
    const source = {
      id: uid(),
      type: safeType(card.type),
      title: String(card.title || card.type || "Fonte").slice(0, 120)
    };
    ["url", "text", "dataUrl", "pdfBase64", "mime", "size"].forEach(key => {
      if (card[key] !== undefined) source[key] = card[key];
    });
    return normalizeSource(source);
  }

  function normalizeSource(source) {
    if (!source || typeof source !== "object") return null;
    const normalized = {
      id: String(source.id || uid()),
      type: safeType(source.type),
      title: String(source.title || source.type || "Fonte").slice(0, 120)
    };
    ["text", "dataUrl", "pdfBase64", "mime"].forEach(key => {
      if (typeof source[key] === "string") normalized[key] = source[key];
    });
    if (typeof source.url === "string" && safeUrl(source.url)) normalized.url = safeUrl(source.url);
    if (Number.isFinite(Number(source.size))) normalized.size = Number(source.size);
    return normalized;
  }

  function normalizeState(payload) {
    if (!payload || typeof payload !== "object" || !Array.isArray(payload.cards)) {
      throw new Error("Il file non contiene un desk valido.");
    }

    const normalized = emptyState();
    normalized.title = String(payload.title || "Il mio desk").slice(0, 120);
    normalized.updatedAt = typeof payload.updatedAt === "string" ? payload.updatedAt : new Date().toISOString();
    normalized.view = {
      scale: clamp(Number(payload.view && payload.view.scale) || 1, .25, 3.5),
      tx: Number(payload.view && payload.view.tx) || 60,
      ty: Number(payload.view && payload.view.ty) || 60
    };

    const sourceMap = new Map();
    if (Array.isArray(payload.sources)) {
      payload.sources.map(normalizeSource).filter(Boolean).forEach(source => sourceMap.set(source.id, source));
    }

    const legacySources = new Map();
    normalized.cards = payload.cards.map(raw => {
      const card = raw && typeof raw === "object" ? raw : {};
      let sourceId = card.sourceId && sourceMap.has(String(card.sourceId)) ? String(card.sourceId) : null;
      if (!sourceId) {
        const fingerprint = sourceFingerprint(card);
        let source = legacySources.get(fingerprint);
        if (!source) {
          source = sourceFromLegacyCard(card);
          legacySources.set(fingerprint, source);
          sourceMap.set(source.id, source);
        }
        sourceId = source.id;
      }
      const source = sourceMap.get(sourceId);
      return {
        id: String(card.id || uid()),
        sourceId,
        type: safeType(card.type || (source && source.type)),
        title: String(card.title || (source && source.title) || "Card").slice(0, 120),
        x: clamp(Number(card.x) || 0, 0, WORLD_SIZE - 100),
        y: clamp(Number(card.y) || 0, 0, WORLD_SIZE - 80),
        w: clamp(Number(card.w) || 360, 180, 1200),
        h: clamp(Number(card.h) || 240, 120, 1000)
      };
    });

    const cardIds = new Set(normalized.cards.map(card => card.id));
    normalized.connectors = (Array.isArray(payload.connectors) ? payload.connectors : [])
      .filter(link => link && cardIds.has(String(link.a)) && cardIds.has(String(link.b)) && String(link.a) !== String(link.b))
      .map(link => ({
        id: String(link.id || uid()),
        a: String(link.a),
        b: String(link.b),
        color: /^#[0-9a-f]{6}$/i.test(link.color || "") ? link.color : "#6ae4ff"
      }));
    normalized.sources = Array.from(sourceMap.values());
    return normalized;
  }

  function serializableState(state) {
    const normalized = normalizeState(state);
    normalized.version = 2;
    normalized.updatedAt = new Date().toISOString();
    return normalized;
  }

  function sourceForCard(state, card) {
    return state.sources.find(source => source.id === card.sourceId) || null;
  }

  function toYouTubeEmbed(url) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes("youtu.be")) {
        const id = parsed.pathname.slice(1).split(/[/?#]/)[0];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (parsed.hostname.includes("youtube.com")) {
        const id = parsed.searchParams.get("v") || (parsed.pathname.startsWith("/shorts/") ? parsed.pathname.split("/shorts/")[1].split(/[/?#]/)[0] : "");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
    } catch (_) {}
    return null;
  }

  function sourceLabel(type) {
    return ({ image: "Immagine", pdf: "PDF", text: "Testo", web: "Pagina web", video: "Video" })[type] || "Fonte";
  }

  function sourceSymbol(type) {
    return ({ image: "▧", pdf: "PDF", text: "¶", web: "↗", video: "▶" })[type] || "•";
  }

  function renderPreview(container, source) {
    container.replaceChildren();
    if (!source) {
      container.textContent = "Fonte non disponibile";
      return;
    }
    if (source.type === "image" && source.dataUrl) {
      const image = new Image();
      image.src = source.dataUrl;
      image.alt = source.title || "Immagine";
      container.appendChild(image);
    } else if (source.type === "text") {
      const snippet = document.createElement("div");
      snippet.className = "snippet";
      snippet.textContent = source.text || "Testo vuoto";
      container.appendChild(snippet);
    } else {
      const symbol = document.createElement("span");
      symbol.textContent = `${sourceSymbol(source.type)}  ${sourceLabel(source.type)}`;
      container.appendChild(symbol);
    }
  }

  function rawPdfUrl(source) {
    return source.pdfBase64 ? `data:application/pdf;base64,${source.pdfBase64}` : "";
  }

  function openViewer(source, elements) {
    const { dialog, title, viewer, external } = elements;
    title.textContent = source ? source.title : "Contenuto";
    viewer.replaceChildren();
    external.hidden = true;
    external.removeAttribute("href");

    if (!source) {
      const message = document.createElement("div");
      message.className = "viewer-message";
      message.textContent = "La fonte collegata a questa card non è disponibile.";
      viewer.appendChild(message);
    } else if (source.type === "image" && source.dataUrl) {
      const image = new Image();
      image.src = source.dataUrl;
      image.alt = source.title;
      viewer.appendChild(image);
    } else if (source.type === "text") {
      const text = document.createElement("article");
      text.className = "viewer-text";
      text.textContent = source.text || "";
      viewer.appendChild(text);
    } else if (source.type === "pdf" && source.pdfBase64) {
      const embed = document.createElement("embed");
      embed.type = "application/pdf";
      embed.src = rawPdfUrl(source);
      viewer.appendChild(embed);
      external.hidden = false;
      external.href = embed.src;
    } else if (source.type === "video" && source.url) {
      const youtube = toYouTubeEmbed(source.url);
      if (youtube) {
        const frame = document.createElement("iframe");
        frame.src = youtube;
        frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        frame.allowFullscreen = true;
        viewer.appendChild(frame);
      } else if (/\.mp4(?:\?.*)?$/i.test(source.url)) {
        const video = document.createElement("video");
        video.src = source.url;
        video.controls = true;
        video.playsInline = true;
        viewer.appendChild(video);
      } else {
        const frame = document.createElement("iframe");
        frame.src = source.url;
        frame.allow = "autoplay; encrypted-media; fullscreen";
        viewer.appendChild(frame);
      }
      external.hidden = false;
      external.href = source.url;
    } else if (source.type === "web" && source.url) {
      const frame = document.createElement("iframe");
      frame.src = source.url;
      frame.referrerPolicy = "no-referrer";
      frame.title = source.title;
      viewer.appendChild(frame);
      external.hidden = false;
      external.href = source.url;
    } else {
      const message = document.createElement("div");
      message.className = "viewer-message";
      message.innerHTML = "<strong>Anteprima non disponibile</strong><span>Il contenuto non è incorporato in questo desk.</span>";
      viewer.appendChild(message);
    }
    dialog.showModal();
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("Lettura del file non riuscita"));
      reader.readAsDataURL(file);
    });
  }

  async function fileToBase64(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    const chunk = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunk) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
    }
    return btoa(binary);
  }

  function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function connectorPath(cardA, cardB) {
    const ax = cardA.x + cardA.w / 2;
    const ay = cardA.y + cardA.h / 2;
    const bx = cardB.x + cardB.w / 2;
    const by = cardB.y + cardB.h / 2;
    const dx = Math.abs(bx - ax);
    const bend = Math.max(60, dx * .35);
    const c1x = ax + (bx > ax ? bend : -bend);
    const c2x = bx - (bx > ax ? bend : -bend);
    return `M ${ax} ${ay} C ${c1x} ${ay}, ${c2x} ${by}, ${bx} ${by}`;
  }

  function fitView(cards, viewport, limits) {
    if (!cards.length) return clone(DEFAULT_VIEW);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    cards.forEach(card => {
      minX = Math.min(minX, card.x);
      minY = Math.min(minY, card.y);
      maxX = Math.max(maxX, card.x + card.w);
      maxY = Math.max(maxY, card.y + card.h);
    });
    const rect = viewport.getBoundingClientRect();
    const padding = Math.min(70, Math.max(28, rect.width * .06));
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const scale = clamp(Math.min((rect.width - padding * 2) / width, (rect.height - padding * 2) / height), limits.min, limits.max);
    return {
      scale,
      tx: rect.width / 2 - (minX + width / 2) * scale,
      ty: rect.height / 2 - (minY + height / 2) * scale
    };
  }

  function zoomAt(view, viewport, nextScale, clientX, clientY, limits) {
    const rect = viewport.getBoundingClientRect();
    const x = clientX === undefined ? rect.width / 2 : clientX - rect.left;
    const y = clientY === undefined ? rect.height / 2 : clientY - rect.top;
    const beforeX = (x - view.tx) / view.scale;
    const beforeY = (y - view.ty) / view.scale;
    const scale = clamp(nextScale, limits.min, limits.max);
    return { scale, tx: x - beforeX * scale, ty: y - beforeY * scale };
  }

  window.DeskCommon = {
    WORLD_SIZE,
    DEFAULT_VIEW,
    uid,
    clamp,
    clone,
    emptyState,
    normalizeState,
    serializableState,
    sourceForCard,
    sourceLabel,
    sourceSymbol,
    renderPreview,
    openViewer,
    fileToDataUrl,
    fileToBase64,
    downloadJson,
    connectorPath,
    fitView,
    zoomAt
  };
})();
