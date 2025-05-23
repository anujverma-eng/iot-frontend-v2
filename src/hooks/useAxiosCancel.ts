// src/hooks/useAxiosCancel.ts
import { useEffect } from 'react';
import { cancelPendingRequests } from '../lib/apiClient';

/**
 * Call inside a page‑level component so that when the component unmounts
 * (route change, modal close, etc.) all HTTP calls it initiated are aborted.
 */
export const useAxiosCancel = () => {
  useEffect(() => cancelPendingRequests, []);
};


// Use in any page that fires background requests: example below:

// export default function SensorListPage() {
//   useAxiosCancel();
//   /* … */
// }
