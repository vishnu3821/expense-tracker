import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function CameraRig() {
  const { camera, scene } = useThree();

  useEffect(() => {
    // Initial camera position
    camera.position.set(0, 0, 16);
    camera.rotation.set(0, 0, 0);

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1.5, // Smoother scrubbing to prevent laggy jumps
      }
    });

    // Sequence of camera movements mimicking a flight through the financial core
    
    // 1. Orbital Modules (Move closer and to the side)
    tl.to(camera.position, {
      x: 7,
      y: 2,
      z: 10,
      ease: 'power2.inOut'
    }, 0);
    tl.to(camera.rotation, {
      y: Math.PI / 6,
      ease: 'power2.inOut'
    }, 0);

    // 2. Mission Control (Swing to the other side, looking down slightly)
    tl.to(camera.position, {
      x: -6,
      y: 3,
      z: 9,
      ease: 'power2.inOut'
    }, 1);
    tl.to(camera.rotation, {
      x: -Math.PI / 10,
      y: -Math.PI / 8,
      ease: 'power2.inOut'
    }, 1);

    // 3. Signal Path (Dive close, but NOT clipping into the core)
    tl.to(camera.position, {
      x: 0,
      y: 0,
      z: 7, // Kept safe distance to avoid clipping and pixelation
      ease: 'power3.inOut'
    }, 2);
    tl.to(camera.rotation, {
      x: 0,
      y: 0,
      z: 0,
      ease: 'power3.inOut'
    }, 2);

    // 4. Mass Data Intake (Pull back and look up)
    tl.to(camera.position, {
      x: 5,
      y: -2,
      z: 11,
      ease: 'power2.inOut'
    }, 3);
    tl.to(camera.rotation, {
      x: Math.PI / 10,
      y: Math.PI / 8,
      ease: 'power2.inOut'
    }, 3);

    // 5. Protective Shell (Orbit behind the core)
    tl.to(camera.position, {
      x: -7,
      y: 1,
      z: -9,
      ease: 'power2.inOut'
    }, 4);
    tl.to(camera.rotation, {
      x: 0,
      y: -Math.PI + Math.PI / 6,
      ease: 'power2.inOut'
    }, 4);

    // 6. Final CTA (Return to start, perfectly centered)
    tl.to(camera.position, {
      x: 0,
      y: 0,
      z: 16,
      ease: 'power3.inOut'
    }, 5);
    tl.to(camera.rotation, {
      x: 0,
      y: -Math.PI * 2, // Full rotation wrap
      z: 0,
      ease: 'power3.inOut'
    }, 5);

    return () => {
      tl.kill();
    };
  }, [camera]);

  return null;
}
