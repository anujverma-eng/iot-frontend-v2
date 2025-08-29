import React from 'react';

/**
 * Custom hook to check if a media query matches
 * @param query The media query to check
 * @returns Boolean indicating if the media query matches
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    // Create media query list
    const mediaQuery = window.matchMedia(query);
    
    // Set initial value
    setMatches(mediaQuery.matches);
    
    // Define listener function
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };
    
    // Add listener
    mediaQuery.addEventListener('change', handleChange);
    
    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
};

/**
 * Custom hook for responsive breakpoints
 * @returns Object with breakpoint states
 */
export const useBreakpoints = () => {
  const isMobileScreen = useMediaQuery('(max-width: 640px)');
  const isTablet = useMediaQuery('(min-width: 641px) and (max-width: 1024px)');
  const isDesktop = useMediaQuery('(min-width: 1025px)');
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isPortrait = useMediaQuery('(orientation: portrait)');
  const isTouchDevice = useMediaQuery('(hover: none) and (pointer: coarse)');
  const isShortHeight = useMediaQuery('(max-height: 500px)');
  const isVeryShortHeight = useMediaQuery('(max-height: 400px)');
  
  // Specific iPhone detection
  const isIPhone14Pro = useMediaQuery('(device-width: 393px) and (device-height: 852px)');
  const isIPhoneLandscape = useMediaQuery('(max-height: 430px) and (min-width: 750px)');
  
  // Pixel phone detection (common Pixel dimensions in landscape)
  const isPixelLandscape = useMediaQuery('(max-height: 450px) and (min-width: 800px) and (max-width: 950px)');
  
  // More refined mobile detection with specific device support
  const isMobile = isMobileScreen || 
    (isTouchDevice && isVeryShortHeight && !isTablet) ||
    (isIPhone14Pro && isLandscape) ||
    isIPhoneLandscape ||
    isPixelLandscape;
    
  // Console logging for iPhone 14 Pro landscape debugging
  React.useEffect(() => {
    if (isIPhone14Pro && isLandscape) {
      console.log('[useBreakpoints] iPhone 14 Pro Landscape Detected!', {
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        isIPhone14Pro,
        isLandscape,
        isMobile,
        deviceWidth: window.screen.width,
        deviceHeight: window.screen.height
      });
    }
  }, [isIPhone14Pro, isLandscape, isMobile]);
  
  // Special case for mobile landscape with limited height
  const isMobileLandscapeShort = (isMobileScreen && isLandscape && isShortHeight) ||
    (isIPhone14Pro && isLandscape) ||
    isIPhoneLandscape ||
    isPixelLandscape;
  
  // Enhanced mobile detection - computed values, not additional hooks
  const isMobileLandscape = isMobile && isLandscape;
  const isMobilePortrait = isMobile && isPortrait;
  
  return {
    isMobile,
    isTablet,
    isDesktop,
    isLandscape,
    isPortrait,
    isTouchDevice,
    isMobileLandscape,
    isMobilePortrait,
    isShortHeight,
    isVeryShortHeight,
    isMobileLandscapeShort, // Enhanced with device-specific detection
    isIPhone14Pro,
    isIPhoneLandscape,
    isPixelLandscape,
    isSmallScreen: isMobile || (isTablet && isPortrait),
    // Mobile device in landscape should still be treated as mobile
    isMobileDevice: isMobile || (isTouchDevice && isShortHeight),
  };
};
