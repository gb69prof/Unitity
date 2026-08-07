(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const state = {
    noteId: null,
    noteCreatedAt: null,
    noteDirty: false,
    drawingId: null,
    drawingCreatedAt: null
  };

  let pad;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    pad = new window.DrawingPad($('#drawingCanvas'), $('#canvasShell'));
    pad.onHistoryChange = ({ canUndo, canRedo }) => {
      $('#undoBtn').disabled = !canUndo;
      $('#redoBtn').disabled = !canRedo;
    };
    pad.onDirtyChange = (dirty) => setDrawingStatus(dirty ? 'Modifiche non salvate' : '');
    pad.notifyHistory();

    bindNavigation();
    bindNotes();
    bindDrawing();
    bindArchive();
    registerServiceWorker();

    try {
      await window.TaccuinoStorage.openDB();
    } catch (error) {
      setNoteStatus(error.message);
    }
  }

  function bindNavigation() {
    $$('.tab').forEach((button) => {
      button.addEventListener('click', () => switchView(button.dataset.view));
    });
  }

  function switchView(name) {
    const views = {
      notes: $('#notesView'),
      drawing: $('#drawingView'),
      archive: $('#archiveView')
    };
    if (!views[name]) return;

    Object.entries(views).forEach(([key, view]) => {
      const active = key === name;
      view.hidden = !active;
      view.classList.toggle('active', active);
    });
    $$('.tab').forEach((button) => {
      const active = button.dataset.view === name;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    if (name === 'drawing') {
      requestAnimationFrame(() => pad.resize(false));
    } else if (name === 'archive') {
      renderArchive();
    }
  }

  function bindNotes() {
    $('#noteText').addEventListener('input', () => {
      state.noteDirty = true;
      setNoteStatus('Modifiche non salvate');
    });
    $('#noteTitle').addEventListener('input', () => {
      state.noteDirty = true;
      setNoteStatus('Modifiche non salvate');
    });
    $('#saveNoteBtn').addEventListener('click', saveNote);
    $('#newNoteBtn').addEventListener('click', newNote);
    $('#exportTxtBtn').addEventListener('click', exportTxt);
  }

  async function saveNote() {
    const content = $('#noteText').value;
    const record = await window.TaccuinoStorage.savePage({
      id: state.noteId,
      createdAt: state.noteCreatedAt,
      title: $('#noteTitle').value,
      type: 'text',
      content
    });
    state.noteId = record.id;
    state.noteCreatedAt = record.createdAt;
    state.noteDirty = false;
    $('#noteTitle').value = record.title;
    setNoteStatus(`Salvato ${formatTime(record.updatedAt)}`);
  }

  function newNote() {
    if (state.noteDirty && !window.confirm('Creare un nuovo appunto e perdere le modifiche non salvate?')) return;
    state.noteId = null;
    state.noteCreatedAt = null;
    state.noteDirty = false;
    $('#noteTitle').value = '';
    $('#noteText').value = '';
    setNoteStatus('');
    $('#noteText').focus({ preventScroll: true });
  }

  function exportTxt() {
    const text = $('#noteText').value;
    const title = $('#noteTitle').value.trim() || defaultExportName('appunto');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${sanitizeFilename(title)}.txt`);
    setNoteStatus('File TXT preparato');
  }

  function bindDrawing() {
    $$('.color-dot').forEach((button) => {
      button.addEventListener('click', () => {
        $$('.color-dot').forEach((b) => b.classList.remove('selected'));
        button.classList.add('selected');
        pad.setColor(button.dataset.color);
        setTool('pen');
      });
    });

    $$('.widths .tool-btn').forEach((button) => {
      button.addEventListener('click', () => {
        $$('.widths .tool-btn').forEach((b) => b.classList.remove('selected'));
        button.classList.add('selected');
        pad.setWidth(button.dataset.width);
      });
    });

    $('#penBtn').addEventListener('click', () => setTool('pen'));
    $('#eraserBtn').addEventListener('click', () => setTool('eraser'));
    $('#undoBtn').addEventListener('click', () => pad.undo());
    $('#redoBtn').addEventListener('click', () => pad.redo());
    $('#clearCanvasBtn').addEventListener('click', () => {
      if (window.confirm('Cancellare completamente il foglio?')) pad.clear(true);
    });
    $('#newDrawingBtn').addEventListener('click', newDrawing);
    $('#saveDrawingBtn').addEventListener('click', saveDrawing);
    $('#exportJpgBtn').addEventListener('click', exportJpg);
    $('#drawingTitle').addEventListener('input', () => pad.setDirty(true));
  }

  function setTool(tool) {
    pad.setTool(tool);
    const pen = tool === 'pen';
    $('#penBtn').classList.toggle('selected', pen);
    $('#eraserBtn').classList.toggle('selected', !pen);
    $('#penBtn').setAttribute('aria-pressed', String(pen));
    $('#eraserBtn').setAttribute('aria-pressed', String(!pen));
  }

  async function saveDrawing() {
    const record = await window.TaccuinoStorage.savePage({
      id: state.drawingId,
      createdAt: state.drawingCreatedAt,
      title: $('#drawingTitle').value,
      type: 'drawing',
      content: pad.snapshot()
    });
    state.drawingId = record.id;
    state.drawingCreatedAt = record.createdAt;
    $('#drawingTitle').value = record.title;
    pad.setDirty(false);
    setDrawingStatus(`Salvato ${formatTime(record.updatedAt)}`);
  }

  function newDrawing() {
    if (pad.dirty && !window.confirm('Creare un nuovo disegno e perdere le modifiche non salvate?')) return;
    state.drawingId = null;
    state.drawingCreatedAt = null;
    $('#drawingTitle').value = '';
    pad.newPage();
    setDrawingStatus('');
  }

  function exportJpg() {
    const title = $('#drawingTitle').value.trim() || defaultExportName('taccuino');
    const dataUrl = pad.exportJpeg(0.92);
    downloadDataUrl(dataUrl, `${sanitizeFilename(title)}.jpg`);
    setDrawingStatus('File JPG preparato');
  }

  function bindArchive() {
    $('#refreshArchiveBtn').addEventListener('click', renderArchive);
  }

  async function renderArchive() {
    const list = $('#archiveList');
    const empty = $('#archiveEmpty');
    list.replaceChildren();

    try {
      const pages = await window.TaccuinoStorage.listPages();
      empty.hidden = pages.length !== 0;
      for (const page of pages) {
        const item = document.createElement('article');
        item.className = 'archive-item';

        const info = document.createElement('div');
        const title = document.createElement('p');
        title.className = 'archive-title';
        title.textContent = page.title;
        const meta = document.createElement('div');
        meta.className = 'archive-meta';
        meta.textContent = `${page.type === 'drawing' ? 'Disegno' : 'Testo'} · modificato ${formatDateTime(page.updatedAt)}`;
        info.append(title, meta);

        const actions = document.createElement('div');
        actions.className = 'archive-actions';
        actions.append(
          archiveButton('Apri', () => openPage(page.id)),
          archiveButton('Rinomina', () => renamePage(page.id, page.title)),
          archiveButton('Elimina', () => removePage(page.id, page.title), 'delete')
        );

        item.append(info, actions);
        list.append(item);
      }
    } catch (error) {
      empty.hidden = false;
      empty.textContent = `Archivio non disponibile: ${error.message}`;
    }
  }

  function archiveButton(label, handler, extraClass = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn ${extraClass}`.trim();
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
  }

  async function openPage(id) {
    const page = await window.TaccuinoStorage.getPage(id);
    if (!page) return;

    if (page.type === 'drawing') {
      state.drawingId = page.id;
      state.drawingCreatedAt = page.createdAt;
      $('#drawingTitle').value = page.title;
      switchView('drawing');
      requestAnimationFrame(async () => {
        pad.resize(false);
        await pad.load(page.content);
        setDrawingStatus(`Aperto · ${formatDateTime(page.updatedAt)}`);
      });
    } else {
      state.noteId = page.id;
      state.noteCreatedAt = page.createdAt;
      state.noteDirty = false;
      $('#noteTitle').value = page.title;
      $('#noteText').value = page.content || '';
      switchView('notes');
      setNoteStatus(`Aperto · ${formatDateTime(page.updatedAt)}`);
    }
  }

  async function renamePage(id, currentTitle) {
    const next = window.prompt('Nuovo titolo:', currentTitle);
    if (next === null || !next.trim()) return;
    await window.TaccuinoStorage.renamePage(id, next.trim());
    if (state.noteId === id) $('#noteTitle').value = next.trim();
    if (state.drawingId === id) $('#drawingTitle').value = next.trim();
    await renderArchive();
  }

  async function removePage(id, title) {
    if (!window.confirm(`Eliminare “${title}”?`)) return;
    await window.TaccuinoStorage.deletePage(id);
    if (state.noteId === id) newNoteAfterDelete();
    if (state.drawingId === id) newDrawingAfterDelete();
    await renderArchive();
  }

  function newNoteAfterDelete() {
    state.noteId = null;
    state.noteCreatedAt = null;
    state.noteDirty = false;
    $('#noteTitle').value = '';
    $('#noteText').value = '';
  }

  function newDrawingAfterDelete() {
    state.drawingId = null;
    state.drawingCreatedAt = null;
    $('#drawingTitle').value = '';
    pad.newPage();
  }

  function sanitizeFilename(name) {
    return (name || 'taccuino')
      .normalize('NFKD')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'taccuino';
  }

  function defaultExportName(prefix) {
    const now = new Date();
    const p = (value) => String(value).padStart(2, '0');
    return `${prefix}-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadDataUrl(dataUrl, filename) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function formatTime(iso) {
    return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  }

  function formatDateTime(iso) {
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(new Date(iso));
  }

  function setNoteStatus(text) { $('#noteStatus').textContent = text || ''; }
  function setDrawingStatus(text) { $('#drawingStatus').textContent = text || ''; }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js', { scope: './' }).catch((error) => {
        console.warn('Service worker non registrato:', error);
      });
    }, { once: true });
  }
})();
