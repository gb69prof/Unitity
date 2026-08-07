# Taccuino

**Taccuino** è una PWA minimale pensata prima di tutto per iPad. Permette di prendere appunti testuali, disegnare con Apple Pencil o dito, conservare più pagine localmente ed esportare appunti in `.txt` e disegni in `.jpg`.

Non usa account, server, cloud, API a pagamento o framework JavaScript.

## Funzioni

- **Appunti**: campo di testo compatibile con la normale scrittura iPadOS e Apple Pencil/Scribble; salvataggio e rinomina; esportazione TXT.
- **Disegno**: canvas Retina con Pointer Events per Apple Pencil, touch e mouse; 4 colori, 3 spessori, gomma, undo, redo e cancellazione con conferma.
- **Archivio**: pagine di testo e disegno in IndexedDB con titolo, tipo, data di creazione e ultima modifica.
- **Offline**: service worker con cache essenziale dopo la prima apertura.
- **Orientamento**: il canvas viene ridimensionato preservando il contenuto esistente.

## Dati e privacy

I dati vengono salvati in **IndexedDB sul dispositivo/browser corrente**. Non vengono inviati a un server. Cancellare i dati del sito o rimuovere i dati di Safari può eliminare l'archivio locale: per i contenuti importanti conviene esportare anche i file TXT/JPG.

## Installazione su iPad

1. Apri con Safari la pagina pubblicata su GitHub Pages.
2. Tocca **Condividi**.
3. Scegli **Aggiungi alla schermata Home**.
4. Avvia **Taccuino** dalla nuova icona.

Dopo una prima apertura online completa, i file essenziali dell'app sono disponibili anche offline.

## GitHub Pages

Il progetto è progettato per vivere nella sottocartella:

`/Unitity/Taccuino/`

Tutti i percorsi di CSS, JavaScript, icone, manifest e service worker sono relativi. Il manifest usa `start_url: "./"` e `scope: "./"`; anche il service worker viene registrato con scope `./`. Non viene quindi presunta la root del dominio.

Per pubblicare il repository `gb69prof/Unitity`:

1. apri **Settings → Pages**;
2. in **Build and deployment** scegli **Deploy from a branch**;
3. seleziona branch `main` e cartella `/(root)`;
4. salva.

L'app sarà raggiungibile all'indirizzo:

`https://gb69prof.github.io/Unitity/Taccuino/`

## Struttura

```text
Taccuino/
├── index.html
├── css/style.css
├── js/app.js
├── js/drawing.js
├── js/storage.js
├── icons/
│   ├── icon-180.png
│   ├── icon-192.png
│   └── icon-512.png
├── manifest.webmanifest
├── service-worker.js
├── tests/manual-test-checklist.md
└── README.md
```

## Aggiornamenti del service worker

La cache usa un nome versionato (`taccuino-shell-v1`). Quando cambiano file essenziali in modo incompatibile, incrementare il suffisso (`v2`, `v3`, …). Il worker non forza refresh della pagina e non contiene cicli di reload.
