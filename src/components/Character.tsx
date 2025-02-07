import React from 'react';
import styled from 'styled-components';

const CharacterImage = styled.img`
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: auto;
  height: 300px;
  z-index: 1;
`;

export function Character() {
  return (
    <CharacterImage 
      src="/animation.apng" 
      alt="Character Animation"
    />
  );
}
