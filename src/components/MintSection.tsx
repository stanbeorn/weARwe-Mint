import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { NftSaleClient, PurchaseNftError } from 'ao-process-clients';

// ArConnect type declarations
declare global {
  interface Window {
    arweaveWallet: {
      connect: (permissions: string[]) => Promise<void>;
      disconnect: () => Promise<void>;
      getActiveAddress: () => Promise<string>;
    };
  }
}

const Container = styled.div`
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translate(-50%, 0);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: auto;
  background: rgba(0, 0, 0, 0.85);
  padding: 1.2rem;
  border-radius: 1rem;
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  width: min(90vw, 380px);
`;

const Title = styled.h1`
  font-size: 3rem;
  color: #fff;
  text-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  margin: 0;
  text-align: center;
`;

const PhaseInfo = styled.div`
  color: #fff;
  margin-bottom: 1rem;
  text-align: center;
  width: 100%;
  
  .current-phase {
    font-size: 1.5rem;
    font-weight: bold;
    color: #96bc73;
    margin-bottom: 0.3rem;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .price {
    font-size: 1rem;
    opacity: 0.9;
  }

  .phase-note {
    font-size: 0.9rem;
    color: #96bc73;
    font-style: italic;
  }

  .error-message {
    font-size: 0.9rem;
    color: red;
    margin-top: 10px;
  }
`;

const PhaseTimers = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  margin: 0.5rem 0;
`;

const PhaseTimer = styled.div`
  background: rgba(0, 0, 0, 0.4);
  padding: 0.8rem;
  border-radius: 8px;
  border: 1px solid rgba(150, 188, 115, 0.3);
  transition: transform 0.2s ease;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.8rem;

  &:hover {
    transform: translateY(-2px);
  }

  .phase-info {
    flex: 1;
  }

  .phase-name {
    font-size: 0.9rem;
    color: #96bc73;
    margin-bottom: 0.2rem;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .time {
    font-size: 1.1rem;
    font-weight: bold;
    color: #fff;
    margin-bottom: 0.2rem;
  }

  .status {
    font-size: 0.8rem;
    color: #96bc73;
    font-style: italic;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .completed {
    color: #96bc73;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    
    &::after {
      content: '✓';
      font-size: 1rem;
      font-weight: bold;
    }
  }
`;

const CountdownTimer = styled.div`
  color: #96bc73;
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 1rem;
  text-align: center;

  .label {
    font-size: 1rem;
    color: #fff;
    opacity: 0.8;
    margin-bottom: 0.3rem;
  }
`;

const PhaseProgressBar = styled.div`
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  margin: 0.8rem 0;
  position: relative;
  overflow: hidden;
`;

const ProgressFill = styled.div<{ width: number }>`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #558f6d, #96bc73);
  border-radius: 4px;
  width: ${props => Math.min(Math.max(props.width, 0), 100)}%;
  transition: width 0.3s ease;
`;

const QuantitySelector = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  margin: 0.8rem 0;
  background: rgba(0, 0, 0, 0.4);
  padding: 0.8rem;
  border-radius: 8px;
  border: 1px solid rgba(150, 188, 115, 0.3);
  width: 100%;
  
  .quantity {
    font-size: 1.4rem;
    font-weight: bold;
    color: #fff;
    min-width: 2rem;
    text-align: center;
  }

  .max-info {
    font-size: 0.9rem;
    color: #96bc73;
    font-style: italic;
  }
`;

const QuantityButton = styled.button<{ direction: 'up' | 'down' }>`
  background: rgba(150, 188, 115, 0.2);
  border: 1px solid rgba(150, 188, 115, 0.3);
  border-radius: 6px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #fff;
  font-size: 1.1rem;
  transition: all 0.2s;

  &:hover {
    background: rgba(150, 188, 115, 0.3);
    transform: translateY(-2px);
  }

  &:active {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  &::before {
    content: '${props => props.direction === 'up' ? '↑' : '↓'}';
  }
`;

const MintButton = styled.button`
  width: 100%;
  padding: 1rem 2rem;
  font-size: 1.2rem;
  background: linear-gradient(45deg, #558f6d, #96bc73);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    background: linear-gradient(45deg, #96bc73, #558f6d);
  }

  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
    background: linear-gradient(45deg, #666, #888);
  }
`;

const ButtonsContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0.8rem 0;
  width: 100%;
`;

const CircleProgress = styled.div`
  position: relative;
  width: 80px;
  height: 80px;
  margin: 0.8rem auto;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  color: #fff;
  border: 1px solid rgba(150, 188, 115, 0.3);
`;

const CircleFill = styled.div<{ progress: number }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: conic-gradient(
    #96bc73 ${props => props.progress}%,
    transparent ${props => props.progress}%
  );
  transition: all 0.3s ease;
`;

const CircleInner = styled.div`
  position: relative;
  width: 90%;
  height: 90%;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  text-align: center;
  padding: 0.5rem;
  
  .count {
    font-weight: bold;
    font-size: 1.1rem;
    color: #96bc73;
  }
  
  .total {
    font-size: 0.8rem;
    opacity: 0.8;
  }
`;

const LoadingOverlay = styled.div<{ show: boolean }>`
  display: ${props => props.show ? 'flex' : 'none'};
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(253, 254, 254, 0.9);
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const LoadingSpinner = styled.div`
  border: 5px solid #f3f3f3;
  border-top: 5px solid #558f6d;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

interface MintSectionProps {
  currentPhase: 'OG' | 'FCFS' | 'PUBLIC' | 'NOT_STARTED';
  timeLeft: {
    og: string;
    fcfs: string;
    public: string;
  };
  totalMinted: number;
  setTotalMinted: React.Dispatch<React.SetStateAction<number>>;
}

export function MintSection({ currentPhase, timeLeft, totalMinted, setTotalMinted }: MintSectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [nftSaleClient, setNftSaleClient] = useState<NftSaleClient | null>(null);

  const initializeClient = async () => {
    try {
      console.log('Initializing NFT client...');
      
      // Initialize client with auto configuration
      const client = await NftSaleClient.createAutoConfigured();
      
      console.log('NFT client initialized successfully:', client);
      setNftSaleClient(client);
      return true;
    } catch (error) {
      console.error('Failed to initialize NFT client. Detailed error:', error);
      if (error instanceof Error) {
        setError(`Failed to initialize NFT client: ${error.message}`);
      } else {
        setError('Failed to initialize NFT client: Unknown error');
      }
      return false;
    }
  };

  const connectWallet = async () => {
    try {
      if (window.arweaveWallet) {
        console.log('Connecting to Arweave wallet...');
        await window.arweaveWallet.connect(['ACCESS_ADDRESS', 'SIGN_TRANSACTION']);
        console.log('Successfully connected to Arweave wallet');
        setIsConnected(true);
        
        // Initialize client after wallet connection
        const clientInitialized = await initializeClient();
        return clientInitialized;
      } else {
        const error = 'Arweave wallet not found. Please install Arweave wallet extension.';
        console.error(error);
        setError(error);
        return false;
      }
    } catch (error) {
      console.error('Failed to connect wallet. Detailed error:', error);
      if (error instanceof Error) {
        setError(`Failed to connect wallet: ${error.message}`);
      } else {
        setError('Failed to connect wallet: Unknown error');
      }
      return false;
    }
  };

  const getPhaseInfo = (phase: 'OG' | 'FCFS' | 'PUBLIC' | 'NOT_STARTED') => {
    switch (phase) {
      case 'OG':
        return {
          title: 'OG Phase',
          note: 'Guaranteed mint for OG members',
          price: '0.5 wAR',
          maxMint: 3,
          showPrice: true
        };
      case 'FCFS':
        return {
          title: 'FCFS Phase',
          note: 'First come first served',
          price: '1 wAR',
          maxMint: 3,
          showPrice: true
        };
      case 'PUBLIC':
        return {
          title: 'Public Phase',
          note: 'Open for everyone',
          price: '1 wAR',
          maxMint: 3,
          showPrice: true
        };
      case 'NOT_STARTED':
        return {
          title: 'Not Started',
          note: 'Minting will start soon',
          price: '',
          maxMint: 3,
          showPrice: false
        };
    }
  };

  const getPhaseStatus = () => {
    const currentTime = new Date();
    
    // Time constants for phases
    const ogStartTime = new Date(Date.UTC(2025, 1, 9, 1, 0, 0));    // Feb 9th, 02:00 CET (01:00 UTC)
    const ogEndTime = new Date(Date.UTC(2025, 1, 11, 1, 0, 0));     // Feb 11th, 02:00 CET (01:00 UTC)
    const fcfsStartTime = new Date(Date.UTC(2025, 1, 9, 17, 0, 0)); // Feb 9th, 18:00 CET (17:00 UTC)
    const fcfsEndTime = new Date(Date.UTC(2025, 1, 9, 23, 0, 0));   // Feb 10th, 00:00 CET (23:00 UTC)
    const publicStartTime = new Date(Date.UTC(2025, 1, 9, 22, 59, 0)); // Feb 9th, 23:59 CET (22:59 UTC)
    
    const hasStarted = currentTime >= ogStartTime;
    const ogPhaseActive = currentTime >= ogStartTime && currentTime < ogEndTime;
    const fcfsPhaseActive = currentTime >= fcfsStartTime && currentTime < fcfsEndTime;
    const publicPhaseActive = currentTime >= publicStartTime;
    
    const ogPhaseCompleted = currentTime >= ogEndTime;
    const fcfsPhaseCompleted = currentTime >= fcfsEndTime;
    
    return {
      og: {
        name: 'OG Phase',
        status: !hasStarted ? 'Starts 9th Feb 02:00 CET' : 
               ogPhaseCompleted ? 'Completed' :
               'Active - Guaranteed Mint (48 Hours)',
        time: !hasStarted ? timeLeft.og :
              ogPhaseCompleted ? '' : timeLeft.og,
        label: !hasStarted ? 'Time Until Start' :
               ogPhaseCompleted ? '' : 'Time Remaining',
        completed: ogPhaseCompleted
      },
      fcfs: {
        name: 'FCFS Phase',
        status: !hasStarted ? 'Starts 9th Feb 02:00 CET' : 
               fcfsPhaseCompleted ? 'Completed' :
               'Active - First Come First Served (6 Hours)',
        time: !hasStarted ? timeLeft.fcfs :
              fcfsPhaseCompleted ? '' : timeLeft.fcfs,
        label: !hasStarted ? 'Time Until Start' :
               fcfsPhaseCompleted ? '' : 'Time Remaining',
        completed: fcfsPhaseCompleted
      },
      public: {
        name: 'Public Phase',
        status: publicPhaseActive ? 'Active - Open for Everyone (1 Week)' : 'Starts 9th Feb 23:59 CET',
        time: !publicPhaseActive && timeLeft.public ? timeLeft.public : '',
        label: !publicPhaseActive && timeLeft.public ? 'Time Until Start' : '',
        completed: false
      }
    };
  };

  const isMintingEnabled = () => {
    const currentTime = new Date();
    const startTime = new Date(Date.UTC(2025, 1, 9, 1, 0, 0)); // Feb 9th, 02:00 CET (01:00 UTC)
    return currentTime >= startTime;
  };

  const handleQuantityChange = (increment: boolean) => {
    const maxMint = getPhaseInfo(currentPhase).maxMint;
    setQuantity(prev => {
      const newValue = increment ? prev + 1 : prev - 1;
      return Math.min(Math.max(1, newValue), maxMint);
    });
  };

  // Calculate progress for the current phase
  const getPhaseProgress = () => {
    if (currentPhase === 'OG' || currentPhase === 'FCFS' || currentPhase === 'PUBLIC') {
      const phaseKey = currentPhase.toLowerCase() as 'og' | 'fcfs' | 'public';
      const timeLeftParts = timeLeft[phaseKey].split(' ');
      const [hours, minutes, seconds] = timeLeftParts[0].split('h')[0].split(':');
      const totalSeconds = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
      // Phase duration is 2 hours (7200 seconds)
      const totalPhaseSeconds = 2 * 3600;
      return `${((totalPhaseSeconds - totalSeconds) / totalPhaseSeconds) * 100}%`;
    }
    return '0%';
  };

  const handleMint = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isConnected || !nftSaleClient) {
        const connected = await connectWallet();
        if (!connected) {
          return;
        }
      }

      if (!nftSaleClient) {
        setError('NFT client not initialized');
        return;
      }

      // Purchase NFTs based on quantity
      for (let i = 0; i < quantity; i++) {
        try {
          const success = await nftSaleClient.purchaseNft();
          if (!success) {
            throw new Error('Purchase failed');
          }
        } catch (error) {
          if (error instanceof PurchaseNftError) {
            throw new Error(`Purchase failed: ${error.message}`);
          }
          throw error;
        }
      }

      setTotalMinted(prevTotal => prevTotal + quantity);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Minting failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to mint NFT');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Container>
        <PhaseInfo>
          <div className="current-phase">{getPhaseInfo(currentPhase).title}</div>
          {getPhaseInfo(currentPhase).showPrice && (
            <div className="price">Price: {getPhaseInfo(currentPhase).price}</div>
          )}
          {getPhaseInfo(currentPhase).note && (
            <div className="phase-note">{getPhaseInfo(currentPhase).note}</div>
          )}
          {error && (
            <div className="error-message" style={{ color: 'red', marginTop: '10px' }}>
              {error}
            </div>
          )}
        </PhaseInfo>
        
        <PhaseTimers>
          <PhaseTimer>
            <div className="phase-info">
              <div className="phase-name">{getPhaseStatus().og.name}</div>
              {getPhaseStatus().og.time && (
                <div className="time">
                  {getPhaseStatus().og.label}: {getPhaseStatus().og.time}
                </div>
              )}
              <div className={getPhaseStatus().og.completed ? 'status completed' : 'status'}>
                {getPhaseStatus().og.status}
              </div>
            </div>
          </PhaseTimer>

          <PhaseTimer>
            <div className="phase-info">
              <div className="phase-name">{getPhaseStatus().fcfs.name}</div>
              {getPhaseStatus().fcfs.time && (
                <div className="time">
                  {getPhaseStatus().fcfs.label}: {getPhaseStatus().fcfs.time}
                </div>
              )}
              <div className={getPhaseStatus().fcfs.completed ? 'status completed' : 'status'}>
                {getPhaseStatus().fcfs.status}
              </div>
            </div>
          </PhaseTimer>

          <PhaseTimer>
            <div className="phase-info">
              <div className="phase-name">{getPhaseStatus().public.name}</div>
              {getPhaseStatus().public.time && (
                <div className="time">
                  {getPhaseStatus().public.label}: {getPhaseStatus().public.time}
                </div>
              )}
              <div className="status">
                {getPhaseStatus().public.status}
              </div>
            </div>
          </PhaseTimer>
        </PhaseTimers>
        
        {(currentPhase === 'OG' || currentPhase === 'FCFS' || currentPhase === 'PUBLIC') && (
          <>
            <QuantitySelector>
              <QuantityButton 
                direction="down" 
                onClick={() => handleQuantityChange(false)}
                disabled={quantity <= 1 || isLoading || !isMintingEnabled()}
              />
              <div className="quantity">{quantity}</div>
              <QuantityButton 
                direction="up" 
                onClick={() => handleQuantityChange(true)}
                disabled={quantity >= getPhaseInfo(currentPhase).maxMint || isLoading || !isMintingEnabled()}
              />
              <div className="max-info">Max {getPhaseInfo(currentPhase).maxMint}</div>
            </QuantitySelector>

            <PhaseProgressBar>
              <ProgressFill width={parseFloat(getPhaseProgress())} />
            </PhaseProgressBar>
          </>
        )}

        <ButtonsContainer>
          <MintButton onClick={handleMint} disabled={isLoading || !isMintingEnabled()}>
            {isLoading ? 'Processing...' : (isConnected ? `Mint ${quantity} Now` : 'Connect & Mint')}
          </MintButton>
        </ButtonsContainer>
        
        <CircleProgress>
          <CircleFill progress={(totalMinted / 3333) * 100} />
          <CircleInner>
            <div className="count">{totalMinted}</div>
            <div className="total">/ 3333</div>
          </CircleInner>
        </CircleProgress>
      </Container>

      <LoadingOverlay show={isLoading || showSuccess}>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          showSuccess && <h2 style={{ color: '#558f6d' }}>Successfully Minted!</h2>
        )}
      </LoadingOverlay>
    </>
  );
}
