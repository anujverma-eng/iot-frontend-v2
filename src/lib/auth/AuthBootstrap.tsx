// src/lib/auth/AuthBootstrap.tsx
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../hooks/useAppDispatch";
import { initSession } from "../../store/authSlice";
import { resolveInitialActiveOrg } from "../../store/activeOrgSlice";

export default function AuthBootstrap() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const profile = useAppSelector((s) => s.profile);
  
  useEffect(() => {
    dispatch(initSession())
      .unwrap()
      .then(() => {
        // resolveInitialActiveOrg handles profile loading internally
        dispatch(resolveInitialActiveOrg());
      })
      .catch(() => {
        /* not logged‑in */
      });
  }, [dispatch]);
  
  // Handle post-auth actions after profile is loaded
  useEffect(() => {
    if (!profile.loaded || !profile.data?.user) return;
    
    // Check if there's actually postAuth data to handle
    const postAuth = localStorage.getItem('postAuth');
    if (!postAuth) return; // No postAuth data, let normal routing take over
    
    // Only handle postAuth if not already on invitation page
    if (location.pathname.startsWith('/invites/')) return;
    
    // Don't interfere with normal onboarding flow
    if (location.pathname === '/onboarding') return;
    
    try {
      const parsed = JSON.parse(postAuth);
      if (parsed.kind === 'invite' && parsed.token) {
        localStorage.removeItem('postAuth');
        
        // For new users (no memberships), let them choose on the invitation page
        // For existing users, respect their intent
        const memberships = profile.data.memberships || [];
        const hasExistingOrgs = memberships.length > 0;
        
        if (hasExistingOrgs) {
          // Existing user - respect their intent
          navigate(`/invites/${parsed.token}?intent=${parsed.intent || 'accept'}`);
        } else {
          // New user - let them choose (no auto-intent)
          navigate(`/invites/${parsed.token}`);
        }
        return;
      }
    } catch (e) {
      console.error('Failed to parse postAuth:', e);
    }
    // Clean up invalid postAuth data
    localStorage.removeItem('postAuth');
  }, [profile.loaded, profile.data?.user?.id, profile.data?.memberships?.length, location.pathname, navigate]);
  
  return null;
}
