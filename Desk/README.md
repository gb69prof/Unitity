# Desk

PWA visuale, progettata prima di tutto per iPad, per raccogliere fonti in un deposito, creare card su una superficie infinita, collegarle e presentarle.

## Funzioni

- immagini, PDF, testi, pagine web e video;
- card spostabili e ridimensionabili;
- collegamenti colorati tra card;
- pan, zoom, pinch a due dita e adattamento automatico alla vista;
- autosalvataggio locale in IndexedDB;
- recupero automatico dell'ultimo lavoro;
- esportazione JSON v2 completa e importazione retrocompatibile dei JSON v1;
- editor e modalità presentazione separati;
- installazione PWA e interfaccia offline.

## Avvio

Il progetto è interamente statico. In locale va servito tramite HTTP, per esempio:

```bash
python3 -m http.server 8080
```

Poi aprire `http://localhost:8080/Desk/` dalla radice del repository.

Su iPad, aprire la pagina pubblicata in Safari e scegliere **Condividi → Aggiungi alla schermata Home**.

## Dati e limiti

Tutto resta nel browser del dispositivo. Immagini e PDF sono conservati localmente e inclusi nell'esportazione; file oltre 25 MB generano un avviso e file oltre 80 MB vengono rifiutati per proteggere la stabilità di Safari.

Le pagine web possono impedire l'apertura dentro un iframe. In quel caso usare **Apri fuori** nel visualizzatore.
