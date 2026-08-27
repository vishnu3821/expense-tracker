import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function Background3D({ fixedScrollFrac = null }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cleanupThree = () => {};
    const canvas = canvasRef.current;
    
    if (canvas) {
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
      camera.position.set(0, 0, 7);

      function resize() {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
      }
      resize();
      window.addEventListener('resize', resize);

      const coreGroup = new THREE.Group();
      scene.add(coreGroup);

      // core wireframe icosphere ("the financial core")
      const coreGeo = new THREE.IcosahedronGeometry(1.7, 2);
      const coreMat = new THREE.MeshBasicMaterial({ color: 0x34ffb4, wireframe: true, transparent: true, opacity: 0.55 });
      const core = new THREE.Mesh(coreGeo, coreMat);
      coreGroup.add(core);

      const glowGeo = new THREE.IcosahedronGeometry(1.72, 2);
      const glowMat = new THREE.MeshBasicMaterial({ color: 0x34ffb4, transparent: true, opacity: 0.05 });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      coreGroup.add(glow);

      const innerGeo = new THREE.IcosahedronGeometry(0.9, 1);
      const innerMat = new THREE.MeshBasicMaterial({ color: 0xffcf6b, wireframe: true, transparent: true, opacity: 0.3 });
      const innerCore = new THREE.Mesh(innerGeo, innerMat);
      coreGroup.add(innerCore);

      // orbit rings of points
      function makeRing(radius, count, color, tilt, baseOpacity) {
        const geo = new THREE.BufferGeometry();
        const positions = [];
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2;
          positions.push(Math.cos(a) * radius, Math.sin(a) * radius * 0.3, Math.sin(a) * radius);
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({ color, size: 0.06, transparent: true, opacity: baseOpacity });
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

      // deep background particle field
      const starGeo = new THREE.BufferGeometry();
      const starCount = 700;
      const starPos = [];
      for (let i = 0; i < starCount; i++) {
        starPos.push((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30 - 8);
      }
      starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
      const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.03, transparent: true, opacity: 0.5 });
      const starField = new THREE.Points(starGeo, starMat);
      scene.add(starField);

      const KF = [
        { t: 0.00, cam: [0, 0, 7], look: [0, 0, 0], scale: 1.00, pos: [0, 0, 0], color: 0x34ffb4, ring: 1.00 },
        { t: 0.10, cam: [1.6, 0.3, 6.0], look: [0.5, 0, 0], scale: 0.85, pos: [1.2, 0.2, -0.6], color: 0x34ffb4, ring: 0.55 },
        { t: 0.27, cam: [-1.8, 0.2, 5.2], look: [-0.6, 0, 0], scale: 0.68, pos: [-1.4, 0.1, -1.1], color: 0xffcf6b, ring: 0.35 },
        { t: 0.42, cam: [0, 0.7, 4.4], look: [0, 0, 0], scale: 0.48, pos: [0, 0.3, -1.7], color: 0x34ffb4, ring: 0.20 },
        { t: 0.56, cam: [1.9, -0.2, 5.0], look: [0.6, 0, 0], scale: 0.62, pos: [1.3, -0.2, -0.9], color: 0xffcf6b, ring: 0.45 },
        { t: 0.70, cam: [-1.5, 0.15, 4.6], look: [-0.4, 0, 0], scale: 0.42, pos: [-1.1, 0.1, -1.5], color: 0x34ffb4, ring: 0.25 },
        { t: 0.84, cam: [0, 0, 3.2], look: [0, 0, 0], scale: 1.35, pos: [0, 0, -0.2], color: 0x34ffb4, ring: 0.95 },
        { t: 1.00, cam: [0, 0, 7.5], look: [0, 0, 0], scale: 1.00, pos: [0, 0, 0], color: 0x34ffb4, ring: 0.65 }
      ];
      function lerp(a, b, p) { return a + (b - a) * p; }
      function lerpArr(a, b, p) { return [lerp(a[0], b[0], p), lerp(a[1], b[1], p), lerp(a[2], b[2], p)]; }
      const _c1 = new THREE.Color(), _c2 = new THREE.Color(), _cOut = new THREE.Color();
      
      function sampleKeyframes(t) {
        t = Math.max(0, Math.min(1, t));
        let k0 = KF[0], k1 = KF[KF.length - 1];
        for (let i = 0; i < KF.length - 1; i++) {
          if (t >= KF[i].t && t <= KF[i + 1].t) { k0 = KF[i]; k1 = KF[i + 1]; break; }
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

      const camTarget = new THREE.Vector3(0, 0, 7);
      const lookTarget = new THREE.Vector3(0, 0, 0);
      const currentLook = new THREE.Vector3(0, 0, 0);

      let mouseX = 0, mouseY = 0;
      const handleMouseMove = (e) => {
        mouseX = (e.clientX / window.innerWidth - 0.5);
        mouseY = (e.clientY / window.innerHeight - 0.5);
      };
      window.addEventListener('mousemove', handleMouseMove);

      let scrollFrac = fixedScrollFrac !== null ? fixedScrollFrac : 0;
      function updateScroll() {
        if (fixedScrollFrac !== null) return;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        scrollFrac = max > 0 ? window.scrollY / max : 0;
      }
      if (fixedScrollFrac === null) {
        window.addEventListener('scroll', updateScroll, { passive: true });
        updateScroll();
      }

      let animationFrameId;
      function animate() {
        animationFrameId = requestAnimationFrame(animate);
        const s = sampleKeyframes(scrollFrac);

        if (!reduceMotion) {
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
        rings.forEach(r => { r.material.opacity = lerp(r.material.opacity, r.userData.baseOpacity * s.ring, 0.08); });

        // camera flies to the scroll-driven waypoint, with mouse parallax layered on top
        camTarget.set(s.cam[0] + mouseX * 1.1, s.cam[1] - mouseY * 0.7, s.cam[2]);
        camera.position.lerp(camTarget, 0.06);
        lookTarget.set(s.look[0], s.look[1], s.look[2]);
        currentLook.lerp(lookTarget, 0.06);
        camera.lookAt(currentLook);

        renderer.render(scene, camera);
      }
      animate();

      cleanupThree = () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', resize);
        window.removeEventListener('mousemove', handleMouseMove);
        if (fixedScrollFrac === null) {
          window.removeEventListener('scroll', updateScroll);
        }
        
        scene.traverse((object) => {
          if (!object.isMesh && !object.isPoints) return;
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(cleanMaterial);
            } else {
              cleanMaterial(object.material);
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
    }

    return () => {
      cleanupThree();
    };
  }, [fixedScrollFrac]);

  return (
    <canvas 
      ref={canvasRef} 
      className="pointer-events-none fixed inset-0 z-0 h-screen w-screen"
      style={{ opacity: 1, backgroundColor: 'transparent' }}
    />
  );
}
