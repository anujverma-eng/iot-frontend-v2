
/* Logout.tsx */
import { useEffect } from 'react';
import { tokenManager } from '../utils/tokenManager';
export default function Logout() {
  useEffect(() => {
    tokenManager.clear();
    window.location.assign('/login');
  }, []);
  return <p className="p-8">Signing you out…</p>;
}