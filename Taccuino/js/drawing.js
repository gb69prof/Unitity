(() => {
  'use strict';

  class DrawingPad {
    constructor(canvas, shell) {
      this.canvas = canvas;
      this.shell = shell;
      this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
      this.color = '#111111';
      this.width = 2;
      this.tool = 'pen';
      this.activePointerId = null;
      this.lastPoint = null;
      this.undoStack = [];
      this.redoStack = [];
      this.maxHistory = 30;
      this.dirty = false;
      this.onHistoryChange = null;
      this.onDirtyChange = null;
      this.resizeTimer = null;

      this.bindPointerEvents();
      this.resizeObserver = new ResizeObserver(() => this.queueResize());
      this.resizeObserver.observe(this.shell);
      this.resize(true);
    }

    bindPointerEvents() {
      this.canvas.addEventListener('pointerdown', (event) => this.pointerDown(event));
      this.canvas.addEventListener('pointermove', (event) => this.pointerMove(event));
      this.canvas.addEventListener('pointerup', (event) => this.pointerUp(event));
      this.canvas.addEventListener('pointercancel', (event) => this.pointerCancel(event));
      this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    }

    queueResize() {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => this.resize(false), 80);
    }

    resize(forceBlank = false) {
      const rect = this.canvas.getBoundingClientRect();
      const cssWidth = Math.max(1, Math.round(rect.width));
      const cssHeight = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const targetWidth = Math.max(1, Math.round(cssWidth * dpr));
      const targetHeight = Math.max(1, Math.round(cssHeight * dpr));

      if (!forceBlank && this.canvas.width === targetWidth && this.canvas.height === targetHeight) return;

      let snapshot = null;
      if (!forceBlank && this.canvas.width > 1 && this.canvas.height > 1) {
        snapshot = document.createElement('canvas');
        snapshot.width = this.canvas.width;
        snapshot.height = this.canvas.height;
        snapshot.getContext('2d', { alpha: false }).drawImage(this.canvas, 0, 0);
      }

      this.canvas.width = targetWidth;
      this.canvas.height = targetHeight;
      this.ctx = this.canvas.getContext('2d', { alpha: false, desynchronized: true });
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(0, 0, cssWidth, cssHeight);

      if (snapshot) {
        this.ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, cssWidth, cssHeight);
      }
    }

    pointerDown(event) {
      if (this.activePointerId !== null) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();

      this.pushUndoState();
      this.redoStack.length = 0;
      this.notifyHistory();

      this.activePointerId = event.pointerId;
      try { this.canvas.setPointerCapture(event.pointerId); } catch (_) {}
      this.lastPoint = this.pointFromEvent(event);
      this.drawSegment(this.lastPoint, this.lastPoint, event);
    }

    pointerMove(event) {
      if (event.pointerId !== this.activePointerId || !this.lastPoint) return;
      event.preventDefault();
      const events = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [event];
      for (const moveEvent of events) {
        const point = this.pointFromEvent(moveEvent);
        this.drawSegment(this.lastPoint, point, moveEvent);
        this.lastPoint = point;
      }
    }

    pointerUp(event) {
      if (event.pointerId !== this.activePointerId) return;
      event.preventDefault();
      this.finishStroke(event.pointerId, true);
    }

    pointerCancel(event) {
      if (event.pointerId !== this.activePointerId) return;
      this.finishStroke(event.pointerId, true);
    }

    finishStroke(pointerId, changed) {
      try { this.canvas.releasePointerCapture(pointerId); } catch (_) {}
      this.activePointerId = null;
      this.lastPoint = null;
      if (changed) this.setDirty(true);
      this.notifyHistory();
    }

    pointFromEvent(event) {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    }

    drawSegment(from, to, event) {
      const pressure = event.pointerType === 'pen' && event.pressure > 0 ? event.pressure : 0.5;
      const pressureFactor = event.pointerType === 'pen' ? (0.78 + pressure * 0.44) : 1;
      const lineWidth = (this.tool === 'eraser' ? this.width * 3.2 : this.width) * pressureFactor;

      this.ctx.save();
      this.ctx.strokeStyle = this.tool === 'eraser' ? '#ffffff' : this.color;
      this.ctx.fillStyle = this.ctx.strokeStyle;
      this.ctx.lineWidth = lineWidth;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.beginPath();
      this.ctx.moveTo(from.x, from.y);
      this.ctx.lineTo(to.x, to.y);
      this.ctx.stroke();
      if (from.x === to.x && from.y === to.y) {
        this.ctx.beginPath();
        this.ctx.arc(to.x, to.y, Math.max(0.8, lineWidth / 2), 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    }

    setColor(color) { this.color = color; }
    setWidth(width) { this.width = Number(width) || 2; }
    setTool(tool) { this.tool = tool === 'eraser' ? 'eraser' : 'pen'; }

    pushUndoState() {
      this.undoStack.push(this.snapshot());
      if (this.undoStack.length > this.maxHistory) this.undoStack.shift();
    }

    snapshot() {
      return this.canvas.toDataURL('image/png');
    }

    async applySnapshot(dataUrl) {
      const image = await this.loadImage(dataUrl);
      const rect = this.canvas.getBoundingClientRect();
      this.ctx.save();
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(0, 0, rect.width, rect.height);
      this.ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, rect.width, rect.height);
      this.ctx.restore();
    }

    async undo() {
      if (!this.undoStack.length || this.activePointerId !== null) return;
      const previous = this.undoStack.pop();
      this.redoStack.push(this.snapshot());
      await this.applySnapshot(previous);
      this.setDirty(true);
      this.notifyHistory();
    }

    async redo() {
      if (!this.redoStack.length || this.activePointerId !== null) return;
      const next = this.redoStack.pop();
      this.undoStack.push(this.snapshot());
      await this.applySnapshot(next);
      this.setDirty(true);
      this.notifyHistory();
    }

    clear(pushHistory = true) {
      if (pushHistory) {
        this.pushUndoState();
        this.redoStack.length = 0;
      }
      const rect = this.canvas.getBoundingClientRect();
      this.ctx.save();
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(0, 0, rect.width, rect.height);
      this.ctx.restore();
      this.setDirty(true);
      this.notifyHistory();
    }

    newPage() {
      this.undoStack.length = 0;
      this.redoStack.length = 0;
      this.clear(false);
      this.setDirty(false);
      this.notifyHistory();
    }

    async load(dataUrl) {
      this.undoStack.length = 0;
      this.redoStack.length = 0;
      if (!dataUrl) {
        this.newPage();
        return;
      }
      await this.applySnapshot(dataUrl);
      this.setDirty(false);
      this.notifyHistory();
    }

    loadImage(src) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Immagine del disegno non leggibile.'));
        image.src = src;
      });
    }

    exportJpeg(quality = 0.92) {
      const output = document.createElement('canvas');
      output.width = this.canvas.width;
      output.height = this.canvas.height;
      const out = output.getContext('2d', { alpha: false });
      out.fillStyle = '#ffffff';
      out.fillRect(0, 0, output.width, output.height);
      out.drawImage(this.canvas, 0, 0);
      return output.toDataURL('image/jpeg', quality);
    }

    setDirty(value) {
      this.dirty = Boolean(value);
      if (typeof this.onDirtyChange === 'function') this.onDirtyChange(this.dirty);
    }

    notifyHistory() {
      if (typeof this.onHistoryChange === 'function') {
        this.onHistoryChange({ canUndo: this.undoStack.length > 0, canRedo: this.redoStack.length > 0 });
      }
    }
  }

  window.DrawingPad = DrawingPad;
})();
