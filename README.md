# Alasonatti Scavi

Sito web aziendale - Alasonatti Scavi | Movimento Terra e Lavori Forestali

Sito statico (HTML + Tailwind CSS compilato), pensato per il deploy su Netlify.

## Sviluppo

```bash
npm install
npm run watch   # ricompila assets/css/styles.css ad ogni modifica
```

Apri `index.html` con un server statico qualsiasi (es. `npx serve` o l'estensione
Live Server) per vedere le modifiche in locale.

## Build di produzione

```bash
npm run build
```

Genera `assets/css/styles.css` minificato a partire da `assets/css/input.css`
(Tailwind CLI, nessuna dipendenza da CDN in produzione).

## Struttura

- `index.html` — pagina principale (one-page: Chi Siamo, Servizi, Galleria, Contatti)
- `privacy.html` — informativa privacy (GDPR), collegata al form contatti
- `grazie.html` — pagina di ringraziamento dopo l'invio del form
- `assets/img/` — logo, foto hero/chi-siamo, galleria cantieri, favicon
- `assets/img/icons.svg` — sprite SVG delle icone (Lucide, self-hosted, nessuna CDN)
- `assets/css/` — sorgente e output Tailwind
- `robots.txt`, `sitemap.xml` — SEO tecnico
- `netlify.toml` — configurazione build Netlify

## Immagini da caricare

Il sito usa dei fallback automatici finché questi file non vengono caricati in
`assets/img/`:

- `logo.png` — logo aziendale (altrimenti mostra il testo "Alasonatti Scavi")
- `hero.jpg` — foto di sfondo hero (altrimenti immagine stock temporanea)
- `chi-siamo.jpg` — foto sezione "Chi Siamo" (altrimenti immagine stock temporanea)
- `gallery/cantiere-01.jpg` … `cantiere-06.jpg` — foto della galleria cantieri
- `og-cover.jpg` — immagine per le anteprime social (Open Graph)

## Form contatti

Il form usa [Netlify Forms](https://docs.netlify.com/forms/setup/) (nessuna
dipendenza esterna, nessun indirizzo email esposto nel codice). Dopo il primo
deploy su Netlify, va abilitata la notifica email nel pannello
Site settings → Forms → Form notifications, indicando l'indirizzo a cui
ricevere le richieste.
