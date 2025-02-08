import React, { useState, useEffect } from 'react';
import { getNftSaleClientAutoConfiguration, INftSaleClient, NftSaleClient, NftSaleClientConfig, PurchaseNftError } from 'ao-process-clients';

import './MintSection.css';

// NFT Sale Client Configuration
const NFT_SALE_CONFIG: NftSaleClientConfig = {
  ...getNftSaleClientAutoConfiguration(),
  processId: "ewO-sg8QM8xK_yM_ERzvbOZ4DCbTGoBK51uZnc3MENw", // Sale contract
  purchaseAmount: "500000000000",
  tokenProcessId: "5ZR9uegKoEhE9fJMbs-MvWLIztMNCVxgpzfeBVE3vqI" // wAR token
};

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

interface MintSectionProps {
  currentPhase: 'OG' | 'FCFS' | 'PUBLIC' | 'NOT_STARTED';
  timeLeft: {
    og: string;
    fcfs: string;
    public: string;
  };
}

export function MintSection({ currentPhase, timeLeft }: MintSectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [nftSaleClient, setNftSaleClient] = useState<INftSaleClient | null>(null);
  const [totalMinted, setTotalMinted] = useState(0);

  // Initialize client on component mount
  useEffect(() => {
    const init = async () => {
      try {
        console.log('Initializing NFT client...');
        const client = await NftSaleClient.create(NFT_SALE_CONFIG);
        console.log('NFT client initialized successfully:', client);
        setNftSaleClient(client);

        // Get client info
        const info = await client.getInfo();
        console.log('NFT Sale Client Info:', info);
        
        // Update total minted
        const nftsLeft = await client.queryNFTCount();
        const TOTAL_NFTS_AVAILABLE = 3333;
        const nftsSold = Math.abs(nftsLeft - TOTAL_NFTS_AVAILABLE);
        setTotalMinted(nftsSold);
      } catch (error) {
        console.error('Failed to initialize client:', error);
        if (error instanceof Error) {
          setError(`Failed to initialize NFT client: ${error.message}`);
        } else {
          setError('Failed to initialize NFT client: Unknown error');
        }
      }
    };

    init();
  }, []); // Run once on mount

  const connectWallet = async () => {
    try {
      if (window.arweaveWallet) {
        console.log('Connecting to Arweave wallet...');
        await window.arweaveWallet.connect(['ACCESS_ADDRESS', 'SIGN_TRANSACTION']);
        console.log('Successfully connected to Arweave wallet');
        setIsConnected(true);

        return true;
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
          maxMint: 10,
          showPrice: true
        };
      case 'PUBLIC':
        return {
          title: 'Public Phase',
          note: 'Open for everyone',
          price: '1 wAR',
          maxMint: 3333,
          showPrice: true
        };
      case 'NOT_STARTED':
        return {
          title: 'Not Started',
          note: 'Minting will start soon',
          price: '',
          maxMint: 0,
          showPrice: false
        };
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      hour12: false
    }).replace(',', '') + ' UTC';
  };

  // Phase timing configuration
  const OG_PHASE_DURATION = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
  const FCFS_PHASE_DURATION = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

  // Base start time for all phases
  const ogStartTime = new Date(Date.UTC(2025, 1, 9, 17, 0, 0));  // Feb 9th, 17:00 UTC
  const fcfsStartTime = new Date(ogStartTime.getTime() + OG_PHASE_DURATION);
  const publicStartTime = new Date(fcfsStartTime.getTime() + FCFS_PHASE_DURATION);

  const getPhaseStatus = () => {
    const currentTime = new Date();

    const hasStarted = currentTime >= ogStartTime;
    const publicPhaseActive = currentTime >= publicStartTime;

    const ogPhaseCompleted = currentTime >= fcfsStartTime;
    const fcfsPhaseCompleted = currentTime >= publicStartTime;

    return {
      og: {
        name: 'OG Phase',
        status: !hasStarted ? `Starts ${formatDate(ogStartTime)}` :
          ogPhaseCompleted ? 'Completed' :
            'Active - Guaranteed Mint (6 Hours)',
        time: !hasStarted ? timeLeft.og :
          ogPhaseCompleted ? '' : timeLeft.og,
        label: !hasStarted ? 'Time Until Start' :
          ogPhaseCompleted ? '' : 'Time Remaining',
        completed: ogPhaseCompleted
      },
      fcfs: {
        name: 'FCFS Phase',
        status: !hasStarted ? `Starts ${formatDate(fcfsStartTime)}` :
          fcfsPhaseCompleted ? 'Completed' :
            'Active - First Come First Served (12 Hours)',
        time: !hasStarted ? timeLeft.fcfs :
          fcfsPhaseCompleted ? '' : timeLeft.fcfs,
        label: !hasStarted ? 'Time Until Start' :
          fcfsPhaseCompleted ? '' : 'Time Remaining',
        completed: fcfsPhaseCompleted
      },
      public: {
        name: 'Public Phase',
        status: publicPhaseActive ? 'Active - Open for Everyone' : `Starts ${formatDate(publicStartTime)}`,
        time: !publicPhaseActive && timeLeft.public ? timeLeft.public : '',
        label: !publicPhaseActive && timeLeft.public ? 'Time Until Start' : '',
        completed: false
      }
    };
  };

  const isMintingEnabled = () => {
    // const currentTime = new Date();
    // const startTime = new Date(Date.UTC(2025, 1, 7, 17, 0, 0)); // Feb 7th, 17:00 UTC
    // return currentTime >= startTime;
    return true
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
      // Get phase duration based on current phase
      const totalPhaseSeconds = currentPhase === 'OG' ? 6 * 3600 : // 6 hours for OG
                               currentPhase === 'FCFS' ? 12 * 3600 : // 12 hours for FCFS
                               24 * 3600; // 24 hours for PUBLIC
      return `${((totalPhaseSeconds - totalSeconds) / totalPhaseSeconds) * 100}%`;
    }
    return '0%';
  };

  const handleMint = async (isLuckyDraw: boolean = false): Promise<void> => {
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

      if (isLuckyDraw) {
        // 20% chance of success for lucky draw
        const randomChance = Math.random();
        if (randomChance > 0.2) {
          setError('Better luck next time! (80% chance of failure)');
          return;
        }
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
      <div className="mint-container">
        <div className="phase-info">
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
        </div>

        <div className="phase-timers">
          <div className="phase-timer">
            <div className="phase-info">
              <div className="phase-name">
                {getPhaseStatus().og.name}
                <div style={{ fontSize: '0.8rem', color: '#fff', opacity: 0.8 }}>
                  0.5 wAR • Max 3 per wallet
                </div>
              </div>
              {getPhaseStatus().og.time && (
                <div className="time">
                  {getPhaseStatus().og.label}: {getPhaseStatus().og.time}
                </div>
              )}
              <div className={getPhaseStatus().og.completed ? 'status completed' : 'status'}>
                {getPhaseStatus().og.status}
              </div>
            </div>
          </div>

          <div className="phase-timer">
            <div className="phase-info">
              <div className="phase-name">
                {getPhaseStatus().fcfs.name}
                <div style={{ fontSize: '0.8rem', color: '#fff', opacity: 0.8 }}>
                  1 wAR • Max 10 per wallet
                </div>
              </div>
              {getPhaseStatus().fcfs.time && (
                <div className="time">
                  {getPhaseStatus().fcfs.label}: {getPhaseStatus().fcfs.time}
                </div>
              )}
              <div className={getPhaseStatus().fcfs.completed ? 'status completed' : 'status'}>
                {getPhaseStatus().fcfs.status}
              </div>
            </div>
          </div>

          <div className="phase-timer">
            <div className="phase-info">
              <div className="phase-name">
                {getPhaseStatus().public.name}
                <div style={{ fontSize: '0.8rem', color: '#fff', opacity: 0.8 }}>
                  1 wAR • No max limit
                </div>
              </div>
              {getPhaseStatus().public.time && (
                <div className="time">
                  {getPhaseStatus().public.label}: {getPhaseStatus().public.time}
                </div>
              )}
              <div className="status">
                {getPhaseStatus().public.status}
              </div>
            </div>
          </div>
        </div>

        {(currentPhase === 'OG' || currentPhase === 'FCFS' || currentPhase === 'PUBLIC') && (
          <>
            <div className="quantity-selector">
              <button
                className="quantity-button down"
                onClick={() => handleQuantityChange(false)}
                disabled={quantity <= 1 || isLoading || !isMintingEnabled()}
              />
              <div className="quantity">{quantity}</div>
              <button
                className="quantity-button up"
                onClick={() => handleQuantityChange(true)}
                disabled={quantity >= getPhaseInfo(currentPhase).maxMint || isLoading || !isMintingEnabled()}
              />
              <div className="max-info">Max {getPhaseInfo(currentPhase).maxMint}</div>
            </div>

            <div className="phase-progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: getPhaseProgress() }}
              />
            </div>
          </>
        )}

        <div className="buttons-container">
          <div className="mint-section">
            <div className="full-price-text">
              Pay Full Price - Guaranteed Mint
            </div>
            <button 
              className="mint-button" 
              onClick={() => handleMint(false)} 
              disabled={isLoading || !isMintingEnabled()}
            >
              {isLoading ? 'Processing...' : (isConnected ? `Mint ${quantity} Now` : 'Connect & Mint')}
            </button>
            <div className="total-price">
              Total: {(quantity * (currentPhase === 'OG' ? 0.5 : 1)).toFixed(2)} wAR
            </div>
          </div>
          
          <div className="lucky-section">
            <div className="lucky-message">
              Try your luck! 80% discount with 20% success rate 🍀
            </div>
            <button 
              className="lucky-draw-button" 
              onClick={() => handleMint(true)} 
              disabled={isLoading || !isMintingEnabled()}
            >
              {`${quantity}x Lucky Draw`}
            </button>
            <div className="total-price">
              Total: {(quantity * 0.2).toFixed(2)} wAR
            </div>
            <div className="randao-branding">
              <span>Powered by</span>
              <img src="/randao.png" alt="RANDAO" />
              <a 
                href="https://randao.ar.io" 
                target="_blank" 
                rel="noopener noreferrer"
                className="learn-more-link"
              >
                Learn More
                <img src="/rng-logo.svg" alt="RNG" />
              </a>
            </div>
          </div>
        </div>

        <div className="circle-progress">
          <div 
            className="circle-fill" 
            style={{ 
              background: `conic-gradient(#96bc73 ${(totalMinted / 3333) * 100}%, transparent ${(totalMinted / 3333) * 100}%)` 
            }} 
          />
          <div className="circle-inner">
            <div className="count">{totalMinted}</div>
            <div className="total">/ 3333</div>
          </div>
        </div>
      </div>

      <div className="loading-overlay" style={{ display: (isLoading || showSuccess) ? 'flex' : 'none' }}>
        {isLoading ? (
          <div className="loading-spinner" />
        ) : (
          showSuccess && <h2 style={{ color: '#558f6d' }}>Successfully Minted!</h2>
        )}
      </div>
    </>
  );
}
