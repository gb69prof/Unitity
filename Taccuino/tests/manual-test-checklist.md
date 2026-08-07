# Taccuino — checklist di collaudo

Questa checklist corrisponde ai requisiti della prima versione.

- [ ] 1. Scrittura di testo in Appunti.
- [ ] 2. Salvataggio testo e riapertura.
- [ ] 3. Esportazione `.txt`.
- [ ] 4. Disegno con mouse desktop.
- [ ] 5. Disegno con touch su iPad.
- [ ] 6. Disegno Apple Pencil tramite Pointer Events.
- [ ] 7. Selezione nero, rosso, verde, blu.
- [ ] 8. Selezione spessore sottile, medio, spesso.
- [ ] 9. Gomma.
- [ ] 10. Undo.
- [ ] 11. Redo.
- [ ] 12. Cancella pagina con conferma.
- [ ] 13. Esportazione JPG con sfondo bianco.
- [ ] 14. Salvataggio IndexedDB.
- [ ] 15. Riapertura di un disegno dall'Archivio.
- [ ] 16. Cambio orientamento senza perdita del contenuto del canvas.
- [ ] 17. Manifest PWA valido e percorsi relativi.
- [ ] 18. Registrazione service worker con scope `./`.
- [ ] 19. Riapertura offline dopo una prima apertura online completa.
- [ ] 20. Console senza errori JavaScript evidenti nel flusso normale.

## Controlli statici eseguiti prima della pubblicazione

- Sintassi JavaScript verificata con `node --check` su `app.js`, `drawing.js`, `storage.js` e `service-worker.js`.
- Manifest JSON validato con parser JSON.
- Verificata assenza di percorsi assoluti `/Unitity/...` nelle risorse dell'app: i riferimenti rimangono relativi e portabili nella sottocartella GitHub Pages.
- Verificata presenza di `touch-action: none` soltanto sul canvas.
- Verificata gestione di `pointerdown`, `pointermove`, `pointerup`, `pointercancel` e `setPointerCapture`.

I test hardware Apple Pencil/touch/offline devono essere confermati sul dispositivo reale dopo il deploy GitHub Pages.
