import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Html } from '@react-three/drei';
import * as THREE from 'three';

const generateRingObjects = (count, radius, size, isText) => {
  const objects = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    // Add some random variation to radius and height
    const r = radius + (Math.random() - 0.5) * 1.5;
    const y = (Math.random() - 0.5) * 2;
    
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    
    objects.push({
      position: [x, y, z],
      rotation: [Math.random() * Math.PI, Math.random() * Math.PI, 0],
      scale: size * (0.5 + Math.random() * 0.5),
      symbol: ['₹', '$', '€', '¥'][Math.floor(Math.random() * 4)],
      isNegative: Math.random() > 0.5
    });
  }
  return objects;
};

export default function OrbitalRings({ isMobile }) {
  const innerRingRef = useRef(null);
  const midRingRef = useRef(null);
  const outerRingRef = useRef(null);

  // Memoize the geometry data so it doesn't recalculate on render
  const innerData = useMemo(() => generateRingObjects(isMobile ? 15 : 30, 4, 0.1, false), [isMobile]);
  const midData = useMemo(() => generateRingObjects(isMobile ? 15 : 40, 7, 0.15, true), [isMobile]);
  const outerData = useMemo(() => generateRingObjects(isMobile ? 20 : 60, 11, 0.05, false), [isMobile]);

  useFrame((state, delta) => {
    if (innerRingRef.current) innerRingRef.current.rotation.y += delta * 0.2;
    if (midRingRef.current) {
      midRingRef.current.rotation.y -= delta * 0.1;
      midRingRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.2) * 0.1;
    }
    if (outerRingRef.current) {
      outerRingRef.current.rotation.y += delta * 0.05;
      outerRingRef.current.rotation.x = Math.cos(state.clock.elapsedTime * 0.1) * 0.1;
    }
  });

  return (
    <group>
      {/* Inner Ring - Data Nodes */}
      <group ref={innerRingRef}>
        {innerData.map((obj, i) => (
          <mesh key={`inner-${i}`} position={obj.position} scale={obj.scale}>
            <sphereGeometry args={[1, isMobile ? 8 : 16, isMobile ? 8 : 16]} />
            <meshStandardMaterial 
              color="#00ff88" 
              emissive="#00ff88" 
              emissiveIntensity={1} 
              transparent 
              opacity={0.6} 
            />
          </mesh>
        ))}
      </group>

      {/* Mid Ring - Satellites and Data Panels */}
      <group ref={midRingRef}>
        {midData.map((obj, i) => i % 2 === 0 ? (
          <mesh key={`mid-poly-${i}`} position={obj.position} rotation={obj.rotation} scale={obj.scale * 1.5}>
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial 
               color={obj.isNegative ? "#ff2a5f" : "#00f0ff"} 
               metalness={0.8} 
               roughness={0.2}
               wireframe={i % 4 === 0}
               transparent
               opacity={0.9}
             />
          </mesh>
        ) : (
          <mesh key={`mid-panel-${i}`} position={obj.position} rotation={obj.rotation} scale={obj.scale}>
             <boxGeometry args={[2.5, 1.2, 0.05]} />
             <meshStandardMaterial 
               color="#060c17" 
               metalness={0.9} 
               roughness={0.1}
               transparent
               opacity={0.85}
             />
             <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(2.5, 1.2, 0.05)]} />
                <lineBasicMaterial color={obj.isNegative ? "#ff2a5f" : "#00f0ff"} linewidth={1} transparent opacity={0.5} />
             </lineSegments>
          </mesh>
        ))}
      </group>

      {/* Outer Ring - Fine Dust/Particles */}
      <group ref={outerRingRef}>
        {outerData.map((obj, i) => (
          <mesh key={`outer-${i}`} position={obj.position} scale={obj.scale}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.3} />
          </mesh>
        ))}
        {/* Draw visible orbit lines */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[10.9, 11, 64]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.05} side={THREE.DoubleSide} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[6.9, 7, 64]} />
          <meshBasicMaterial color="#00f0ff" transparent opacity={0.1} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}
