import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';

export default function FinancialCore({ isMobile }) {
  const coreRef = useRef(null);
  const innerRef = useRef(null);

  useFrame((state, delta) => {
    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 0.1;
      coreRef.current.rotation.x += delta * 0.05;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y -= delta * 0.15;
    }
  });

  return (
    <group>
      {/* Outer Glass Shell */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[2, isMobile ? 8 : 16]} />
        <MeshTransmissionMaterial
          backside
          samples={isMobile ? 2 : 3}
          resolution={isMobile ? 256 : 512}
          thickness={0.5}
          chromaticAberration={0.2}
          anisotropy={0.3}
          distortion={0.1}
          distortionScale={0.3}
          temporalDistortion={0.1}
          clearcoat={1}
          clearcoatRoughness={0.1}
          roughness={0.1}
          envMapIntensity={2}
          color="#a0f0ff"
        />
      </mesh>

      {/* Inner Glowing Core */}
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[1.2, isMobile ? 1 : 4]} />
        <meshStandardMaterial 
          color="#00f0ff" 
          emissive="#00f0ff" 
          emissiveIntensity={2} 
          wireframe={true} 
          transparent 
          opacity={0.8} 
        />
      </mesh>
      
      {/* Secondary Inner Core for visual complexity */}
      <mesh>
        <octahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial 
          color="#00ff88" 
          emissive="#00ff88" 
          emissiveIntensity={1.5} 
        />
      </mesh>
    </group>
  );
}
