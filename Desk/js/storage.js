(function () {
  "use strict";

  const DB_NAME = "gbprof-desk";
  const DB_VERSION = 1;
  const STORE = "documents";
  const CURRENT_KEY = "current";

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB non disponibile"));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Apertura archivio non riuscita"));
    });
  }

  async function withStore(mode, operation) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const store = transaction.objectStore(STORE);
      let request;
      let result;
      try { request = operation(store); }
      catch (error) { db.close(); reject(error); return; }
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => reject(request.error || new Error("Operazione archivio non riuscita"));
      transaction.oncomplete = () => { db.close(); resolve(result); };
      transaction.onerror = () => { db.close(); reject(transaction.error || new Error("Scrittura non riuscita")); };
      transaction.onabort = () => { db.close(); reject(transaction.error || new Error("Scrittura interrotta")); };
    });
  }

  window.DeskStorage = {
    load: () => withStore("readonly", store => store.get(CURRENT_KEY)),
    save: document => withStore("readwrite", store => store.put(document, CURRENT_KEY)),
    clear: () => withStore("readwrite", store => store.delete(CURRENT_KEY))
  };
})();
