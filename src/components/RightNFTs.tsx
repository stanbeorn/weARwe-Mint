import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { NFTBox } from './NFTBox';

export function RightNFTs() {
  const groupRef = useRef<Group>(null);
  const nftUrls = Array.from({ length: 50 }, (_, i) => `/nft_${i + 51}.png`);
  
  // Carousel settings
  const spacing = 3; // Vertical spacing between NFTs
  const totalHeight = spacing * nftUrls.length;
  const speed = -0.02; // Negative speed for upward movement

  useFrame((state) => {
    if (groupRef.current) {
      // Move all NFTs up
      groupRef.current.children.forEach((child) => {
        child.position.y -= speed;
        
        // If NFT goes above the top, move it to the bottom
        if (child.position.y > totalHeight/2) {
          child.position.y = -totalHeight/2;
        }
      });
    }
  });

  return (
    // No rotation on the outer group, but mirror horizontally
    <group position={[6.5, 0, 0]} scale={[-1, 1, 1]}>
      <group ref={groupRef}>
        {nftUrls.map((url, index) => {
          // Calculate initial vertical position
          const y = -totalHeight/2 + index * spacing;
          
          return (
            // Rotate each individual box 180 degrees around Y axis
            <group key={index} position={[0, y, 0]} rotation={[0, Math.PI, 0]}>
              <NFTBox
                position={[0, 0, 0]}
                imageUrl={url}
                direction={1}
              />
            </group>
          );
        })}
      </group>
    </group>
  );
}
