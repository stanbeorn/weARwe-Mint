import React, { useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { Group } from 'three';

interface NFTBoxProps {
  position: [number, number, number];
  imageUrl: string;
  direction?: number;
}

export function NFTBox({ position, imageUrl, direction = 1 }: NFTBoxProps) {
  const groupRef = useRef<Group>(null);
  const innerGroupRef = useRef<Group>(null);
  
  // Load the NFT texture with proper color management
  const texture = useLoader(THREE.TextureLoader, imageUrl || '/nft_1.png') as THREE.Texture;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.encoding = THREE.sRGBEncoding;
  texture.flipY = true;
  
  // Make sure texture maintains aspect ratio
  const aspectRatio = texture.image ? texture.image.width / texture.image.height : 1;
  
  // Brand colors
  const mainColor = new THREE.Color('#558f6d').convertSRGBToLinear();
  const lightColor = new THREE.Color('#b0dae7').convertSRGBToLinear();
  
  // Frame material (solid, not transparent)
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: mainColor,
    metalness: 0.1,
    roughness: 0.3,
    envMapIntensity: 1,
    side: THREE.FrontSide
  });

  // Corner material
  const cornerMaterial = new THREE.MeshStandardMaterial({
    color: lightColor,
    metalness: 0.2,
    roughness: 0.4,
    envMapIntensity: 0.8,
    side: THREE.FrontSide
  });

  // NFT display material with proper color management
  const nftMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    toneMapped: false,
    side: THREE.FrontSide
  });

  // Box dimensions adjusted for NFT proportions
  const width = 1.8;
  const height = width / aspectRatio;
  const depth = 0.15;
  const borderWidth = 0.04;
  const cornerSize = 0.08;

  // Calculate NFT dimensions to fit inside the frame
  const nftWidth = width - borderWidth * 2;
  const nftHeight = height - borderWidth * 2;

  // Add gentle continuous rotation
  useFrame((state) => {
    if (innerGroupRef.current) {
      // Add small oscillating rotation
      const time = state.clock.getElapsedTime();
      const tiltAmount = 0.05; // Maximum tilt angle in radians (about 3 degrees)
      const tiltSpeed = 0.5; // Speed of tilt oscillation
      
      // Calculate tilt based on position and time
      const tilt = Math.sin(time * tiltSpeed) * tiltAmount;
      
      // Apply rotations
      innerGroupRef.current.rotation.z = tilt;
    }
  });

  // Determine if this is a right-side NFT
  const isRightSide = direction > 0;

  return (
    <group ref={groupRef} position={position}>
      {/* Frame structure */}
      <group ref={innerGroupRef} rotation={[0, isRightSide ? Math.PI : 0, 0]} position={[0, 0, -depth/2]}>
        {/* Back panel */}
        <mesh material={frameMaterial}>
          <boxGeometry args={[width, height, 0.02]} />
        </mesh>

        {/* Frame pieces */}
        <mesh position={[-width/2 + borderWidth/2, 0, depth/2]} material={frameMaterial}>
          <boxGeometry args={[borderWidth, height, depth]} />
        </mesh>
        <mesh position={[width/2 - borderWidth/2, 0, depth/2]} material={frameMaterial}>
          <boxGeometry args={[borderWidth, height, depth]} />
        </mesh>
        <mesh position={[0, height/2 - borderWidth/2, depth/2]} material={frameMaterial}>
          <boxGeometry args={[width, borderWidth, depth]} />
        </mesh>
        <mesh position={[0, -height/2 + borderWidth/2, depth/2]} material={frameMaterial}>
          <boxGeometry args={[width, borderWidth, depth]} />
        </mesh>

        {/* Corner decorations */}
        {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, y], index) => (
          <group key={index} position={[x * (width/2 - cornerSize/2), y * (height/2 - cornerSize/2), depth/2]}>
            <mesh material={cornerMaterial}>
              <boxGeometry args={[cornerSize, cornerSize, depth + 0.01]} />
            </mesh>
          </group>
        ))}

        {/* NFT display (centered) */}
        <mesh position={[0, 0, depth/2 + 0.01]} renderOrder={1}>
          <planeGeometry args={[nftWidth, nftHeight]} />
          <primitive object={nftMaterial} />
        </mesh>
      </group>
    </group>
  );
}
