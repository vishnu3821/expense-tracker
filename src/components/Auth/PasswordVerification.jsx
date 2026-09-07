import React, { useEffect, useRef, useState } from 'react';
import './PasswordVerification.css';

export default function PasswordVerification({ email, onVerify, onAnimationComplete, onBack, onForgot }) {
  const stageRef = useRef(null);
  const inputRef = useRef(null);
  const boxesRef = useRef([]);
  const trackRef = useRef(null);
  const [showPw, setShowPw] = useState(false);
  const [pwVal, setPwVal] = useState('');

  const numBoxes = Math.max(8, pwVal.length + 1);
  const boxes = Array.from({ length: numBoxes }, (_, i) => i);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let state = 'idle';
    function setState(s) { state = s; stage.dataset.state = s; }

    const errEl = stage.querySelector('[data-pv-err]');
    const liveEl = stage.querySelector('[data-pv-live]');
    const btn = stage.querySelector('[data-pv-btn]');
    const inp = inputRef.current;
    const lockTile = stage.querySelector('[data-pv-tile]');
    const burst = stage.querySelector('[data-pv-burst]');
    const track = trackRef.current;

    function say(msg) { liveEl.textContent = ''; requestAnimationFrame(() => { liveEl.textContent = msg; }); }

    // ── Web Audio ──
    let armed = false, ac = null, noiseBuf = null;
    const armAudio = () => { armed = true; };
    window.addEventListener('pointerdown', armAudio, { once: true, passive: true });
    window.addEventListener('keydown', armAudio, { once: true });

    function ctx() {
      if (!armed) return null;
      if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = false; } }
      if (ac && ac.state === 'suspended') ac.resume();
      return ac || null;
    }

    function noise(c) {
      if (!noiseBuf) {
        const len = Math.floor(c.sampleRate * 0.5);
        noiseBuf = c.createBuffer(1, len, c.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true; return src;
    }

    function tone(freq, dur, vol, type = 'sine', delay = 0) {
      const c = ctx(); if (!c) return;
      const t = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
    }

    function clickSnd() {
      const c = ctx(); if (!c) return;
      const t = c.currentTime;
      const hi = noise(c), bp = c.createBiquadFilter(), gh = c.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 4200; bp.Q.value = 0.9;
      gh.gain.setValueAtTime(0.0001, t); gh.gain.exponentialRampToValueAtTime(0.13, t+0.001); gh.gain.exponentialRampToValueAtTime(0.0001, t+0.03);
      hi.connect(bp).connect(gh).connect(c.destination); hi.start(t); hi.stop(t+0.05);
    }

    function whoosh(ms) {
      const c = ctx(); if (!c) return;
      const t = c.currentTime, d = ms / 1000;
      const src = noise(c), bp = c.createBiquadFilter(), g = c.createGain();
      bp.type = 'bandpass'; bp.Q.value = 1.3;
      bp.frequency.setValueAtTime(320, t); bp.frequency.exponentialRampToValueAtTime(1700, t + d * 0.52); bp.frequency.exponentialRampToValueAtTime(420, t + d);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.075, t + d * 0.4); g.gain.linearRampToValueAtTime(0.05, t + d * 0.72); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      src.connect(bp).connect(g).connect(c.destination); src.start(t); src.stop(t + d + 0.05);
    }

    const sndKeyTap = () => tone(3200 + Math.random() * 800, 0.025, 0.06, 'sine');
    const sndOk = () => { tone(659, 0.11, 0.075); tone(988, 0.2, 0.07, 'sine', 0.1); };
    const sndErr = () => { tone(196, 0.16, 0.085, 'sawtooth'); tone(147, 0.22, 0.065, 'sawtooth', 0.09); };
    const sndLock = () => tone(523, 0.09, 0.05, 'triangle');

    const handleInput = (e) => {
      setPwVal(e.target.value);
      if (state === 'error') {
        setState('idle'); errEl.textContent = ''; stage.classList.remove('pv-shake');
      }
      sndKeyTap();
    };
    inp.addEventListener('input', handleInput);

    let running = [];
    const play = (el, frames, opts) => { const a = el.animate(frames, opts); running.push(a); return a; };
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const round = n => Math.round(n*100)/100;
    const TAU = Math.PI * 2;
    const outCubic = t => 1 - (1 - t)**3;
    const outBack = (t, s=1.5) => 1 + (s+1)*(t-1)**3 + s*(t-1)**2;

    const CURL_MS = 660, CURL_LAG = 32, SPIN_MS = 1400, HOLD_MS = 360, SCREW_MS = 520, SCREW_LAG = 30;

    function measureOrbit() {
      // Get all filled boxes (using inp.value to avoid stale closure on pwVal)
      const N = inp.value.length;
      const currentBoxes = boxesRef.current.slice(0, N).filter(b => b);
      
      const lockRect = lockTile.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      
      // Center of the orbit is the center of the lock icon relative to the stage
      const cx = (lockRect.left + lockRect.right) / 2 - stageRect.left;
      const cy = (lockRect.top + lockRect.bottom) / 2 - stageRect.top;
      
      const boxRects = currentBoxes.map(b => {
        const r = b.getBoundingClientRect();
        return {
          w: r.width,
          h: r.height,
          cx: (r.left + r.right)/2 - stageRect.left,
          cy: (r.top + r.bottom)/2 - stageRect.top
        };
      });

      // Calculate radius to fit all boxes, min 80px
      const R = Math.max(85, (N * boxRects[0].w * 1.4) / TAU);
      
      const a0 = boxRects.map(r => (r.cx < cx ? Math.PI : 0));
      const r0 = boxRects.map(r => Math.hypot(r.cx - cx, r.cy - cy));
      
      const a1 = boxRects.map((_, i) => Math.PI + (i * TAU / N));
      const turn = a1.map((a, i) => {
        let d = (a - a0[i]) % TAU;
        if (d < 0) d += TAU;
        if (d > Math.PI) d -= TAU;
        return d;
      });

      return { cx, cy, R, N, boxRects, currentBoxes, a0, r0, a1, turn };
    }

    function at(g, i, ang, rad, rot, sc) {
      const bx = g.boxRects[i].cx;
      const by = g.boxRects[i].cy;
      // offset from original center to new position
      const targetX = g.cx + Math.cos(ang) * rad;
      const targetY = g.cy + Math.sin(ang) * rad;
      const dx = targetX - bx;
      const dy = targetY - by;
      return `translate(${round(dx)}px, ${round(dy)}px) rotate(${round(rot)}deg) scale(${round(sc)})`;
    }

    function ringDelta(g, i) {
      const targetX = g.cx + Math.cos(g.a1[i]) * g.R;
      const targetY = g.cy + Math.sin(g.a1[i]) * g.R;
      return [round(targetX - g.boxRects[i].cx), round(targetY - g.boxRects[i].cy)];
    }

    function clearOrbit() {
      running.forEach(a => { try { a.cancel(); } catch {} });
      running = [];
      boxesRef.current.forEach(b => { if(b) b.style.transform = ''; });
      track.style.opacity = '0';
      track.style.transform = '';
    }

    async function spinVerify() {
      const g = measureOrbit();
      const d = g.R * 2 + 60;
      track.style.width = `${round(d)}px`; track.style.height = `${round(d)}px`;
      track.style.left = `${round(g.cx - d/2)}px`; track.style.top = `${round(g.cy - d/2)}px`;
      
      const CURL_STEPS = 20;
      g.currentBoxes.forEach((box, i) => {
        const frames = [
          { transform: at(g, i, g.a0[i], g.r0[i], 0, 1), offset: 0 },
          { transform: at(g, i, g.a0[i], g.r0[i], 0, 0.9), offset: 0.16 }
        ];
        for (let k = 1; k <= CURL_STEPS; k++) {
          const t = k / CURL_STEPS, e = outBack(t), ang = g.a0[i] + g.turn[i] * outCubic(t), rad = g.r0[i] + (g.R - g.r0[i]) * e;
          frames.push({ transform: at(g, i, ang, rad, 0, 0.9 + 0.1 * outCubic(t)), offset: 0.16 + 0.84 * t });
        }
        play(box, frames, { duration: CURL_MS, delay: i * CURL_LAG, easing: 'linear', fill: 'forwards' });
        setTimeout(clickSnd, i * CURL_LAG);
      });

      track.style.opacity = '1';
      play(track, [{ transform: 'scale(0.72) rotate(-24deg)', opacity: 0 }, { transform: 'scale(1) rotate(0deg)', opacity: 1 }], { duration: CURL_MS, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'both' });
      await wait(CURL_MS + CURL_LAG * (g.N - 1) + 60); 
      
      const TURNS = 2 + (1/g.N);
      const total = TURNS * 360, REST = total % 360;
      
      g.currentBoxes.forEach((box, i) => {
        const d = ringDelta(g, i);
        // We set transformOrigin so rotating it orbits around cx,cy
        box.style.transformOrigin = `${round(g.cx - g.boxRects[i].cx + box.offsetWidth/2)}px ${round(g.cy - g.boxRects[i].cy + box.offsetHeight/2)}px`;
        play(box, [
          { transform: `rotate(0deg) translate(${d[0]}px,${d[1]}px)` },
          { transform: `rotate(${total}deg) translate(${d[0]}px,${d[1]}px)` }
        ], { duration: SPIN_MS, easing: 'cubic-bezier(0.62,0,0.38,1)', fill: 'forwards' });
      });

      play(track, [
        { transform: 'scale(1) rotate(0deg)', opacity: 1, offset: 0 },
        { transform: 'scale(1.05) rotate(34deg)', opacity: 0.85, offset: 0.5 },
        { transform: 'scale(1) rotate(52deg)', opacity: 1, offset: 1 }
      ], { duration: SPIN_MS, easing: 'ease-in-out', fill: 'forwards' });
      
      whoosh(SPIN_MS);
      return { g, SPIN_MS };
    }

    const MOTES = 20;
    function throwMotes() {
      for (let i = 0; i < MOTES; i++) {
        const m = document.createElement('span');
        m.className = 'pv-mote' + (i % 3 === 0 ? ' pv-mote--sm' : '') + (i % 5 === 0 ? ' pv-mote--lg' : '') + (i % 4 === 1 ? ' pv-mote--pale' : '');
        burst.appendChild(m);
        const a = (i / MOTES) * TAU + (Math.random() - 0.5) * 0.6;
        const dist = 60 + Math.random() * 80;
        const anim = m.animate([
          { transform: 'translate(0,0) scale(0.2)', opacity: 0 },
          { transform: `translate(${Math.cos(a) * dist * 0.35}px,${Math.sin(a) * dist * 0.35}px) scale(1)`, opacity: 1, offset: 0.22 },
          { transform: `translate(${Math.cos(a) * dist}px,${Math.sin(a) * dist + 16}px) scale(0.4)`, opacity: 0 },
        ], { duration: 1000 + Math.random() * 400, delay: 50 + Math.random() * 100, easing: 'cubic-bezier(0.12,0.75,0.28,1)' });
        anim.finished.then(() => m.remove(), () => m.remove());
      }
    }

    async function handleSubmit(e) {
      e.preventDefault();
      if (state === 'checking' || state === 'ok') return;
      if (!inp.value) { inp.focus(); return; }

      setState('checking');
      say('Verifying password…');
      inp.disabled = true;
      btn.disabled = true;
      errEl.textContent = '';

      try {
        const { g, SPIN_MS } = await spinVerify();
        await wait(SPIN_MS);

        // Verification call
        await onVerify(inp.value);

        // Success Sequence
        setState('ok');
        sndLock();
        await wait(HOLD_MS);
        sndOk();
        throwMotes();
        say('Verified successfully.');

        // Screw in
        const END_S = 0.24, EXTRA = 150;
        g.currentBoxes.forEach((box, i) => {
          const d = ringDelta(g, i);
          play(box, [
            { transform: `rotate(0deg) translate(${d[0]}px,${d[1]}px) scale(1)`, opacity: 1 },
            { transform: `rotate(${EXTRA}deg) translate(${-END_S*d[0]}px,${-END_S*d[1]}px) scale(${END_S})`, opacity: 0 }
          ], { duration: SCREW_MS, delay: i * SCREW_LAG, easing: 'cubic-bezier(0.62,0,0.38,1)', fill: 'forwards' });
        });
        play(track, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.3)', opacity: 0 }], { duration: SCREW_MS, easing: 'ease-in', fill: 'forwards' });

        await wait(SCREW_MS + SCREW_LAG * (g.N - 1));
        if (onAnimationComplete) onAnimationComplete();

      } catch (err) {
        // Error sequence
        clearOrbit();
        setState('error');
        sndErr();
        inp.disabled = false;
        btn.disabled = false;
        const msg = err.message || 'Incorrect password. Try again.';
        errEl.textContent = msg;
        say('Error: ' + msg);
        
        // Shake the boxes grid
        const grid = stage.querySelector('.pv-boxes-grid');
        grid.classList.remove('pv-shake');
        void grid.offsetWidth;
        grid.classList.add('pv-shake');

        setTimeout(() => { setState('idle'); errEl.textContent = ''; }, 3200);
        inp.focus();
        inp.select();
      }
    }

    const form = stage.querySelector('[data-pv-form]');
    form.addEventListener('submit', handleSubmit);

    setTimeout(() => inp.focus(), 80);

    return () => {
      inp.removeEventListener('input', handleInput);
      form.removeEventListener('submit', handleSubmit);
      clearOrbit();
      window.removeEventListener('pointerdown', armAudio);
      window.removeEventListener('keydown', armAudio);
      if (ac) { try { ac.close(); } catch {} }
    };
  }, [onVerify]);

  return (
    <div className="pv-stage" ref={stageRef} data-state="idle">
      {/* Orbit SVG Track (drawn dynamically around lock) */}
      <svg className="pv-orbit-track" ref={trackRef} viewBox="0 0 100 100" aria-hidden="true">
        <circle className="pv-orbit-path" cx="50" cy="50" r="49" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="pv-burst" data-pv-burst aria-hidden="true" />

      {/* Lock Icon */}
      <div className="pv-lock-wrap">
        <div className="pv-lock-glow" aria-hidden="true" />
        <div className="pv-lock-tile" data-pv-tile>
          <svg className="pv-lock-icon" width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="4" y="10" width="16" height="11" rx="3" stroke="rgba(52,255,180,0.7)" strokeWidth="1.7" />
            <path d="M8 10V8a4 4 0 0 1 8 0v2" stroke="rgba(52,255,180,0.7)" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <svg data-pv-check-wrap width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true"
            style={{ position: 'absolute', inset: 0, margin: 'auto', width: 30, height: 30 }}>
            <path className="pv-check-path" d="M6 12.5 L10.5 17 L18 8"
              stroke="#34ffb4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              pathLength="1" style={{ strokeDasharray: 1, strokeDashoffset: 1 }} />
          </svg>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true"
            style={{ position: 'absolute', inset: 0, margin: 'auto', width: 30, height: 30 }}>
            <path className="pv-cross-path" d="M8 8 L16 16 M16 8 L8 16"
              stroke="#ff6b6b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              pathLength="1" />
          </svg>
        </div>
      </div>

      <form data-pv-form onSubmit={e => e.preventDefault()} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <p className="pv-fade-out" style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', marginBottom: 12, textAlign: 'center' }}>
          Signing in as <span style={{ color: 'rgba(52,255,180,0.7)' }}>{email}</span>
        </p>

        <div className="pv-boxes-container">
          <input
            ref={inputRef}
            id="pv-pw-input"
            className="pv-hidden-input"
            type="password"
            autoComplete="current-password"
            enterKeyHint="go"
          />
          <div className="pv-boxes-grid">
            {boxes.map(i => {
              const char = pwVal[i];
              const isFilled = i < pwVal.length;
              const isActive = i === pwVal.length; 
              return (
                <div 
                  key={i} 
                  ref={el => boxesRef.current[i] = el}
                  className={`pv-box ${isFilled ? 'has-char' : 'pv-fade-out'} ${isActive ? 'is-active' : ''}`}
                >
                  {isFilled && (
                    <span className="pv-box-char">
                      {showPw ? char : '•'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <button type="button" className="pv-eye-btn pv-fade-out" onClick={() => setShowPw(s => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}>
            {showPw ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>

        <p className="pv-err" data-pv-err />

        <button className="pv-btn pv-fade-out" type="submit" data-pv-btn>
          Verify Password
        </button>
      </form>

      <div className="pv-fade-out" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18, width: '100%', maxWidth: '320px' }}>
        <button type="button" onClick={onBack}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', transition: 'color 0.2s', fontFamily: 'inherit' }}
          onMouseEnter={e => (e.target.style.color = 'rgba(255,255,255,0.8)')}
          onMouseLeave={e => (e.target.style.color = 'rgba(255,255,255,0.3)')}>
          ← Change email
        </button>
        <button type="button" onClick={onForgot}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(52,255,180,0.5)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', transition: 'color 0.2s', fontFamily: 'inherit' }}
          onMouseEnter={e => (e.target.style.color = 'rgba(52,255,180,0.9)')}
          onMouseLeave={e => (e.target.style.color = 'rgba(52,255,180,0.5)')}>
          Forgot password →
        </button>
      </div>
      <p className="pv-sr" role="status" aria-live="polite" data-pv-live />
    </div>
  );
}
