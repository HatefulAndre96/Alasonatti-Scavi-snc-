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

Online, con il deploy Netlify attuale, è raggiungibile su `/suonerieiphone/` (il vecchio `/suonerie/` reindirizza qui).
La pagina ha `noindex` per non finire nei risultati di ricerca del sito aziendale.

## Video dell'iPhone (.mov)

Safari su iOS non decodifica l'audio dei `.mov` della fotocamera con
`decodeAudioData` ([WebKit bug 228971](https://bugs.webkit.org/show_bug.cgi?id=228971)).
`estrai-audio.js` legge il contenitore MP4/MOV a pezzi (senza caricare tutto il video
in memoria), estrae la traccia AAC e prova in ordine:

1. ADTS + `decodeAudioData`
2. WebCodecs `AudioDecoder`
3. registrazione in tempo reale riproducendo il video (dura quanto il video, parte con un tocco)

Se il video non ha proprio una traccia audio lo dice chiaramente.
Per i test: `?force=wc` salta il punto 1, `?force=rt` va dritto al 3.
