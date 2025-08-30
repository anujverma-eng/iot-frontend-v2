import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectIsLiveMode } from '../store/liveDataSlice';

/**
 * Hook to detect transitions between live and offline modes
 * Provides callbacks for when mode changes occur
 */
export const useLiveModeTransition = (
  onLiveToOffline?: () => void,
  onOfflineToLive?: () => void
) => {
  const isLiveMode = useSelector(selectIsLiveMode);
  const previousLiveModeRef = useRef<boolean>(isLiveMode);

  useEffect(() => {
    const previousLiveMode = previousLiveModeRef.current;

    if (previousLiveMode !== isLiveMode) {
      if (previousLiveMode && !isLiveMode) {
        // Transitioned from live to offline

        onLiveToOffline?.();
      } else if (!previousLiveMode && isLiveMode) {
        // Transitioned from offline to live

        onOfflineToLive?.();
      }
      
      previousLiveModeRef.current = isLiveMode;
    }
  }, [isLiveMode, onLiveToOffline, onOfflineToLive]);
  
  return {
    isLiveMode,
    previousLiveMode: previousLiveModeRef.current
  };
};
