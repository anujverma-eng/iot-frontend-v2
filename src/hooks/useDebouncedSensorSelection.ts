import { useRef, useCallback } from 'react';

/**
 * Custom hook to debounce sensor selection and prevent race conditions
 * when users rapidly click between sensors
 */
export const useDebouncedSensorSelection = (
  onSensorSelect: (id: string) => void,
  delay: number = 150
) => {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const currentSelectionRef = useRef<string | null>(null);

  const debouncedSelect = useCallback((sensorId: string) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Update the current selection immediately for UI feedback
    currentSelectionRef.current = sensorId;

    // Debounce the actual selection logic
    timeoutRef.current = setTimeout(() => {
      // Only proceed if this is still the intended selection
      if (currentSelectionRef.current === sensorId) {
        onSensorSelect(sensorId);
      }
    }, delay);
  }, [onSensorSelect, delay]);

  const cancelSelection = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    currentSelectionRef.current = null;
  }, []);

  const getCurrentSelection = useCallback(() => {
    return currentSelectionRef.current;
  }, []);

  return {
    debouncedSelect,
    cancelSelection,
    getCurrentSelection
  };
};
