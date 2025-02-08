import React, { useState, useEffect } from 'react';
import { getNftSaleClientAutoConfiguration, INftSaleClient, NftSaleClient, NftSaleClientConfig, PurchaseNftError } from 'ao-process-clients';
import './MintSection.css';

// Types for client info response
interface WhitelistZone {
  amount: string;
  discount: string;
  addresses: Record<string, boolean>;
}

interface PurchaseLimit {
  limit: number;
  purchased: Record<string, number>;
}

interface ClientInfo {
  MasterWhitelist: [string, string, Record<string, boolean>][];
  Current_Zone: number;
  WhitelistZones: number[];
  PurchaseLimits: [number, Record<string, number>][];
}

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
  
  // Client info state
  const [masterWhitelist, setMasterWhitelist] = useState<WhitelistZone[]>([]);
  const [currentZone, setCurrentZone] = useState<number>(0);
  const [whitelistZones, setWhitelistZones] = useState<number[]>([]);
  const [purchaseLimits, setPurchaseLimits] = useState<PurchaseLimit[]>([]);

  // Initialize NFT client
  useEffect(() => {
    const init = async () => {
      try {
        // Wait for window.arweaveWallet to be available
        if (!window.arweaveWallet) {
          console.log('Waiting for Arweave wallet...');
          return;
        }

        // Create NFT Sale Client Configuration
        const config: NftSaleClientConfig = {
          ...getNftSaleClientAutoConfiguration(),
          processId: "ewO-sg8QM8xK_yM_ERzvbOZ4DCbTGoBK51uZnc3MENw", // Sale contract
          purchaseAmount: "500000000000",
          tokenProcessId: "5ZR9uegKoEhE9fJMbs-MvWLIztMNCVxgpzfeBVE3vqI" // wAR token
        };

        console.log('Initializing NFT client...');
        const client = await NftSaleClient.create(config);
        console.log('NFT client initialized successfully:', client);
        setNftSaleClient(client);

        // Get client info and parse JSON
        const infoResponse = await client.getInfo();
        console.log('NFT Sale Client Info:', infoResponse);
        
        // Parse the JSON string from the array
        const info = JSON.parse(infoResponse[0]) as ClientInfo;
        
        // Parse whitelist data into more usable format
        const parsedWhitelist = info.MasterWhitelist.map(([amount, discount, addresses]) => ({
          amount,
          discount,
          addresses
        }));
        
        // Parse purchase limits into more usable format
        const parsedPurchaseLimits = info.PurchaseLimits.map(([limit, purchased]) => ({
          limit,
          purchased: purchased || {} // Default to empty object if no purchases
        }));

        // Update state with client info
        setMasterWhitelist(parsedWhitelist);
        setCurrentZone(info.Current_Zone);
        setWhitelistZones(info.WhitelistZones);
        setPurchaseLimits(parsedPurchaseLimits);
        
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

  // Check for wallet availability
  useEffect(() => {
    const checkWallet = () => {
      if (window.arweaveWallet) {
        console.log('Arweave wallet found');
        setIsConnected(true);
        clearInterval(intervalId);
      } else {
        console.log('Waiting for Arweave wallet...');
      }
    };

    const intervalId = setInterval(checkWallet, 1000);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
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
    // Use contract data for current zone and limits
    const zoneIndex = currentZone - 1; // Convert to 0-based index
    if (zoneIndex >= 0 && zoneIndex < purchaseLimits.length) {
      const currentLimit = purchaseLimits[zoneIndex];
      const zoneTitle = `Zone ${currentZone}`;
      
      // Get whitelist amount for price calculation
      const whitelistInfo = masterWhitelist[zoneIndex];
      const price = whitelistInfo ? 
        `${parseInt(whitelistInfo.amount) / 1000000000} wAR` : // Convert from winston to AR
        'N/A';

      return {
        title: zoneTitle,
        note: `Purchase limit: ${currentLimit.limit} per wallet`,
        price,
        maxMint: currentLimit.limit,
        showPrice: true
      };
    }

    // Fallback if zone data isn't available
    return {
      title: 'Not Started',
      note: 'Waiting for contract data...',
      price: '',
      maxMint: 0,
      showPrice: false
    };
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

  const getZoneInfo = (zoneIndex: number) => {
    if (zoneIndex >= 0 && zoneIndex < masterWhitelist.length) {
      const whitelistInfo = masterWhitelist[zoneIndex];
      const purchaseLimit = purchaseLimits[zoneIndex];
      const price = parseInt(whitelistInfo.amount) / 1000000000;
      return {
        price: `${price} wAR`,
        limit: purchaseLimit.limit,
        purchased: purchaseLimit.purchased
      };
    }
    return null;
  };

  const getPhaseStatus = () => {
    // Use contract data instead of time-based phases
    const zones = [
      { index: 0, name: 'Zone 1' },
      { index: 1, name: 'Zone 2' },
      { index: 2, name: 'Zone 3' }
    ];

    return zones.map(zone => {
      const info = getZoneInfo(zone.index);
      const isActive = currentZone === zone.index + 1;
      const isCompleted = currentZone > zone.index + 1;

      return {
        name: zone.name,
        status: isActive ? 'Active' : isCompleted ? 'Completed' : 'Waiting',
        info: info ? `${info.price} • Max ${info.limit} per wallet` : 'Loading...',
        completed: isCompleted
      };
    });
  };

  const isMintingEnabled = () => {
    return true;
  };

  const handleQuantityChange = (increment: boolean) => {
    const maxMint = getPhaseInfo(currentPhase).maxMint;
    setQuantity(prev => {
      const newValue = increment ? prev + 1 : prev - 1;
      return Math.min(Math.max(1, newValue), maxMint);
    });
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
          {getPhaseStatus().map((phase, index) => (
            <div key={index} className="phase-timer">
              <div className="phase-info">
                <div className="phase-name">
                  {phase.name}
                  <div style={{ fontSize: '0.8rem', color: '#fff', opacity: 0.8 }}>
                    {phase.info}
                  </div>
                </div>
                <div className={phase.completed ? 'status completed' : 'status'}>
                  {phase.status}
                </div>
              </div>
            </div>
          ))}
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
              Total: {(() => {
                const zoneIndex = currentZone - 1;
                if (zoneIndex >= 0 && zoneIndex < masterWhitelist.length) {
                  const price = parseInt(masterWhitelist[zoneIndex].amount) / 1000000000;
                  return (quantity * price).toFixed(2);
                }
                return '0.00';
              })()} wAR
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
              Total: {(() => {
                const zoneIndex = currentZone - 1;
                if (zoneIndex >= 0 && zoneIndex < masterWhitelist.length) {
                  const price = parseInt(masterWhitelist[zoneIndex].amount) / 1000000000;
                  return (quantity * price * 0.2).toFixed(2); // 80% discount
                }
                return '0.00';
              })()} wAR
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
