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
  const isMobile = useMediaQuery('(max-width: 640px)');
  const isTablet = useMediaQuery('(min-width: 641px) and (max-width: 1024px)');
  const isDesktop = useMediaQuery('(min-width: 1025px)');
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isPortrait = useMediaQuery('(orientation: portrait)');
  const isTouchDevice = useMediaQuery('(hover: none) and (pointer: coarse)');
  
  // Enhanced mobile detection
  const isMobileLandscape = isMobile && isLandscape;
  const isMobilePortrait = isMobile && isPortrait;
  const isShortHeight = useMediaQuery('(max-height: 500px)');
  
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
    isSmallScreen: isMobile || (isTablet && isPortrait),
    // Mobile device in landscape should still be treated as mobile
    isMobileDevice: isMobile || (isTouchDevice && isShortHeight),
  };
};
