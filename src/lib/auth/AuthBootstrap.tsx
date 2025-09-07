// src/lib/auth/AuthBootstrap.tsx
import { useEffect } from "react";
import { useAppDispatch } from "../../hooks/useAppDispatch";
import { initSession } from "../../store/authSlice";
import { resolveInitialActiveOrg } from "../../store/activeOrgSlice";

export default function AuthBootstrap() {
  const dispatch = useAppDispatch();
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
  return null;
}
