import type { SfxName } from './types';
import { createNoiseBuffer } from './synths';

export function playSfxSound(name: SfxName, audio: AudioContext, sfxGain: GainNode): void {
  const now = audio.currentTime;
    switch (name) {
      case 'attack': {
        // Energy blade slash — noise-whoosh with low thwack, NO laser sweep
        // Layer 1: Fast noise whoosh (the blade cutting air)
        const buf = createNoiseBuffer(audio, 0.1);
        const noise = audio.createBufferSource();
        noise.buffer = buf;
        const nFilter = audio.createBiquadFilter();
        nFilter.type = 'bandpass';
        nFilter.frequency.setValueAtTime(3000, now);
        nFilter.frequency.exponentialRampToValueAtTime(800, now + 0.08);
        nFilter.Q.value = 1.5;
        const ng = audio.createGain();
        ng.gain.setValueAtTime(0, now);
        ng.gain.linearRampToValueAtTime(0.18, now + 0.008);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        noise.connect(nFilter);
        nFilter.connect(ng);
        ng.connect(sfxGain);
        noise.start(now);
        noise.stop(now + 0.1);

        // Layer 2: Low transient thwack (blade impact feel)
        const osc = audio.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.05);
        const g = audio.createGain();
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.connect(g);
        g.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.08);

        // Layer 3: Tiny electrical plasma crackle
        const buf2 = createNoiseBuffer(audio, 0.04);
        const crackle = audio.createBufferSource();
        crackle.buffer = buf2;
        const cFilter = audio.createBiquadFilter();
        cFilter.type = 'highpass';
        cFilter.frequency.value = 5000;
        const cg = audio.createGain();
        cg.gain.setValueAtTime(0.03, now);
        cg.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
        crackle.connect(cFilter);
        cFilter.connect(cg);
        cg.connect(sfxGain);
        crackle.start(now);
        crackle.stop(now + 0.05);
        break;
      }
      case 'wallHit': {
        // Protoss shield impact — energy crackle + low thud
        const osc = audio.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.06);
        const shieldFilter = audio.createBiquadFilter();
        shieldFilter.type = 'bandpass';
        shieldFilter.frequency.value = 800;
        shieldFilter.Q.value = 3;
        const g = audio.createGain();
        g.gain.setValueAtTime(0.1, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(shieldFilter);
        shieldFilter.connect(g);
        g.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.1);

        // Energy crackle burst
        const buf = createNoiseBuffer(audio, 0.06);
        const noise = audio.createBufferSource();
        noise.buffer = buf;
        const nFilter = audio.createBiquadFilter();
        nFilter.type = 'bandpass';
        nFilter.frequency.value = 2500;
        nFilter.Q.value = 4;
        const ng = audio.createGain();
        ng.gain.setValueAtTime(0.06, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        noise.connect(nFilter);
        nFilter.connect(ng);
        ng.connect(sfxGain);
        noise.start(now);
        noise.stop(now + 0.07);

        // Low thud
        const sub = audio.createOscillator();
        sub.type = 'sine';
        sub.frequency.setValueAtTime(100, now);
        sub.frequency.exponentialRampToValueAtTime(40, now + 0.06);
        const sg = audio.createGain();
        sg.gain.setValueAtTime(0.08, now);
        sg.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        sub.connect(sg);
        sg.connect(sfxGain);
        sub.start(now);
        sub.stop(now + 0.1);
        break;
      }
      case 'wallDestroy': {
        const buffer = createNoiseBuffer(audio, 0.6);
        const noise = audio.createBufferSource();
        noise.buffer = buffer;
        const filter = audio.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3000, now);
        filter.frequency.exponentialRampToValueAtTime(200, now + 0.5);
        const g = audio.createGain();
        g.gain.setValueAtTime(0.2, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        noise.connect(filter);
        filter.connect(g);
        g.connect(sfxGain);
        noise.start(now);
        noise.stop(now + 0.6);

        const osc = audio.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
        const g2 = audio.createGain();
        g2.gain.setValueAtTime(0.15, now);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(g2);
        g2.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.5);
        break;
      }
      case 'shopBuy': {
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          const osc = audio.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const g = audio.createGain();
          g.gain.setValueAtTime(0, now + i * 0.08);
          g.gain.linearRampToValueAtTime(0.1, now + i * 0.08 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.3);
          osc.connect(g);
          g.connect(sfxGain);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.35);
        });
        break;
      }
      case 'death': {
        const osc = audio.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 1.2);
        const filter = audio.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 600;
        const g = audio.createGain();
        g.gain.setValueAtTime(0.18, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc.connect(filter);
        filter.connect(g);
        g.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 1.3);

        const sub = audio.createOscillator();
        sub.type = 'sine';
        sub.frequency.value = 40;
        const g2 = audio.createGain();
        g2.gain.setValueAtTime(0.15, now);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
        sub.connect(g2);
        g2.connect(sfxGain);
        sub.start(now);
        sub.stop(now + 1.1);
        break;
      }
      case 'teleport': {
        const osc = audio.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(2000, now + 0.2);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.6);
        const filter = audio.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1000;
        filter.Q.value = 2;
        const g = audio.createGain();
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(filter);
        filter.connect(g);
        g.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.7);

        const sh = audio.createOscillator();
        sh.type = 'triangle';
        sh.frequency.value = 1200;
        const g2 = audio.createGain();
        g2.gain.setValueAtTime(0, now);
        g2.gain.linearRampToValueAtTime(0.06, now + 0.1);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        sh.connect(g2);
        g2.connect(sfxGain);
        sh.start(now);
        sh.stop(now + 0.5);
        break;
      }
      case 'turretHit': {
        // Rocket launcher whoosh — 25% louder
        const osc = audio.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.06);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);
        const rocketFilter = audio.createBiquadFilter();
        rocketFilter.type = 'lowpass';
        rocketFilter.frequency.value = 400;
        rocketFilter.Q.value = 2;
        const g = audio.createGain();
        g.gain.setValueAtTime(0.05, now);
        g.gain.linearRampToValueAtTime(0.063, now + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.connect(rocketFilter);
        rocketFilter.connect(g);
        g.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.2);

        // Distant thud impact
        const thud = audio.createOscillator();
        thud.type = 'sine';
        thud.frequency.setValueAtTime(120, now + 0.05);
        thud.frequency.exponentialRampToValueAtTime(30, now + 0.12);
        const tg = audio.createGain();
        tg.gain.setValueAtTime(0, now);
        tg.gain.setValueAtTime(0.038, now + 0.05);
        tg.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        thud.connect(tg);
        tg.connect(sfxGain);
        thud.start(now + 0.05);
        thud.stop(now + 0.18);

        // Exhaust noise
        const buf = createNoiseBuffer(audio, 0.12);
        const noise = audio.createBufferSource();
        noise.buffer = buf;
        const nFilter = audio.createBiquadFilter();
        nFilter.type = 'bandpass';
        nFilter.frequency.value = 600;
        nFilter.Q.value = 1;
        const ng = audio.createGain();
        ng.gain.setValueAtTime(0.031, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        noise.connect(nFilter);
        nFilter.connect(ng);
        ng.connect(sfxGain);
        noise.start(now);
        noise.stop(now + 0.13);
        break;
      }
      case 'shopOpen': {
        [440, 554.37].forEach((freq, i) => {
          const osc = audio.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const g = audio.createGain();
          g.gain.setValueAtTime(0, now + i * 0.1);
          g.gain.linearRampToValueAtTime(0.08, now + i * 0.1 + 0.03);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.25);
          osc.connect(g);
          g.connect(sfxGain);
          osc.start(now + i * 0.1);
          osc.stop(now + i * 0.1 + 0.3);
        });
        break;
      }
      case 'save': {
        const osc = audio.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 880;
        const g = audio.createGain();
        g.gain.setValueAtTime(0.08, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(g);
        g.connect(sfxGain);
        osc.start(now);
        osc.stop(now + 0.18);
        break;
      }
    }
}