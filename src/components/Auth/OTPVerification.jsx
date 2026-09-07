import React, { useEffect, useRef } from 'react';
import './OTPVerification.css';
import { supabase } from '../../lib/supabase';

export default function OTPVerification({ email, onVerify, onCancel }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- CHANGED TO 6 DIGITS TO SATISFY SUPABASE ---
    const N = 6;
    const COOLDOWN = 30;
    const ORBIT_R = 1.25; // Slightly larger radius for 6 items
    const TURNS = 1 + (1/6); // 1 full turn + 60 degrees (symmetry of hexagon)
    const CURL_MS = 660;
    const CURL_LAG = 32;
    const SPIN_MS = 800;
    const HOLD_MS = 360;
    const SCREW_MS = 520;
    const SCREW_LAG = 30;

    container.classList.add('gyre-live');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const sheet = container.querySelector('.sheet');
    const form = container.querySelector('#verify');
    const wrap = container.querySelector('.code-wrap');
    const code = container.querySelector('[data-code]');
    const slots = [...code.querySelectorAll('.slot')];
    const inputs = slots.map((s) => s.querySelector('.slot__input'));
    const digits = slots.map((s) => s.querySelector('.slot__digit'));
    const wins = slots.map((s) => s.querySelector('.slot__win'));
    const halos = slots.map((s) => s.querySelector('.slot__glow'));
    const sparks = slots.map((s) => s.querySelector('.slot__spark'));
    const arcs = slots.map((s) => s.querySelector('.slot__arc'));
    const track = container.querySelector('[data-track]');
    const hub = container.querySelector('[data-hub]');
    const burst = container.querySelector('[data-burst]');
    const errEl = container.querySelector('[data-err]');
    const live = container.querySelector('[data-live]');
    const resend = container.querySelector('[data-resend]');
    const resendLabel = container.querySelector('[data-resend-label]');
    const foot = container.querySelector('.verify__foot');
    const done = container.querySelector('[data-done]');

    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const round = (n) => Math.round(n * 100) / 100;
    const TAU = Math.PI * 2;

    let running = [];
    const play = (el, frames, opts) => {
      const a = el.animate(frames, opts);
      running.push(a);
      return a;
    };

    let state = 'idle';
    let runId = 0;
    let coolTimer = 0;
    let redirecting = false;

    function setState(next) { state = next; sheet.dataset.state = next; }
    function say(msg) { live.textContent = ''; requestAnimationFrame(() => { live.textContent = msg; }); }

    const outCubic = (t) => 1 - (1 - t) ** 3;
    const outBack = (t, s = 1.5) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;

    let armed = false, ac = null, noiseBuf = null;
    const armP = () => { armed = true; };
    const armK = () => { armed = true; };
    window.addEventListener('pointerdown', armP, { once: true, passive: true });
    window.addEventListener('keydown', armK, { once: true });

    function ctx() {
      if (!armed) return null;
      if (ac === null) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = false; } }
      if (ac && ac.state === 'suspended') ac.resume();
      return ac || null;
    }

    function noise(c) {
      if (!noiseBuf) {
        const len = Math.floor(c.sampleRate * 0.6);
        noiseBuf = c.createBuffer(1, len, c.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true; return src;
    }

    function click() {
      const c = ctx(); if (!c) return;
      const t = c.currentTime;
      const hi = noise(c), bp = c.createBiquadFilter(), gh = c.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 4200; bp.Q.value = 0.9;
      gh.gain.setValueAtTime(0.0001, t); gh.gain.exponentialRampToValueAtTime(0.13, t+0.001); gh.gain.exponentialRampToValueAtTime(0.0001, t+0.03);
      hi.connect(bp).connect(gh).connect(c.destination); hi.start(t); hi.stop(t+0.05);
    }

    function whoosh(ms) {
      const c = ctx(); if (!c) return;
      const t = c.currentTime, d = ms/1000, src = noise(c), bp = c.createBiquadFilter(), g = c.createGain();
      bp.type = 'bandpass'; bp.Q.value = 1.3;
      bp.frequency.setValueAtTime(320,t); bp.frequency.exponentialRampToValueAtTime(1700,t+d*0.52); bp.frequency.exponentialRampToValueAtTime(420,t+d);
      g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(0.075,t+d*0.4); g.gain.linearRampToValueAtTime(0.05,t+d*0.72); g.gain.exponentialRampToValueAtTime(0.0001,t+d);
      src.connect(bp).connect(g).connect(c.destination); src.start(t); src.stop(t+d+0.05);
    }

    function tone(freq,dur,vol,type='sine',at=0){
      const c=ctx(); if(!c) return;
      const t=c.currentTime+at, o=c.createOscillator(), g=c.createGain();
      o.type=type; o.frequency.setValueAtTime(freq,t);
      g.gain.setValueAtTime(0.0001,t); g.gain.linearRampToValueAtTime(vol,t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t+dur+0.02);
    }

    const sndOk = ()=>{tone(659,0.11,0.075);tone(988,0.2,0.07,'sine',0.1);};
    const sndErr = ()=>{tone(196,0.16,0.085,'sawtooth');tone(147,0.22,0.065,'sawtooth',0.09);};
    const sndLock = ()=>{tone(523,0.09,0.05,'triangle');};

    const valueOf = () => inputs.map((i) => i.value).join('');
    const isComplete = () => valueOf().length === N;
    const firstEmpty = () => { const i = inputs.findIndex((el) => !el.value); return i === -1 ? N-1 : i; };

    function setDigit(i, ch, popDelay=-1) {
      const prev = digits[i].textContent;
      inputs[i].value = ch;
      slots[i].classList.toggle('is-filled', !!ch);
      if (prev === ch) return;
      digits[i].textContent = ch;
      if (popDelay < 0 || reduced) return;
      if (prev) {
        const ghost = digits[i].cloneNode(false); ghost.textContent = prev; wins[i].appendChild(ghost);
        const out = play(ghost, [{transform:'scale(1)',opacity:1},{transform:'scale(0.7)',opacity:0}], {duration:200,delay:popDelay,easing:'cubic-bezier(0.5,0,0.75,0)',fill:'backwards'});
        out.finished.then(()=>ghost.remove(),()=>ghost.remove());
      }
      if (!ch) return;
      play(digits[i],[{transform:'scale(1.45)',opacity:0,offset:0},{transform:'scale(0.95)',opacity:1,offset:0.55},{transform:'scale(1)',opacity:1,offset:1}],{duration:330,delay:popDelay,easing:'cubic-bezier(0.2,1.25,0.3,1)',fill:'backwards'});
      play(halos[i],[{transform:'scale(0.88)',opacity:0},{transform:'scale(1.04)',opacity:0.85,offset:0.42},{transform:'scale(1.2)',opacity:0}],{duration:640,delay:popDelay+30,easing:'cubic-bezier(0.2,0.7,0.3,1)'});
      setTimeout(click, popDelay);
    }

    function charge(i, delay=0, duration=700) {
      if (reduced) return;
      play(arcs[i],[{strokeDashoffset:1},{strokeDashoffset:0}],{duration,delay,easing:'cubic-bezier(0.35,0,0.15,1)'});
      play(sparks[i],[{opacity:0,offset:0},{opacity:1,offset:0.1},{opacity:1,offset:0.78},{opacity:0,offset:1}],{duration:duration+60,delay,easing:'linear'});
    }

    function measureOrbit() {
      const r = slots.map((s)=>s.getBoundingClientRect()); const box = wrap.getBoundingClientRect();
      const w=r[0].width, h=r[0].height, cx=(r[0].left+r[N-1].right)/2, cy=r[0].top+h/2, R=w*ORBIT_R;
      const p=r.map((b)=>[b.left+b.width/2, b.top+b.height/2]);
      const a0=p.map(([x])=>(x<cx?Math.PI:0)), r0=p.map(([x])=>Math.abs(x-cx));
      
      // Changed to support N=6 slots in a circle
      const a1=slots.map((_,i)=>Math.PI+(i*TAU/N));
      const turn=a1.map((a,i)=>{let d=(a-a0[i])%TAU; if(d<0)d+=TAU; if(d>Math.PI)d-=TAU; return d;});
      return {w,h,R,cx,cy,box,p,a0,r0,a1,turn};
    }

    function at(g,i,ang,rad,rot,sc){
      const x=g.cx+Math.cos(ang)*rad-g.p[i][0], y=g.cy+Math.sin(ang)*rad-g.p[i][1];
      return `translate(${round(x)}px,${round(y)}px) rotate(${round(rot)}deg) scale(${round(sc)})`;
    }

    function ringDelta(g,i){return [round(g.cx+Math.cos(g.a1[i])*g.R-g.p[i][0]),round(g.cy+Math.sin(g.a1[i])*g.R-g.p[i][1])];}

    function layoutOrbit(g){
      const L=g.box.left, O=g.box.top, d=g.R*2;
      track.style.width=`${round(d)}px`; track.style.height=`${round(d)}px`;
      track.style.left=`${round(g.cx-g.R-L)}px`; track.style.top=`${round(g.cy-g.R-O)}px`;
      hub.style.left=`${round(g.cx-L)}px`; hub.style.top=`${round(g.cy-O)}px`;
    }

    function clearOrbit(){track.style.opacity='';track.style.transform='';hub.style.opacity='';hub.style.transform='';}

    const MOTES=18;
    function throwMotes(){
      if(reduced) return;
      for(let i=0;i<MOTES;i++){
        const mote=document.createElement('span'); mote.className='mote';
        if(i%3===0) mote.classList.add('mote--sm');
        if(i%5===0) mote.classList.add('mote--lg');
        if(i%4===1) mote.classList.add('mote--pale');
        burst.appendChild(mote);
        const a=(i/MOTES)*TAU+(Math.random()-0.5)*0.55, dist=74+Math.random()*76;
        const anim=mote.animate([
          {transform:'translate(0,0) scale(0.2)',opacity:0,offset:0},
          {transform:`translate(${Math.cos(a)*dist*0.36}px,${Math.sin(a)*dist*0.36}px) scale(1)`,opacity:1,offset:0.2},
          {transform:`translate(${Math.cos(a)*dist}px,${Math.sin(a)*dist+18}px) scale(0.4)`,opacity:0,offset:1},
        ],{duration:1100+Math.random()*420,delay:60+Math.random()*130,easing:'cubic-bezier(0.12,0.75,0.28,1)'});
        running.push(anim);
        anim.finished.then(()=>mote.remove(),()=>mote.remove());
      }
    }

    function focusSlot(i){const el=inputs[Math.max(0,Math.min(N-1,i))]; el.focus({preventScroll:true}); el.select();}

    function onInput(e,i){
      if(state==='error') abortErrorHold();
      const typed=e.target.value.replace(/\D/g,'');
      if(!typed){setDigit(i,'',0);setState('filling');return;}
      if(typed.length>1){distribute(typed,i);return;}
      setDigit(i,typed,0); charge(i); setState('filling');
      if(i<N-1&&!isComplete()) focusSlot(i+1); else if(i<N-1) focusSlot(firstEmpty());
      maybeSubmit();
    }

    function distribute(str,from){
      const chars=str.slice(0,N), start=chars.length>=N?0:from; let i=start;
      for(const ch of chars){if(i>=N)break; setDigit(i,ch,(i-start)*60); charge(i,(i-start)*60); i++;}
      setState('filling'); focusSlot(Math.min(i,N-1)); maybeSubmit();
    }

    function onKeyDown(e,i){
      if(e.metaKey||e.ctrlKey) return;
      if(state==='error') abortErrorHold();
      switch(e.key){
        case 'Backspace': e.preventDefault(); if(inputs[i].value){setDigit(i,'',0);}else if(i>0){setDigit(i-1,'',0);focusSlot(i-1);} setState('filling'); break;
        case 'Delete': e.preventDefault(); setDigit(i,'',0); break;
        case 'ArrowLeft': e.preventDefault(); focusSlot(i-1); break;
        case 'ArrowRight': e.preventDefault(); focusSlot(i+1); break;
        case 'Home': e.preventDefault(); focusSlot(0); break;
        case 'End': e.preventDefault(); focusSlot(firstEmpty()); break;
        default: break;
      }
    }

    function onPaste(e,i){
      const text=(e.clipboardData||window.clipboardData)?.getData('text')??'';
      const only=text.replace(/\D/g,''); if(!only) return;
      e.preventDefault(); if(state==='error') abortErrorHold(); distribute(only,i);
    }

    function onFocusSlot(i){
      inputs[i].select(); const target=firstEmpty();
      if(redirecting||isComplete()||i<=target) return;
      redirecting=true; focusSlot(target); requestAnimationFrame(()=>{redirecting=false;});
    }

    inputs.forEach((el,i)=>{
      el.addEventListener('input',(e)=>onInput(e,i));
      el.addEventListener('keydown',(e)=>onKeyDown(e,i));
      el.addEventListener('paste',(e)=>onPaste(e,i));
      el.addEventListener('focus',()=>onFocusSlot(i));
    });

    let submitTimer=0;
    function maybeSubmit(){
      clearTimeout(submitTimer);
      if(!isComplete()||state==='checking'||state==='ok') return;
      submitTimer=setTimeout(()=>{if(isComplete()&&state!=='checking'&&state!=='ok') form.requestSubmit();},reduced?0:340);
    }

    form.addEventListener('submit',(e)=>{
      e.preventDefault();
      if(state==='checking'||state==='ok') return;
      if(!isComplete()){focusSlot(firstEmpty());return;}
      check(valueOf());
    });

    async function check(entered){
      setState('checking');
      errEl.textContent='';
      inputs.forEach((el)=>{el.disabled=true;el.removeAttribute('aria-invalid');});
      say('Checking your code.');
      const token=++runId;
      try{
        const {data,error}=await supabase.auth.verifyOtp({email,token:entered,type:'email'});
        if(error) throw error;
        if(reduced){succeed();setTimeout(()=>onVerify(data),1000);return;}
        await gyre(token);
        if(token!==runId) return;
        succeed();
        setTimeout(()=>onVerify(data),2000);
      }catch(err){
        if(token!==runId) return;
        fail(err.message||'Incorrect code. Please try again.');
      }
    }

    async function gyre(token){
      const g=measureOrbit(); layoutOrbit(g);
      const CURL_STEPS=20;
      slots.forEach((s,i)=>{
        const frames=[{transform:at(g,i,g.a0[i],g.r0[i],0,1),offset:0},{transform:at(g,i,g.a0[i],g.r0[i],0,0.9),offset:0.16}];
        for(let k=1;k<=CURL_STEPS;k++){
          const t=k/CURL_STEPS, e=outBack(t), ang=g.a0[i]+g.turn[i]*outCubic(t), rad=g.r0[i]+(g.R-g.r0[i])*e;
          frames.push({transform:at(g,i,ang,rad,0,0.9+0.1*outCubic(t)),offset:0.16+0.84*t});
        }
        play(s,frames,{duration:CURL_MS,delay:i*CURL_LAG,easing:'linear',fill:'forwards'});
        setTimeout(click,i*CURL_LAG);
      });
      track.style.opacity='1';
      play(track,[{transform:'scale(0.72) rotate(-24deg)',opacity:0},{transform:'scale(1) rotate(0deg)',opacity:1}],{duration:CURL_MS,easing:'cubic-bezier(0.22,1,0.36,1)',fill:'both'});
      await wait(CURL_MS+CURL_LAG*(N-1)+60); if(token!==runId) return;

      const total=TURNS*360, REST=total%360;
      slots.forEach((s,i)=>{
        s.style.transformOrigin=`${round(g.cx-g.p[i][0]+g.w/2)}px ${round(g.cy-g.p[i][1]+g.h/2)}px`;
        const d=ringDelta(g,i);
        play(s,[{transform:`rotate(0deg) translate(${d[0]}px,${d[1]}px)`},{transform:`rotate(${total}deg) translate(${d[0]}px,${d[1]}px)`}],{duration:SPIN_MS,easing:'cubic-bezier(0.62,0,0.38,1)',fill:'forwards'});
        play(wins[i],[{transform:'rotate(0deg)',offset:0},{transform:'rotate(0deg)',offset:0.62},{transform:`rotate(${-REST}deg)`,offset:1}],{duration:SPIN_MS,easing:'cubic-bezier(0.32,0,0.2,1)',fill:'forwards'});
      });
      play(track,[{transform:'scale(1) rotate(0deg)',opacity:1,offset:0},{transform:'scale(1.05) rotate(34deg)',opacity:0.85,offset:0.5},{transform:'scale(1) rotate(52deg)',opacity:1,offset:1}],{duration:SPIN_MS,easing:'ease-in-out',fill:'forwards'});
      hub.style.opacity='1';
      play(hub,[{transform:'scale(0.3)',opacity:0},{transform:'scale(1)',opacity:0.9}],{duration:420,easing:'cubic-bezier(0.22,1,0.36,1)',fill:'forwards'});
      slots.forEach((_,i)=>charge(i,i*40,SPIN_MS*0.72));
      whoosh(SPIN_MS);
      await wait(SPIN_MS); if(token!==runId) return;

      sheet.dataset.locked=''; sndLock();
      slots.forEach((s)=>play(s.querySelector('.slot__glow'),[{transform:'scale(0.9)',opacity:0},{transform:'scale(1.18)',opacity:0.9,offset:0.4},{transform:'scale(1.4)',opacity:0}],{duration:520,easing:'cubic-bezier(0.2,0.7,0.3,1)'}));
      await wait(HOLD_MS); if(token!==runId) return;

      const END_S=0.24, EXTRA=150;
      slots.forEach((s,i)=>{
        const d=ringDelta(g,i);
        play(s,[{transform:`rotate(0deg) translate(${d[0]}px,${d[1]}px) scale(1)`},{transform:`rotate(${EXTRA}deg) translate(${-END_S*d[0]}px,${-END_S*d[1]}px) scale(${END_S})`}],{duration:SCREW_MS,delay:i*SCREW_LAG,easing:'cubic-bezier(0.62,0,0.38,1)',fill:'forwards'});
      });
      play(track,[{transform:'scale(1)',opacity:1},{transform:'scale(0.3)',opacity:0}],{duration:SCREW_MS,easing:'ease-in',fill:'forwards'});
      play(hub,[{transform:'scale(1)',opacity:0.9},{transform:'scale(0)',opacity:0}],{duration:SCREW_MS*0.7,delay:SCREW_MS*0.3,easing:'ease-in',fill:'forwards'});
      await wait(SCREW_MS+SCREW_LAG*(N-1));
    }

    function succeed(){
      setState('ok'); delete sheet.dataset.locked; clearOrbit();
      sndOk(); throwMotes(); say('Verified successfully.');
      if(done){done.removeAttribute('inert'); foot.style.pointerEvents='none';}
    }

    let errTimer=0;
    function fail(msg='Incorrect code. Please try again.'){
      setState('error'); delete sheet.dataset.locked; clearOrbit();
      running.forEach((a)=>a.cancel()); running=[];
      inputs.forEach((el,i)=>{el.disabled=false;el.setAttribute('aria-invalid','true');setDigit(i,'',-1);});
      errEl.textContent=msg; sndErr(); say('Error: '+msg);
      errTimer=setTimeout(()=>{if(state==='error'){setState('filling');errEl.textContent='';focusSlot(0);}},3200);
    }

    function abortErrorHold(){clearTimeout(errTimer);setState('filling');errEl.textContent='';}

    function startCooldown(){
      let s=COOLDOWN;
      resendLabel.textContent=`Resend in ${s}s`; resend.disabled=true;
      coolTimer=setInterval(()=>{
        s--;
        if(s<=0){clearInterval(coolTimer);coolTimer=0;resendLabel.textContent='Resend';resend.disabled=false;}
        else{resendLabel.textContent=`Resend in ${s}s`;}
      },1000);
    }

    resend.addEventListener('click',async()=>{
      if(coolTimer) return; resend.disabled=true; say('Sending new code.');
      try{
        const{error}=await supabase.auth.signInWithOtp({email});
        if(error) throw error; say('Code sent.'); startCooldown();
      }catch(e){say('Failed to send: '+e.message);resend.disabled=false;}
    });

    setTimeout(()=>focusSlot(0),100);

    return()=>{
      clearTimeout(submitTimer); clearTimeout(errTimer); clearInterval(coolTimer);
      running.forEach((a)=>{try{a.cancel();}catch{}});
      window.removeEventListener('pointerdown',armP);
      window.removeEventListener('keydown',armK);
      if(ac){try{ac.close();}catch{}}
    };
  }, [email, onVerify]);

  return (
    <div className="stage" ref={containerRef} style={{margin:'0 auto',width:'100%'}}>
      <section className="sheet" data-state="idle">
        <form className="verify" id="verify">
          <h2 className="verify__title" id="v-title">
            <span className="verify__title-in" data-title-idle="true">Verify your email</span>
            <span className="verify__title-in" data-title-ok="true">Verified successfully</span>
          </h2>
          <p className="verify__sub" id="v-sub">
            <span className="verify__sub-in" data-sub-idle="true">Enter the 6-digit code we sent to <b>{email}</b>.</span>
            <span className="verify__sub-in" data-sub-ok="true">Your email has been verified.</span>
          </p>

          <div className="code-wrap">
            <div className="orbit" aria-hidden="true">
              <svg className="orbit__ring" data-track="true" viewBox="0 0 100 100" focusable="false">
                <circle className="orbit__path" cx="50" cy="50" r="50" pathLength="1" vectorEffect="non-scaling-stroke" />
              </svg>
              <span className="orbit__hub" data-hub="true"></span>
            </div>

            <div className="code" role="group" aria-labelledby="v-title" aria-describedby="v-help v-err" data-code="true" style={{ gap: '6px' }}>
              {[0,1,2,3,4,5].map((idx)=>(
                <label className="slot" key={idx} style={{ width: '40px', height: '56px' }}>
                  <span className="sr-only">Digit {idx+1} of 6</span>
                  <input className="slot__input" type="text" inputMode="numeric" pattern="[0-9]*"
                    maxLength={idx===0?6:1} autoComplete={idx===0?'one-time-code':'off'}
                    enterKeyHint="done" aria-describedby="v-err" />
                  <span className="slot__win" aria-hidden="true"><span className="slot__digit"></span></span>
                  <span className="slot__glow" aria-hidden="true"></span>
                  <svg className="slot__spark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
                    <rect className="slot__arc" x="1" y="1" width="62" height="62" rx="15" pathLength="1" strokeLinecap="round" />
                  </svg>
                </label>
              ))}
            </div>

            <div className="seal" aria-hidden="true">
              <span className="seal__ring"></span>
              <span className="seal__ring seal__ring--wide"></span>
              <span className="seal__tile">
                <span className="seal__sheen"></span>
                <svg viewBox="0 0 40 40" fill="none" focusable="false">
                  <path className="seal__check" d="M11 20.5 L17.5 27 L29 15" pathLength="1" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>

            <div className="burst" data-burst="true" aria-hidden="true"></div>
          </div>

          <p className="verify__err" id="v-err" data-err="true"></p>
          <p className="sr-only" id="v-help">Six digits. You can paste the whole code into any box.</p>

          <div className="verify__actions">
            <div className="verify__foot">
              <span className="verify__foot-label">Didn't receive the code?&nbsp;</span>
              <button type="button" className="resend" data-resend="true">
                <span className="resend__label" data-resend-label="true">Resend</span>
              </button>
            </div>
            <div className="verify__done" inert="true" data-done="true">
              <span className="secure">
                <svg className="secure__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                  <rect x="4.5" y="10.5" width="15" height="10" rx="3" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
                Verified and secure
              </span>
              <button type="button" className="cta" data-continue="true" onClick={(e)=>{e.preventDefault();onVerify();}}>Continue</button>
            </div>
          </div>

          <button type="submit" className="sr-only">Verify code</button>
        </form>
      </section>

      <button type="button" onClick={onCancel}
        style={{background:'none',border:'none',cursor:'pointer',marginTop:'16px',color:'rgba(255,255,255,0.3)',fontSize:'11px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.2em',width:'100%',textAlign:'center',transition:'color 0.2s'}}
        onMouseEnter={(e)=>(e.target.style.color='rgba(255,255,255,0.8)')}
        onMouseLeave={(e)=>(e.target.style.color='rgba(255,255,255,0.3)')}
      >
        ← Cancel, use password instead
      </button>

      <p className="sr-only" role="status" aria-live="polite" data-live="true"></p>
    </div>
  );
}
