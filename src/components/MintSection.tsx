import React, { useState, useEffect } from 'react';
import { getNftSaleClientAutoConfiguration, INftSaleClient, NftSaleClient, NftSaleClientConfig, PurchaseNftError } from 'ao-process-clients';
import './MintSection.css';
import { NftSaleInfo } from 'ao-process-clients/dist/src/clients/nft-sale/abstract/types';

interface MintSectionProps {
  currentPhase: 'OG' | 'FCFS' | 'PUBLIC' | 'NOT_STARTED';
  timeLeft: {
    og: string;
    fcfs: string;
    public: string;
  };
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

export function MintSection({ currentPhase, timeLeft }: MintSectionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [nftSaleClient, setNftSaleClient] = useState<INftSaleClient | null>(null);
  const [totalMinted, setTotalMinted] = useState(0);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  
  // Client info state
  const [masterWhitelist, setMasterWhitelist] = useState<[string, string, Record<string, boolean>][]>([]);
  const [currentZone, setCurrentZone] = useState<number>(0);
  const [whitelistZones, setWhitelistZones] = useState<number[]>([]);
  const [purchaseLimits, setPurchaseLimits] = useState<[number, Record<string, number>][]>([]);

  // Function to fetch and update client info
  const fetchClientInfo = async (client: INftSaleClient) => {
    try {
      const now = Date.now();
      const response = await client.getInfo();
      console.log('Fetched info response:', JSON.stringify(response, null, 2));

      // Parse and validate the response
      const info = response as any;
      
      // Log the raw data structure
      console.log('Response structure:', {
        hasCurrentZone: 'Current_Zone' in info,
        currentZoneType: typeof info.Current_Zone,
        hasMasterWhitelist: 'MasterWhitelist' in info,
        masterWhitelistType: Array.isArray(info.MasterWhitelist) ? 'array' : typeof info.MasterWhitelist,
        hasWhitelistZones: 'WhitelistZones' in info,
        whitelistZonesType: Array.isArray(info.WhitelistZones) ? 'array' : typeof info.WhitelistZones,
        hasPurchaseLimits: 'PurchaseLimits' in info,
        purchaseLimitsType: Array.isArray(info.PurchaseLimits) ? 'array' : typeof info.PurchaseLimits
      });
      
      // Validate and extract data with fallbacks
      const currentZone = typeof info.Current_Zone === 'number' ? info.Current_Zone : 1;
      const whitelistZones = Array.isArray(info.WhitelistZones) ? info.WhitelistZones : [];
      const masterWhitelist = Array.isArray(info.MasterWhitelist) ? info.MasterWhitelist : [];
      const purchaseLimits = Array.isArray(info.PurchaseLimits) ? info.PurchaseLimits : [];
      
      console.log('Extracted data:', {
        currentZone,
        whitelistZones,
        masterWhitelist,
        purchaseLimits
      });

      // Transform purchase limits with additional validation
      const parsedPurchaseLimits: [number, Record<string, number>][] = purchaseLimits.map((item: any) => {
        // Ensure item is an array with at least 2 elements
        if (!Array.isArray(item) || item.length < 2) {
          console.warn('Invalid purchase limit item:', item);
          return [0, {}] as [number, Record<string, number>];
        }
        
        const [limit, purchased] = item;
        const purchasedRecord: Record<string, number> = {};
        if (Array.isArray(purchased)) {
          purchased.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              Object.entries(item).forEach(([key, value]) => {
                if (typeof value === 'number') {
                  purchasedRecord[key] = value;
                }
              });
            }
          });
        } else if (typeof purchased === 'object' && purchased !== null) {
          Object.entries(purchased).forEach(([key, value]) => {
            if (typeof value === 'number') {
              purchasedRecord[key] = value;
            }
          });
        }
        return [limit, purchasedRecord] as [number, Record<string, number>];
      });

      // Update state with validated data
      console.log('Updating state with validated data:', {
        currentZone,
        whitelistZones,
        masterWhitelist,
        purchaseLimits: parsedPurchaseLimits
      });

      setMasterWhitelist(masterWhitelist);
      setCurrentZone(currentZone);
      setWhitelistZones(whitelistZones);
      setPurchaseLimits(parsedPurchaseLimits);
      setLastUpdateTime(now);

      // Update total minted
      const nftsLeft = await client.queryNFTCount();
      const TOTAL_NFTS_AVAILABLE = 3333;
      const nftsSold = Math.abs(nftsLeft - TOTAL_NFTS_AVAILABLE);
      setTotalMinted(nftsSold);

      return true;
    } catch (error) {
      console.error('Failed to fetch client info:', error);
      return false;
    }
  };

  // Initialize NFT client and set up polling after wallet connection
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let consecutiveFailures = 0;
    const MAX_FAILURES = 3;
    const BASE_INTERVAL = 10000;
    const MAX_INTERVAL = 30000;
    
    const init = async () => {
      if (!isConnected || !walletAddress) {
        return;
      }

      try {
        // Create NFT Sale Client Configuration
        const config: NftSaleClientConfig = {
          ...getNftSaleClientAutoConfiguration(),
          processId: "ewO-sg8QM8xK_yM_ERzvbOZ4DCbTGoBK51uZnc3MENw",
          tokenProcessId: "hqkQC3X-UfFeHRNc83OYORbsB_9v6uW0A-hDRVTH1mU"
        };

        console.log('Initializing NFT client...');
        const client = await NftSaleClient.create(config);
        console.log('NFT client initialized successfully');
        setNftSaleClient(client);

        // Initial fetch of client info
        const success = await fetchClientInfo(client);
        if (!success) {
          console.error('Failed initial data fetch');
          return;
        }

        // Set up polling for updates with error recovery
        intervalId = setInterval(async () => {
          console.log('Polling for updates...');
          const success = await fetchClientInfo(client);
          
          if (success) {
            consecutiveFailures = 0;
            // Reset interval if it was increased
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = setInterval(async () => {
                const success = await fetchClientInfo(client);
                if (!success) consecutiveFailures++;
                else consecutiveFailures = 0;
              }, BASE_INTERVAL);
            }
          } else {
            consecutiveFailures++;
            console.error(`Failed to fetch updates (${consecutiveFailures}/${MAX_FAILURES} failures)`);
            
            // If too many failures, increase polling interval
            if (consecutiveFailures >= MAX_FAILURES) {
              if (intervalId) {
                clearInterval(intervalId);
                intervalId = setInterval(async () => {
                  const success = await fetchClientInfo(client);
                  if (success) {
                    consecutiveFailures = 0;
                    // Reset to normal interval
                    if (intervalId) {
                      clearInterval(intervalId);
                      intervalId = setInterval(() => fetchClientInfo(client), BASE_INTERVAL);
                    }
                  }
                }, MAX_INTERVAL);
              }
            }
          }
        }, BASE_INTERVAL);
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

    // Cleanup function to clear interval
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isConnected, walletAddress]); // Run when wallet connection changes

  const connectWallet = async () => {
    try {
      if (window.arweaveWallet) {
        console.log('Connecting to Arweave wallet...');
        await window.arweaveWallet.connect(['ACCESS_ADDRESS', 'SIGN_TRANSACTION']);
        const address = await window.arweaveWallet.getActiveAddress();
        console.log('Successfully connected to Arweave wallet');
        console.log('Wallet address:', address);
        setIsConnected(true);
        setWalletAddress(address);

        // Refresh data after wallet connection
        if (nftSaleClient) {
          await fetchClientInfo(nftSaleClient);
        }

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
      const [limit, purchased] = purchaseLimits[zoneIndex] || [0, {}];
      const zoneTitle = `Zone ${currentZone}`;
      
      // Get whitelist amount for price calculation
      const [amount, , ] = masterWhitelist[zoneIndex] || ['0', '0', {}];
      const price = amount ? 
        `${parseInt(amount) / 1000000000000} wAR` : // Convert from winston to AR
        'N/A';

      return {
        title: zoneTitle,
        note: `Purchase limit: ${limit} per wallet`,
        price,
        maxMint: limit,
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

  const getZoneInfo = (zoneIndex: number) => {
    if (zoneIndex >= 0 && zoneIndex < masterWhitelist.length) {
      const [amount, , addresses] = masterWhitelist[zoneIndex] || ['0', '0', {}];
      const [limit, purchased] = purchaseLimits[zoneIndex] || [0, {}];
      const priceInWinston = BigInt(amount);
      const price = Number(priceInWinston) / 1000000000000;
      
      // Check if user is whitelisted for this zone
      const isWhitelisted = zoneIndex === 2 || // Zone 3 is open to all
        (walletAddress && addresses[walletAddress]);
      
      // Check if user has reached purchase limit
      const userPurchases = walletAddress ? (purchased as Record<string, number>)[walletAddress] || 0 : 0;
      const canPurchase = isWhitelisted && (walletAddress ? (!(purchased as Record<string, number>)[walletAddress] || userPurchases < limit) : false);
      
      return {
        price: price.toFixed(2),
        limit,
        purchased,
        isWhitelisted,
        canPurchase,
        userPurchases
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

    console.log('Getting phase status with:', {
      currentZone,
      masterWhitelistLength: masterWhitelist.length,
      purchaseLimitsLength: purchaseLimits.length,
      lastUpdateTime: new Date(lastUpdateTime).toISOString()
    });

    return zones.map(zone => {
      const info = getZoneInfo(zone.index);
      const isActive = currentZone === zone.index + 1;
      const isCompleted = currentZone > zone.index + 1;

      const status = {
        name: zone.name,
        status: isActive ? 'Active' : isCompleted ? 'Completed' : 'Waiting',
        info: info ? `${info.price} wAR • Max ${info.limit} per wallet` : 'Loading...',
        completed: isCompleted
      };

      console.log(`Zone ${zone.index + 1} status:`, {
        ...status,
        isActive,
        isCompleted,
        hasInfo: !!info,
        zoneInfo: info
      });

      return status;
    });
  };

  const isMintingEnabled = () => {
    // Check if we have valid zone data
    const hasValidZoneData = currentZone > 0 && 
                            masterWhitelist.length > 0 && 
                            purchaseLimits.length > 0;
    
    // Check if data is stale (over 1 minute old)
    const isDataFresh = Date.now() - lastUpdateTime < 60000;
    
    // console.log('Minting enabled check:', {
    //   currentZone,
    //   hasValidZoneData,
    //   isDataFresh,
    //   lastUpdateTime: new Date(lastUpdateTime).toISOString(),
    //   masterWhitelistLength: masterWhitelist.length,
    //   purchaseLimitsLength: purchaseLimits.length
    // });
    
    return hasValidZoneData && isDataFresh;
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

      // Purchase NFTs based on quantity
      for (let i = 0; i < quantity; i++) {
        try {
          let success;
          if (isLuckyDraw) {
            success = await nftSaleClient.luckyDraw();
          } else {
            success = await nftSaleClient.purchaseNft();
          }
          
          if (!success) {
            throw new Error(isLuckyDraw ? 'Lucky draw failed' : 'Purchase failed');
          }
        } catch (error) {
          if (error instanceof PurchaseNftError) {
            throw new Error(`${isLuckyDraw ? 'Lucky draw' : 'Purchase'} failed: ${error.message}`);
          }
          throw error;
        }
      }

      // After successful mint, update all data
      console.log('Refreshing data after successful mint...');
      await fetchClientInfo(nftSaleClient);
      
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        // Refresh data again after success message disappears
        if (nftSaleClient) {
          console.log('Refreshing data after success message...');
          fetchClientInfo(nftSaleClient);
        }
      }, 3000);
    } catch (error) {
      console.error('Minting failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to mint NFT');
    } finally {
      setIsLoading(false);
    }
  };

  const renderWhitelistStatus = (zoneInfo: ReturnType<typeof getZoneInfo>) => {
    if (!zoneInfo || !walletAddress) return null;
    return (
      <div className="whitelist-indicator">
        <span className="whitelist-text">Whitelisted</span>
        <span 
          className={`whitelist-status ${zoneInfo.isWhitelisted ? 'can-purchase' : 'not-whitelisted'}`}
          title={zoneInfo.isWhitelisted ? 'You can mint in this zone' : 'Not whitelisted for this zone'}
        >
          {zoneInfo.isWhitelisted ? '✅' : '❌'}
        </span>
      </div>
    );
  };

  return (
    <>
      <div className="mint-container">
        {!isConnected ? (
          <div className="connect-wallet-section">
            <h2>Connect Your Wallet</h2>
            <p>Please connect your Arweave wallet to view minting information and participate in the sale.</p>
            <button 
              className="connect-wallet-button"
              onClick={connectWallet}
              disabled={isLoading}
            >
              {isLoading ? 'Connecting...' : 'Connect Wallet'}
            </button>
            {error && (
              <div className="error-message">{error}</div>
            )}
          </div>
        ) : (
          <>

            <div className="phase-info">
              <div className="current-phase">{getPhaseInfo(currentPhase).title}</div>
              {getPhaseInfo(currentPhase).showPrice && (
                <div className="price">Price: {getPhaseInfo(currentPhase).price}</div>
              )}
              {getPhaseInfo(currentPhase).note && (
                <div className="phase-note">{getPhaseInfo(currentPhase).note}</div>
              )}
              {error && (
                <div className="error-message">{error}</div>
              )}
            </div>

            <div className="phase-timers">
              {getPhaseStatus().map((phase, index) => {
                const isActive = currentZone === index + 1;
                const zoneInfo = getZoneInfo(index);
                return (
                  <div 
                    key={index} 
                    className={`phase-timer ${isActive ? 'active' : ''} ${phase.completed ? 'completed' : ''}`}
                  >
                    <div className="phase-info">
                      <div className="phase-name">
                        {phase.name}
                        <div className="phase-info-details">{phase.info}</div>
                      </div>
                      <div className={`phase-status ${phase.status.toLowerCase()}`}>
                        {phase.status}
                      </div>
                      <div className={`status ${phase.completed ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
                        {renderWhitelistStatus(zoneInfo)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {(currentPhase === 'OG' || currentPhase === 'FCFS' || currentPhase === 'PUBLIC') && (
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
                  {isLoading ? 'Processing...' : `Mint ${quantity} Now`}
                </button>
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
          </>
        )}
      </div>

      <div className="loading-overlay" style={{ display: (isLoading || showSuccess) ? 'flex' : 'none' }}>
        {isLoading ? (
          <div className="loading-spinner" />
        ) : (
          showSuccess && <h2 className="success-message">Successfully Minted!</h2>
        )}
      </div>
    </>
  );
}
