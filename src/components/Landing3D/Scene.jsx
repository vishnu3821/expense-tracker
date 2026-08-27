import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Stars, Float } from '@react-three/drei';
import FinancialCore from './FinancialCore';
import OrbitalRings from './OrbitalRings';
import CameraRig from './CameraRig';

export default function Scene() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]} // Support high DPI screens but cap at 1.5 for performance
      gl={{ antialias: false, alpha: false }}
      camera={{ position: [0, 0, 15], fov: 35, near: 0.1, far: 1000 }}
    >
      <color attach="background" args={['#040a13']} /> {/* Deep charcoal-navy space */}
      
      {/* Lighting setup */}
      <ambientLight intensity={0.2} />
      <directionalLight position={[10, 10, 5]} intensity={2} color="#00f0ff" />
      <directionalLight position={[-10, -10, -5]} intensity={1.5} color="#00ff88" />
      <pointLight position={[0, 0, 0]} intensity={1} color="#ffffff" distance={10} />
      
      {/* Background Starfield / Particle Dust - Reduced on mobile */}
      <Stars 
        radius={100} 
        depth={50} 
        count={isMobile ? 1500 : 5000} 
        factor={isMobile ? 2 : 4} 
        saturation={0} 
        fade 
        speed={1} 
      />
      
      {/* IBL (Image Based Lighting) for realistic glass reflections */}
      <Environment preset="city" />

      <Suspense fallback={null}>
        <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
          {/* Central Object */}
          <FinancialCore isMobile={isMobile} />
          
          {/* Surrounding Debris/Satellites */}
          <OrbitalRings isMobile={isMobile} />
        </Float>
      </Suspense>

      {/* Camera Controller linked to Scroll */}
      <CameraRig />
    </Canvas>
  );
}
