/*
 * Estrazione audio da video MP4/MOV senza caricare tutto il file in memoria.
 *
 * Perché esiste: Safari su iPhone non riesce a fare decodeAudioData() sui .mov
 * registrati dalla fotocamera (WebKit bug 228971). Qui leggiamo noi il contenitore
 * (ISO BMFF / QuickTime), prendiamo i pacchetti AAC della traccia audio e li
 * passiamo al browser come stream ADTS (che Safari decodifica), oppure a WebCodecs.
 * Ultima spiaggia: registrazione in tempo reale riproducendo il video.
 */
(function () {
  'use strict';

  const FREQS = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

  class NoAudioError extends Error { constructor() { super('Nessuna traccia audio'); this.name = 'NoAudioError'; } }
  class NotMp4Error extends Error { constructor() { super('Non è un MP4/MOV'); this.name = 'NotMp4Error'; } }

  const fourcc = (u8, o) => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
  const u32 = (u8, o) => ((u8[o] << 24) >>> 0) + (u8[o + 1] << 16) + (u8[o + 2] << 8) + u8[o + 3];
  const u64 = (u8, o) => u32(u8, o) * 4294967296 + u32(u8, o + 4);

  async function readBytes(file, start, end) {
    return new Uint8Array(await file.slice(start, end).arrayBuffer());
  }

  // Box di primo livello: legge solo le intestazioni, salta mdat.
  async function readMoov(file) {
    const size = file.size;
    let pos = 0, first = true;
    while (pos + 8 <= size) {
      const h = await readBytes(file, pos, Math.min(size, pos + 16));
      let len = u32(h, 0), hdr = 8;
      const type = fourcc(h, 4);
      if (first && !/^(ftyp|moov|mdat|wide|free|skip|pnot|uuid)$/.test(type)) throw new NotMp4Error();
      first = false;
      if (len === 1) { len = u64(h, 8); hdr = 16; } else if (len === 0) len = size - pos;
      if (len < hdr) throw new NotMp4Error();
      if (type === 'moov') return readBytes(file, pos + hdr, pos + len);
      pos += len;
    }
    throw new NotMp4Error();
  }

  function children(u8, start, end) {
    const out = [];
    let p = start;
    while (p + 8 <= end) {
      let len = u32(u8, p), hdr = 8;
      const type = fourcc(u8, p + 4);
      if (len === 1) { len = u64(u8, p + 8); hdr = 16; } else if (len === 0) len = end - p;
      if (len < hdr || p + len > end) break;
      out.push({ type, start: p + hdr, end: p + len, boxStart: p });
      p += len;
    }
    return out;
  }
  const child = (u8, box, type) => children(u8, box.start, box.end).find((b) => b.type === type);
  const path = (u8, box, types) => types.reduce((b, t) => (b ? child(u8, b, t) : null), box);

  function parseAsc(asc) {
    let bit = 0;
    const read = (n) => { let v = 0; for (let i = 0; i < n; i++) { v = (v << 1) | ((asc[bit >> 3] >> (7 - (bit & 7))) & 1); bit++; } return v; };
    const readAot = () => { const a = read(5); return a === 31 ? 32 + read(6) : a; };
    const readFreq = () => { const i = read(4); return i === 15 ? { idx: 15, hz: read(24) } : { idx: i, hz: FREQS[i] }; };
    const origAot = readAot();
    const f = readFreq();
    const chan = read(4);
    let aot = origAot, freq = f;
    if (origAot === 5 || origAot === 29) { readFreq(); aot = readAot(); } // HE-AAC: usa il core AAC per ADTS
    return { origAot, aot, freqIdx: freq.idx, sampleRate: freq.hz, channels: chan };
  }

  // esds → AudioSpecificConfig
  function parseEsds(u8, start, end) {
    let p = start + 4; // version + flags
    const readLen = () => { let n = 0; for (let i = 0; i < 4; i++) { const b = u8[p++]; n = (n << 7) | (b & 0x7f); if (!(b & 0x80)) break; } return n; };
    while (p < end) {
      const tag = u8[p++];
      const len = readLen();
      if (tag === 0x03) { // ES_Descriptor
        p += 2; const fl = u8[p++];
        if (fl & 0x80) p += 2;
        if (fl & 0x40) p += 1 + u8[p];
        if (fl & 0x20) p += 2;
      } else if (tag === 0x04) { // DecoderConfigDescriptor
        p += 13;
      } else if (tag === 0x05) { // DecoderSpecificInfo = ASC
        return u8.slice(p, p + len);
      } else {
        p += len;
      }
    }
    return null;
  }

  function findEsds(u8, start, end) {
    for (let i = start; i + 4 <= end; i++) {
      if (u8[i] === 0x65 && u8[i + 1] === 0x73 && u8[i + 2] === 0x64 && u8[i + 3] === 0x73) { // 'esds'
        const bs = i - 4, len = u32(u8, bs);
        if (len >= 12 && bs + len <= end) return parseEsds(u8, i + 4, bs + len);
      }
    }
    return null;
  }

  // Ritorna { format, asc, info, samples: [{off,size}] } della prima traccia audio.
  async function probe(file) {
    const moov = await readMoov(file);
    const traks = children(moov, 0, moov.length).filter((b) => b.type === 'trak');
    let sawAudio = false, lastErr = null;
    for (const trak of traks) {
      const mdia = child(moov, trak, 'mdia');
      const hdlr = mdia && child(moov, mdia, 'hdlr');
      if (!hdlr || fourcc(moov, hdlr.start + 8) !== 'soun') continue;
      sawAudio = true;
      const stbl = path(moov, mdia, ['minf', 'stbl']);
      if (!stbl) continue;
      const stsd = child(moov, stbl, 'stsd');
      const entry = stsd && children(moov, stsd.start + 8, stsd.end)[0];
      if (!entry) continue;
      const format = fourcc(moov, entry.boxStart + 4);
      if (format !== 'mp4a') { lastErr = new Error('Codec audio non supportato: ' + format); continue; }
      const asc = findEsds(moov, entry.start + 28, entry.end);
      if (!asc || asc.length < 2) { lastErr = new Error('Configurazione AAC mancante'); continue; }

      // tabelle dei campioni
      const stsz = child(moov, stbl, 'stsz');
      const stsc = child(moov, stbl, 'stsc');
      const stco32 = child(moov, stbl, 'stco');
      const stco = stco32 || child(moov, stbl, 'co64');
      if (!stsz || !stsc || !stco) { lastErr = new Error('Tabelle campioni mancanti'); continue; }
      const fixed = u32(moov, stsz.start + 4), count = u32(moov, stsz.start + 8);
      const sizes = new Uint32Array(count);
      for (let i = 0; i < count; i++) sizes[i] = fixed || u32(moov, stsz.start + 12 + i * 4);
      const is64 = !stco32;
      const nChunks = u32(moov, stco.start + 4);
      const chunkOff = (i) => (is64 ? u64(moov, stco.start + 8 + i * 8) : u32(moov, stco.start + 8 + i * 4));
      const nSc = u32(moov, stsc.start + 4);
      const sc = [];
      for (let i = 0; i < nSc; i++) sc.push({ first: u32(moov, stsc.start + 8 + i * 12), per: u32(moov, stsc.start + 12 + i * 12) });
      if (!count || !nChunks || !nSc) { lastErr = new Error('Traccia audio vuota'); continue; }

      const samples = [];
      let s = 0;
      for (let c = 0; c < nChunks && s < count; c++) {
        let per = sc[0].per;
        for (let k = 0; k < sc.length && sc[k].first <= c + 1; k++) per = sc[k].per;
        let off = chunkOff(c);
        for (let j = 0; j < per && s < count; j++, s++) { samples.push({ off, size: sizes[s] }); off += sizes[s]; }
      }
      return { format, asc, info: parseAsc(asc), samples };
    }
    if (!sawAudio) throw new NoAudioError();
    throw lastErr || new Error('Traccia audio non leggibile');
  }

  // Legge i byte dei campioni raggruppando quelli contigui (un chunk = una lettura).
  async function readFrames(file, samples, onProg) {
    const frames = new Array(samples.length);
    let i = 0;
    while (i < samples.length) {
      let j = i, end = samples[i].off + samples[i].size;
      while (j + 1 < samples.length && samples[j + 1].off === end && end - samples[i].off < 4 << 20) { j++; end += samples[j].size; }
      const bytes = await readBytes(file, samples[i].off, end);
      for (let k = i, p = 0; k <= j; k++) { frames[k] = bytes.subarray(p, p + samples[k].size); p += samples[k].size; }
      i = j + 1;
      if (onProg) onProg(i / samples.length);
    }
    return frames;
  }

  function toAdts(info, frames) {
    if (info.aot < 1 || info.aot > 4 || info.freqIdx > 12 || info.channels < 1 || info.channels > 7) return null;
    let total = 0;
    for (const f of frames) total += f.length + 7;
    const out = new Uint8Array(total);
    const prof = info.aot - 1, fi = info.freqIdx, ch = info.channels;
    let p = 0;
    for (const f of frames) {
      const len = f.length + 7;
      out[p] = 0xff; out[p + 1] = 0xf1;
      out[p + 2] = (prof << 6) | (fi << 2) | (ch >> 2);
      out[p + 3] = ((ch & 3) << 6) | (len >> 11);
      out[p + 4] = (len >> 3) & 0xff;
      out[p + 5] = ((len & 7) << 5) | 0x1f;
      out[p + 6] = 0xfc;
      out.set(f, p + 7);
      p += len;
    }
    return out;
  }

  function decodeAudioDataP(ctx, ab) {
    return new Promise((res, rej) => {
      const p = ctx.decodeAudioData(ab, res, rej);
      if (p && p.then) p.then(res, rej);
    });
  }

  async function decodeWebCodecs(ctx, probeRes, frames) {
    if (!('AudioDecoder' in window) || !('EncodedAudioChunk' in window)) throw new Error('WebCodecs non disponibile');
    const { info, asc } = probeRes;
    const cfg = { codec: 'mp4a.40.' + info.origAot, sampleRate: info.sampleRate, numberOfChannels: info.channels || 2, description: asc };
    const sup = await AudioDecoder.isConfigSupported(cfg);
    if (!sup.supported) throw new Error('AAC non supportato da WebCodecs');
    const planes = [], lens = [];
    let rate = 0, nch = 0, err = null;
    const dec = new AudioDecoder({
      output: (ad) => {
        rate = rate || ad.sampleRate; nch = nch || ad.numberOfChannels;
        const per = [];
        for (let c = 0; c < nch; c++) {
          const dst = new Float32Array(ad.numberOfFrames);
          ad.copyTo(dst, { planeIndex: c, format: 'f32-planar' });
          per.push(dst);
        }
        planes.push(per); lens.push(ad.numberOfFrames);
        ad.close();
      },
      error: (e) => { err = e; },
    });
    dec.configure(cfg);
    const spf = (info.origAot === 5 || info.origAot === 29) ? 2048 : 1024;
    frames.forEach((f, i) => dec.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round(i * spf / info.sampleRate * 1e6), data: f })));
    await dec.flush();
    dec.close();
    if (err) throw err;
    const total = lens.reduce((a, b) => a + b, 0);
    if (!total) throw new Error('Nessun audio decodificato');
    const buf = ctx.createBuffer(nch, total, rate);
    for (let c = 0; c < nch; c++) {
      const out = buf.getChannelData(c);
      let p = 0;
      planes.forEach((per) => { out.set(per[c], p); p += per[c].length; });
    }
    return buf;
  }

  /**
   * Prova ad estrarre e decodificare l'audio da un MP4/MOV.
   * opts.skipAdts / opts.skipWebCodecs servono solo per i test.
   */
  async function fromContainer(file, ctx, opts) {
    opts = opts || {};
    const pr = await probe(file);
    const frames = await readFrames(file, pr.samples, opts.onProgress);
    const errors = [];
    if (!opts.skipAdts) {
      const adts = toAdts(pr.info, frames);
      if (adts) {
        try { return await decodeAudioDataP(ctx, adts.buffer); } catch (e) { errors.push(e); }
      }
    }
    if (!opts.skipWebCodecs) {
      try { return await decodeWebCodecs(ctx, pr, frames); } catch (e) { errors.push(e); }
    }
    const e = new Error('Decodifica AAC fallita'); e.causes = errors; throw e;
  }

  /**
   * Ultima spiaggia: riproduce il video (senza farlo sentire) e registra l'audio.
   * Dura quanto il video. Va chiamata da un tocco dell'utente (iOS lo pretende).
   */
  function captureRealtime(file, ctx, onProgress, signal) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const v = document.createElement('video');
      v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.src = url;
      const chans = [[], []];
      let src, sp, done = false;
      const cleanup = () => {
        done = true;
        try { v.pause(); } catch (_) {}
        try { sp && sp.disconnect(); src && src.disconnect(); } catch (_) {}
        URL.revokeObjectURL(url);
        v.removeAttribute('src'); v.load();
      };
      const fail = (e) => { if (!done) { cleanup(); reject(e); } };
      const finish = () => {
        if (done) return;
        cleanup();
        const n = chans[0].reduce((a, b) => a + b.length, 0);
        if (!n) return reject(new NoAudioError());
        const buf = ctx.createBuffer(2, n, ctx.sampleRate);
        for (let c = 0; c < 2; c++) { const o = buf.getChannelData(c); let p = 0; chans[c].forEach((x) => { o.set(x, p); p += x.length; }); }
        // tutto silenzio = niente audio
        let peak = 0; const d0 = buf.getChannelData(0);
        for (let i = 0; i < d0.length; i += 64) { const a = Math.abs(d0[i]); if (a > peak) peak = a; }
        if (peak < 1e-5) return reject(new NoAudioError());
        resolve(buf);
      };
      if (signal) signal.addEventListener('abort', () => fail(new DOMException('Annullato', 'AbortError')));
      v.addEventListener('error', () => fail(new Error('Il browser non riesce a riprodurre questo video')));
      v.addEventListener('ended', finish);
      v.addEventListener('timeupdate', () => { if (v.duration) onProgress && onProgress(v.currentTime / v.duration); });
      try {
        src = ctx.createMediaElementSource(v);
        sp = ctx.createScriptProcessor(4096, 2, 2);
        sp.onaudioprocess = (e) => {
          const ib = e.inputBuffer, ob = e.outputBuffer;
          for (let c = 0; c < ob.numberOfChannels; c++) ob.getChannelData(c).fill(0);
          if (done || v.paused) return;
          chans[0].push(new Float32Array(ib.getChannelData(0)));
          chans[1].push(new Float32Array(ib.getChannelData(ib.numberOfChannels > 1 ? 1 : 0)));
        };
        src.connect(sp); sp.connect(ctx.destination);
      } catch (e) { return fail(e); }
      // chiamate sincrone: iOS vuole play() dentro il tocco dell'utente
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const pp = v.play();
      if (pp && pp.catch) pp.catch(fail);
    });
  }

  window.EstraiAudio = { fromContainer, captureRealtime, probe, decodeAudioDataP, NoAudioError, NotMp4Error };
})();
