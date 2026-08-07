(() => {
  'use strict';

  const DB_NAME = 'taccuino-db';
  const DB_VERSION = 1;
  const STORE = 'pages';
  let dbPromise;

  function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB non disponibile in questo browser.'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        let store;
        if (!db.objectStoreNames.contains(STORE)) {
          store = db.createObjectStore(STORE, { keyPath: 'id' });
        } else {
          store = request.transaction.objectStore(STORE);
        }
        if (!store.indexNames.contains('updatedAt')) {
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!store.indexNames.contains('type')) {
          store.createIndex('type', 'type', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Errore apertura archivio.'));
      request.onblocked = () => reject(new Error('Archivio bloccato da un’altra scheda.'));
    });

    return dbPromise;
  }

  function makeId() {
    if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `page-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  async function savePage(page) {
    const db = await openDB();
    const now = new Date().toISOString();
    const record = {
      id: page.id || makeId(),
      title: (page.title || '').trim() || (page.type === 'drawing' ? 'Disegno senza titolo' : 'Appunto senza titolo'),
      type: page.type,
      createdAt: page.createdAt || now,
      updatedAt: now,
      content: page.content || ''
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve(record);
      tx.onerror = () => reject(tx.error || new Error('Salvataggio non riuscito.'));
      tx.onabort = () => reject(tx.error || new Error('Salvataggio annullato.'));
    });
  }

  async function getPage(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Lettura non riuscita.'));
    });
  }

  async function listPages() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      request.onsuccess = () => {
        const rows = request.result || [];
        rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
        resolve(rows);
      };
      request.onerror = () => reject(request.error || new Error('Archivio non leggibile.'));
    });
  }

  async function deletePage(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Eliminazione non riuscita.'));
    });
  }

  async function renamePage(id, title) {
    const page = await getPage(id);
    if (!page) throw new Error('Pagina non trovata.');
    page.title = (title || '').trim() || page.title;
    return savePage(page);
  }

  window.TaccuinoStorage = {
    openDB,
    savePage,
    getPage,
    listPages,
    deletePage,
    renamePage
  };
})();
