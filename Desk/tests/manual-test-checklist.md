# Collaudo manuale Desk

## Installazione e ripristino

- [ ] Safari iPad propone “Aggiungi alla schermata Home”.
- [ ] L'app installata si apre senza barra del browser.
- [ ] Dopo ricarica o chiusura, l'ultimo desk ricompare.
- [ ] Copertina, editor e presentazione si aprono offline dopo la prima visita.

## Fonti e card

- [ ] Immagine e PDF creano fonte e card.
- [ ] Testo, pagina web e video creano fonte e card.
- [ ] Una fonte può creare più card senza duplicare il contenuto nel JSON v2.
- [ ] Eliminare una card conserva la fonte.
- [ ] Eliminare una fonte rimuove le card dipendenti dopo conferma.
- [ ] File sopra 25 MB mostrano un avviso; sopra 80 MB vengono rifiutati.

## Interazione

- [ ] Muovi e ridimensiona funzionano con dito, Pencil e mouse.
- [ ] Pan funziona trascinando il fondo.
- [ ] Pinch a due dita modifica lo zoom mantenendo il punto centrale.
- [ ] Connetti crea una linea tra due card.
- [ ] Cancella rimuove card e linee.
- [ ] Adatta rende visibili tutte le card.
- [ ] Il deposito è richiudibile e non soffoca la vista in verticale.

## Dati e presentazione

- [ ] Export JSON include `version: 2`, `sources`, `cards`, `connectors` e `view`.
- [ ] Reimportare un JSON v2 ripristina deposito e desk.
- [ ] Importare un JSON v1 del vecchio Desk ricostruisce anche il deposito.
- [ ] Presentazione apre automaticamente l'ultimo desk salvato.
- [ ] Clic su card apre immagini, testi, PDF, web e video.
- [ ] “Apri fuori” resta disponibile per contenuti non incorporabili.
