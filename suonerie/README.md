# Crea Suonerie

Pagina statica (nessun server, nessun build) che trasforma un video o un audio
in una suoneria per iPhone.

- Carichi un file (MP3, M4A, WAV, MP4, MOV…), scegli il pezzo sulla forma d'onda
  (max 29 s per le suonerie, 8 s per gli avvisi), aggiungi dissolvenze e
  normalizzazione, scarichi un MP3 44,1 kHz / 192 kbps.
- Tutto è elaborato nel browser (Web Audio API + [lamejs](https://github.com/zhuker/lamejs),
  LGPL, in `vendor/`): i file non vengono caricati da nessuna parte.
- iOS 26+: File → Condividi → "Usa come suoneria" (limite 30 s).
  iOS 18 e precedenti: passaggio tramite GarageBand (istruzioni nella pagina).

Online, con il deploy Netlify attuale, è raggiungibile su `/suonerie/`.
La pagina ha `noindex` per non finire nei risultati di ricerca del sito aziendale.
