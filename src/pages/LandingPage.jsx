import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './LandingPage.css';

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const featureCardsRef = useRef([]);
  
  const addToFeatures = (el) => {
    if (el && !featureCardsRef.current.includes(el)) {
      featureCardsRef.current.push(el);
    }
  };

  useEffect(() => {
    // ---------- reveal on scroll ----------
    const revealEls = document.querySelectorAll('.reveal, .reveal-scale');
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting){
          e.target.classList.add('in');
        }
      });
    },{threshold:0.2});
    revealEls.forEach(el=>io.observe(el));

    // ---------- GSAP Feature Cards Animation ----------
    gsap.fromTo(featureCardsRef.current, 
      { opacity: 0, y: 50, scale: 0.95 },
      {
        opacity: 1, 
        y: 0, 
        scale: 1,
        duration: 0.8, 
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: {
          trigger: ".feature-grid",
          start: "top 80%",
          toggleActions: "play none none reverse"
        }
      }
    );

    // bars animate
    const barsBox = document.querySelector('.bars');
    let barIo;
    if(barsBox){
      barIo = new IntersectionObserver((entries)=>{
        entries.forEach(e=>{ if(e.isIntersecting){ barsBox.classList.add('in'); barIo.disconnect(); } });
      },{threshold:0.3});
      barIo.observe(barsBox);
    }

    // animated counters
    const counters = document.querySelectorAll('.counter');
    let counterIo;
    if(counters.length > 0){
      counterIo = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting){
          const el = e.target;
          const target = parseInt(el.dataset.target,10);
          const prefix = el.dataset.prefix || '';
          const dur = 1400; let start = null;
          function step(ts){
            if(!start) start = ts;
            const p = Math.min((ts-start)/dur,1);
            const eased = 1 - Math.pow(1-p,3);
            const val = Math.floor(eased*target);
            el.textContent = prefix + val.toLocaleString('en-IN');
            if(p<1) requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
          counterIo.unobserve(el);
        }
      });
    },{threshold:0.4});
    counters.forEach(c=>counterIo.observe(c));
    }

    // budget ring fill
    const ring = document.getElementById('budget-ring');
    if(ring){
      const ringIo = new IntersectionObserver((entries)=>{
        entries.forEach(e=>{
          if(e.isIntersecting){ ring.style.setProperty('--deg','230deg'); ringIo.disconnect(); }
        });
      },{threshold:0.4});
      ringIo.observe(ring);
    }

    // signal path node labels
    (function(){
      const svg = document.getElementById('sigpath');
      if(!svg) return;
      const labels = ['UPI Transaction','Detected','Merchant ID','Category','Recorded','Analytics'];
      const g = document.getElementById('sig-nodes');
      // Clear existing nodes if any to prevent duplicates on strict-mode re-renders
      while (g.firstChild) { g.removeChild(g.firstChild); }
      const len = svg.getTotalLength();
      labels.forEach((txt,i)=>{
        const pt = svg.getPointAtLength((len/(labels.length-1))*i);
        const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
        c.setAttribute('cx',pt.x); c.setAttribute('cy',pt.y); c.setAttribute('r',4.5);
        c.setAttribute('class','node-circle');
        g.appendChild(c);
        const t = document.createElementNS('http://www.w3.org/2000/svg','text');
        t.setAttribute('x',pt.x); t.setAttribute('y', i%2===0 ? pt.y-16 : pt.y+24);
        t.setAttribute('text-anchor','middle');
        t.setAttribute('class','node-label');
        t.textContent = txt;
        g.appendChild(t);
      });
    })();

    // ---------- three.js: persistent scroll-driven 3D flythrough ----------
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cleanupThree = () => {};
    const canvas = canvasRef.current;
    if(canvas){
      const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 100);
      camera.position.set(0,0,7);

      function resize(){
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth/window.innerHeight;
        camera.updateProjectionMatrix();
      }
      resize();
      window.addEventListener('resize', resize);

      const coreGroup = new THREE.Group();
      scene.add(coreGroup);

      // core wireframe icosphere ("the financial core")
      const coreGeo = new THREE.IcosahedronGeometry(1.7, 2);
      const coreMat = new THREE.MeshBasicMaterial({color:0x34ffb4, wireframe:true, transparent:true, opacity:0.55});
      const core = new THREE.Mesh(coreGeo, coreMat);
      coreGroup.add(core);

      const glowGeo = new THREE.IcosahedronGeometry(1.72, 2);
      const glowMat = new THREE.MeshBasicMaterial({color:0x34ffb4, transparent:true, opacity:0.05});
      const glow = new THREE.Mesh(glowGeo, glowMat);
      coreGroup.add(glow);

      const innerGeo = new THREE.IcosahedronGeometry(0.9, 1);
      const innerMat = new THREE.MeshBasicMaterial({color:0xffcf6b, wireframe:true, transparent:true, opacity:0.3});
      const innerCore = new THREE.Mesh(innerGeo, innerMat);
      coreGroup.add(innerCore);

      // orbit rings of points
      function makeRing(radius, count, color, tilt, baseOpacity){
        const geo = new THREE.BufferGeometry();
        const positions = [];
        for(let i=0;i<count;i++){
          const a = (i/count)*Math.PI*2;
          positions.push(Math.cos(a)*radius, Math.sin(a)*radius*0.3, Math.sin(a)*radius);
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
        const mat = new THREE.PointsMaterial({color, size:0.06, transparent:true, opacity:baseOpacity});
        const pts = new THREE.Points(geo, mat);
        pts.rotation.x = tilt;
        pts.userData.baseOpacity = baseOpacity;
        coreGroup.add(pts);
        return pts;
      }
      const ring1 = makeRing(2.6, 40, 0x34ffb4, 0.4, 0.9);
      const ring2 = makeRing(3.3, 60, 0xffcf6b, -0.25, 0.75);
      const ring3 = makeRing(4.0, 30, 0xffffff, 0.15, 0.5);
      const rings = [ring1, ring2, ring3];

      // deep background particle field (parallaxes slower than the core)
      const starGeo = new THREE.BufferGeometry();
      const starCount = 700;
      const starPos = [];
      for(let i=0;i<starCount;i++){
        starPos.push((Math.random()-0.5)*40,(Math.random()-0.5)*30,(Math.random()-0.5)*30-8);
      }
      starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos,3));
      const starMat = new THREE.PointsMaterial({color:0xffffff, size:0.03, transparent:true, opacity:0.5});
      const starField = new THREE.Points(starGeo, starMat);
      scene.add(starField);

      const KF = [
        {t:0.00, cam:[0,0,7],     look:[0,0,0],    scale:1.00, pos:[0,0,0],       color:0x34ffb4, ring:1.00},
        {t:0.10, cam:[1.6,0.3,6.0],look:[0.5,0,0], scale:0.85, pos:[1.2,0.2,-0.6],color:0x34ffb4, ring:0.55},
        {t:0.27, cam:[-1.8,0.2,5.2],look:[-0.6,0,0],scale:0.68,pos:[-1.4,0.1,-1.1],color:0xffcf6b, ring:0.35},
        {t:0.42, cam:[0,0.7,4.4], look:[0,0,0],    scale:0.48, pos:[0,0.3,-1.7],  color:0x34ffb4, ring:0.20},
        {t:0.56, cam:[1.9,-0.2,5.0],look:[0.6,0,0],scale:0.62, pos:[1.3,-0.2,-0.9],color:0xffcf6b, ring:0.45},
        {t:0.70, cam:[-1.5,0.15,4.6],look:[-0.4,0,0],scale:0.42,pos:[-1.1,0.1,-1.5],color:0x34ffb4, ring:0.25},
        {t:0.84, cam:[0,0,3.2],   look:[0,0,0],    scale:1.35, pos:[0,0,-0.2],    color:0x34ffb4, ring:0.95},
        {t:1.00, cam:[0,0,7.5],   look:[0,0,0],    scale:1.00, pos:[0,0,0],       color:0x34ffb4, ring:0.65}
      ];
      function lerp(a,b,p){return a+(b-a)*p;}
      function lerpArr(a,b,p){return [lerp(a[0],b[0],p),lerp(a[1],b[1],p),lerp(a[2],b[2],p)];}
      const _c1 = new THREE.Color(), _c2 = new THREE.Color(), _cOut = new THREE.Color();
      function sampleKeyframes(t){
        t = Math.max(0, Math.min(1, t));
        let k0 = KF[0], k1 = KF[KF.length-1];
        for(let i=0;i<KF.length-1;i++){
          if(t >= KF[i].t && t <= KF[i+1].t){ k0 = KF[i]; k1 = KF[i+1]; break; }
        }
        const span = (k1.t - k0.t) || 1;
        const p = (t - k0.t) / span;
        _c1.set(k0.color); _c2.set(k1.color); _cOut.copy(_c1).lerp(_c2, p);
        return {
          cam: lerpArr(k0.cam, k1.cam, p),
          look: lerpArr(k0.look, k1.look, p),
          scale: lerp(k0.scale, k1.scale, p),
          pos: lerpArr(k0.pos, k1.pos, p),
          color: _cOut.getHex(),
          ring: lerp(k0.ring, k1.ring, p)
        };
      }

      const camTarget = new THREE.Vector3(0,0,7);
      const lookTarget = new THREE.Vector3(0,0,0);
      const currentLook = new THREE.Vector3(0,0,0);

      let mouseX = 0, mouseY = 0;
      const handleMouseMove = (e) => {
        mouseX = (e.clientX/window.innerWidth - 0.5);
        mouseY = (e.clientY/window.innerHeight - 0.5);
      };
      window.addEventListener('mousemove', handleMouseMove);

      let scrollFrac = 0;
      function updateScroll(){
        const max = document.documentElement.scrollHeight - window.innerHeight;
        scrollFrac = max > 0 ? window.scrollY / max : 0;
      }
      window.addEventListener('scroll', updateScroll, {passive:true});
      updateScroll();

      let animationFrameId;
      function animate(){
        animationFrameId = requestAnimationFrame(animate);
        const s = sampleKeyframes(scrollFrac);

        if(!reduceMotion){
          core.rotation.y += 0.0025;
          core.rotation.x += 0.0008;
          innerCore.rotation.y -= 0.0018;
          ring1.rotation.y += 0.0016;
          ring2.rotation.y -= 0.0011;
          ring3.rotation.y += 0.0008;
          starField.rotation.y += 0.00015;
        }

        // core group travels + resizes + recolors as the page scrolls
        coreGroup.position.lerp(new THREE.Vector3(s.pos[0], s.pos[1], s.pos[2]), 0.08);
        const targetScale = s.scale;
        coreGroup.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.08);
        core.material.color.lerp(new THREE.Color(s.color), 0.05);
        glow.material.color.lerp(new THREE.Color(s.color), 0.05);
        rings.forEach(r=>{ r.material.opacity = lerp(r.material.opacity, r.userData.baseOpacity * s.ring, 0.08); });

        // camera flies to the scroll-driven waypoint, with mouse parallax layered on top
        camTarget.set(s.cam[0] + mouseX*1.1, s.cam[1] - mouseY*0.7, s.cam[2]);
        camera.position.lerp(camTarget, 0.06);
        lookTarget.set(s.look[0], s.look[1], s.look[2]);
        currentLook.lerp(lookTarget, 0.06);
        camera.lookAt(currentLook);

        renderer.render(scene, camera);
      }
      animate();

      cleanupThree = () => {
        window.removeEventListener('resize', resize);
        window.removeEventListener('mousemove', handleMouseMove);
        
        scene.traverse((object) => {
          if (!object.isMesh) return;
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (object.material.isMaterial) {
              cleanMaterial(object.material);
            } else {
              for (const material of object.material) cleanMaterial(material);
            }
          }
        });
        
        function cleanMaterial(material) {
          material.dispose();
          if (material.map) material.map.dispose();
          if (material.lightMap) material.lightMap.dispose();
          if (material.bumpMap) material.bumpMap.dispose();
          if (material.normalMap) material.normalMap.dispose();
          if (material.specularMap) material.specularMap.dispose();
          if (material.envMap) material.envMap.dispose();
        }
        
        renderer.dispose();
      };
    } // end if(canvas)

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      
      // Disconnect Observers
      if (io) io.disconnect();
      if (barIo) barIo.disconnect();
      if (counterIo) counterIo.disconnect();
      
      // Kill GSAP ScrollTriggers
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
      
      // Clean up Three.js Memory safely
      try {
        cleanupThree();
      } catch (e) {
        console.error("Cleanup error:", e);
      }
    };
  }, []);

  return (
    <div className="landing-wrapper">
      <div className="stars"></div>
      <div className="grad-bg"></div>

      <nav>
        <div className="logo"><span className="logo-dot"></span>Orbit</div>
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#dashboard">Dashboard</a>
          <a href="#analytics">Analytics</a>
          <a href="#security">Security</a>
        </div>
        <a onClick={() => navigate('/auth')} className="nav-cta">Get started</a>
      </nav>

      {/* HERO */}
      <section className="hero" style={{padding:0}}>
        <canvas id="hero-canvas" ref={canvasRef}></canvas>
        <div className="hero-content">
          <div className="eyebrow" style={{justifyContent:'center'}}>Expense intelligence</div>
          <h1>Understand where your money goes.<br/><span>Control every expense.</span></h1>
          <p>Orbit turns every transaction into a signal — tracked, categorized, and visualized the moment it happens.</p>
          <div className="hero-cta-row">
            <a onClick={() => navigate('/auth')} className="btn-primary">Start Managing Expenses</a>
            <a href="#features" className="btn-secondary">Explore Features</a>
          </div>
        </div>
        <div className="scroll-hint"><span>SCROLL</span><span className="scroll-line"></span></div>
      </section>

      {/* FEATURES */}
      <section id="features">
        <div className="section-head reveal">
          <div className="eyebrow">Orbital modules</div>
          <h2>Every feature, docked to one core.</h2>
          <p>Each module runs independently but feeds the same financial core — so nothing you track ever sits in isolation.</p>
        </div>
        <div className="feature-grid">
          <div className="panel feature-card" ref={addToFeatures}><span className="tag">01</span>
            <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
            <h3>Year Breakdown</h3><p>View your spending month by month with deep telemetry and historical data tracking.</p>
          </div>
          <div className="panel feature-card" ref={addToFeatures}><span className="tag">02</span>
            <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
            <h3>Goal Savings Jars</h3><p>Visualize your financial targets and seamlessly track progress across all your bank balances.</p>
          </div>
          <div className="panel feature-card" ref={addToFeatures}><span className="tag">03</span>
            <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
            <h3>Friends & Splits</h3><p>Track money you are owed and settle debts instantly with multiplayer social tracking.</p>
          </div>
          <div className="panel feature-card" ref={addToFeatures}><span className="tag">04</span>
            <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg></div>
            <h3>Export Data & Reports</h3><p>Download your expenses as a CSV or generate beautiful PDF reports with breakdowns.</p>
          </div>
          <div className="panel feature-card" ref={addToFeatures}><span className="tag">05</span>
            <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg></div>
            <h3>Find & Merge Duplicates</h3><p>Intelligent algorithms automatically find and clean up double-logged expenses for accuracy.</p>
          </div>
          <div className="panel feature-card" ref={addToFeatures}><span className="tag">06</span>
            <div className="feature-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
            <h3>Daily Summaries</h3><p>Get timely push notifications and daily wrap-ups to ensure you stay perfectly on budget.</p>
          </div>
        </div>
      </section>

      {/* DASHBOARD SHOWCASE */}
      <section id="dashboard">
        <div className="section-head reveal">
          <div className="eyebrow">Mission control</div>
          <h2>Your finances, assembled live.</h2>
          <p>The full picture — balance, income, spend, and savings — docked into one glass interface.</p>
        </div>
        <div className="panel dash-panel reveal-scale">
          <div className="dash-stats">
            <div className="stat-box"><div className="label">Total balance</div><div className="value counter" data-target="184320" data-prefix="₹">₹0</div></div>
            <div className="stat-box"><div className="label">Monthly income</div><div className="value accent counter" data-target="96000" data-prefix="₹">₹0</div></div>
            <div className="stat-box"><div className="label">Monthly expenses</div><div className="value counter" data-target="62150" data-prefix="₹">₹0</div></div>
            <div className="stat-box"><div className="label">Savings</div><div className="value gold counter" data-target="33850" data-prefix="₹">₹0</div></div>
          </div>
          <div className="dash-grid">
            <div className="chart-box">
              <h4>Spending — last 6 months</h4>
              <div className="bars"><div className="bar" style={{height:'52%'}}></div><div className="bar" style={{height:'70%'}}></div><div className="bar" style={{height:'38%'}}></div><div className="bar" style={{height:'85%'}}></div><div className="bar" style={{height:'60%'}}></div><div className="bar" style={{height:'64%'}}></div></div>
            </div>
            <div className="chart-box">
              <h4>Recent transactions</h4>
              <div className="txn-list">
                <div className="txn-row"><div className="txn-left"><div className="txn-dot">🍔</div><div><div className="txn-name">Swiggy</div><div className="txn-cat">Food</div></div></div><div className="txn-amt neg">-₹420</div></div>
                <div className="txn-row"><div className="txn-left"><div className="txn-dot">💼</div><div><div className="txn-name">Salary</div><div className="txn-cat">Income</div></div></div><div className="txn-amt pos">+₹96,000</div></div>
                <div className="txn-row"><div className="txn-left"><div className="txn-dot">🚕</div><div><div className="txn-name">Uber</div><div className="txn-cat">Travel</div></div></div><div className="txn-amt neg">-₹260</div></div>
                <div className="txn-row"><div className="txn-left"><div className="txn-dot">💡</div><div><div className="txn-name">Electricity</div><div className="txn-cat">Bills</div></div></div><div className="txn-amt neg">-₹1,840</div></div>
              </div>
            </div>
          </div>
          <div style={{marginTop:'22px'}} className="chart-box">
            <h4 style={{marginBottom:'20px'}}>Budget progress — this month</h4>
            <div className="budget-ring-wrap">
              <div className="budget-ring" id="budget-ring"><span>64%</span></div>
              <div>
                <div style={{fontSize:'14px',color:'var(--text-muted)'}}>₹62,150 of ₹97,000 spent</div>
                <div style={{fontSize:'12px',color:'var(--text-dim)',marginTop:'6px'}}>On track for the month</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRANSACTION SIGNAL PATH */}
      <section>
        <div className="section-head reveal">
          <div className="eyebrow">Signal path</div>
          <h2>One transaction, start to finish.</h2>
          <p>Watch how a single UPI payment moves through Orbit in real time.</p>
        </div>
        <div className="panel signal-wrap reveal-scale" style={{padding:'40px 30px'}}>
          <svg className="signal-svg" viewBox="0 0 1000 140" preserveAspectRatio="xMidYMid meet">
            <path id="sigpath" className="signal-path" d="M40,70 C160,20 200,120 340,70 C480,20 520,120 660,70 C760,30 800,110 960,70"/>
            <g id="sig-nodes"></g>
            <circle className="signal-dot" r="5">
              <animateMotion dur="6s" repeatCount="indefinite" rotate="auto">
                <mpath href="#sigpath"/>
              </animateMotion>
            </circle>
          </svg>
        </div>
      </section>

      {/* ANALYTICS */}
      <section id="analytics">
        <div className="section-head reveal">
          <div className="eyebrow">Telemetry deck</div>
          <h2>Analytics with depth.</h2>
          <p>Not flat charts — a live read on trend, category, and savings rate.</p>
        </div>
        <div className="analytics-grid">
          <div className="panel chart-box reveal" style={{padding:'30px'}}>
            <h4>Category breakdown</h4>
            <div className="radial-chart">
              <svg width="220" height="220" viewBox="0 0 220 220">
                <circle cx="110" cy="110" r="90" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="16"/>
                <circle cx="110" cy="110" r="90" fill="none" stroke="#34ffb4" strokeWidth="16" strokeDasharray="565" strokeDashoffset="365" strokeLinecap="round" transform="rotate(-90 110 110)"/>
                <circle cx="110" cy="110" r="90" fill="none" stroke="#ffcf6b" strokeWidth="16" strokeDasharray="565" strokeDashoffset="480" strokeLinecap="round" transform="rotate(50 110 110)" opacity="0.85"/>
                <text x="110" y="104" textAnchor="middle" fill="#eef4f2" fontFamily="Space Grotesk" fontSize="26" fontWeight="600">35%</text>
                <text x="110" y="126" textAnchor="middle" fill="#8b96a6" fontFamily="IBM Plex Mono" fontSize="11">Food & Bills</text>
              </svg>
            </div>
          </div>
          <div className="reveal" style={{"--i":1}}>
            <div className="insight-card panel"><div className="insight-dot"></div><p>You spent 18% more on food this month.</p></div>
            <div className="insight-card panel"><div className="insight-dot"></div><p>Your transportation spending decreased by 12%.</p></div>
            <div className="insight-card panel"><div className="insight-dot"></div><p>You're on track to save ₹8,450 this month.</p></div>
            <p className="insight-note">Example insights shown for illustration.</p>
          </div>
        </div>
      </section>

      {/* BULK UPLOAD */}
      <section>
        <div className="section-head reveal">
          <div className="eyebrow">Data intake</div>
          <h2>Drop a file. Get clean records.</h2>
          <p>Raw spreadsheet rows resolve into categorized, ready-to-use expense cards.</p>
        </div>
        <div className="upload-flow reveal-scale">
          <div className="panel upload-col">
            <h4 style={{fontSize:'13px',color:'var(--text-muted)',marginBottom:'14px'}}>Raw CSV</h4>
            <div className="raw-row">28/07,ZOMATO,-410.00</div>
            <div className="raw-row">28/07,UBER*TRIP,-260.00</div>
            <div className="raw-row">29/07,BESCOM,-1840.00</div>
            <div className="raw-row">30/07,AMAZON,-1299.00</div>
            <div className="raw-row">31/07,SALARY-CR,96000.00</div>
          </div>
          <div className="upload-arrow">→</div>
          <div className="panel upload-col">
            <h4 style={{fontSize:'13px',color:'var(--text-muted)',marginBottom:'14px'}}>Categorized records</h4>
            <div className="clean-card"><span>Zomato · Food</span><span className="txn-amt neg">-₹410</span></div>
            <div className="clean-card"><span>Uber · Travel</span><span className="txn-amt neg">-₹260</span></div>
            <div className="clean-card"><span>BESCOM · Bills</span><span className="txn-amt neg">-₹1,840</span></div>
            <div className="clean-card"><span>Amazon · Shopping</span><span className="txn-amt neg">-₹1,299</span></div>
            <div className="clean-card"><span>Salary · Income</span><span className="txn-amt pos">+₹96,000</span></div>
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section id="security">
        <div className="section-head reveal" style={{margin:'0 auto 40px',textAlign:'center',maxWidth:'560px'}}>
          <div className="eyebrow" style={{justifyContent:'center'}}>Protective shell</div>
          <h2>Your data, kept in orbit — not exposed.</h2>
          <p style={{marginLeft:'auto',marginRight:'auto'}}>Every layer around your financial core exists to keep it yours alone.</p>
        </div>
        <div className="security-visual reveal-scale">
          <div className="shell">
            <div className="ring"></div><div className="ring"></div><div className="ring"></div>
            <div className="core"></div>
          </div>
        </div>
        <div className="security-labels reveal">
          <div className="sec-label">End-to-end encryption</div>
          <div className="sec-label">Multi-factor authentication</div>
          <div className="sec-label">Secure transaction layer</div>
          <div className="sec-label">Private by default</div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section id="cta" className="final-cta">
        <div className="reveal-scale">
          <div className="eyebrow" style={{justifyContent:'center'}}>Ready when you are</div>
          <h2>Take control of every rupee.</h2>
          <p>Track expenses, understand your spending, and make better financial decisions from one powerful platform.</p>
          <a onClick={() => navigate('/auth')} className="btn-primary">Start Managing Your Expenses</a>
        </div>
      </section>

      <footer>
        <div className="footer-inner">
          <div className="logo"><span className="logo-dot"></span>Orbit</div>
          <div className="footer-links">
            <div className="footer-col">
              <h5>Product</h5>
              <div className="contact-wrapper">
                <a href="#features">Features</a>
                <div className="contact-floating-window">
                  <h6>Orbit Modules</h6>
                  <p>Explore all tracking capabilities</p>
                </div>
              </div>
              <div className="contact-wrapper">
                <a href="#analytics">Analytics</a>
                <div className="contact-floating-window">
                  <h6>Telemetry Deck</h6>
                  <p>Deep insights and spending trends</p>
                </div>
              </div>
              <div className="contact-wrapper">
                <a href="#security">Security</a>
                <div className="contact-floating-window">
                  <h6>Protective Shell</h6>
                  <p>Military-grade encryption protocols</p>
                </div>
              </div>
            </div>
            <div className="footer-col">
              <h5>Company</h5>
              <div className="contact-wrapper">
                <a href="#">About</a>
                <div className="contact-floating-window">
                  <h6>Our Mission</h6>
                  <p>Expense intelligence built for you</p>
                </div>
              </div>
              <div className="contact-wrapper">
                <a style={{cursor: 'pointer'}}>Contact</a>
                <div className="contact-floating-window">
                  <h6>Vishnu Prabhakar</h6>
                  <p>p.vishnuprabhakar@gmail.com</p>
                </div>
              </div>
            </div>
            <div className="footer-col">
              <h5>Legal</h5>
              <div className="contact-wrapper">
                <a href="#">Privacy</a>
                <div className="contact-floating-window">
                  <h6>Data Policy</h6>
                  <p>Your data, kept strictly in orbit</p>
                </div>
              </div>
              <div className="contact-wrapper">
                <a href="#">Terms</a>
                <div className="contact-floating-window">
                  <h6>Agreement</h6>
                  <p>End-user license and terms</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="footer-inner footer-bottom"><span>© 2026 Orbit. All rights reserved.</span></div>
      </footer>
    </div>
  );
}
