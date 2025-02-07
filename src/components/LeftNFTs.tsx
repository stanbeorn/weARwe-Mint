import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';
import { NFTBox } from './NFTBox';

export function LeftNFTs() {
  const groupRef = useRef<Group>(null);
  const nftUrls = Array.from({ length: 50 }, (_, i) => `/nft_${i + 1}.png`);
  
  // Carousel settings
  const spacing = 3; // Vertical spacing between NFTs
  const totalHeight = spacing * nftUrls.length;
  const speed = 0.02; // Speed of movement

  useFrame((state) => {
    if (groupRef.current) {
      // Move all NFTs down
      groupRef.current.children.forEach((child) => {
        child.position.y -= speed;
        
        // If NFT goes below the bottom, move it to the top
        if (child.position.y < -totalHeight/2) {
          child.position.y = totalHeight/2;
        }
      });
    }
  });

  return (
    <group position={[-6.5, 0, 0]}>
      <group ref={groupRef}>
        {nftUrls.map((url, index) => {
          // Calculate initial vertical position
          const y = totalHeight/2 - index * spacing;
          
          return (
            <group key={index} position={[0, y, 0]}>
              <NFTBox
                position={[0, 0, 0]}
                imageUrl={url}
                direction={-1}
              />
            </group>
          );
        })}
      </group>
    </group>
  );
}
