// src/lib/auth/AuthBootstrap.tsx
import { useEffect } from "react";
import { useAppDispatch } from "../../hooks/useAppDispatch";
import { initSession } from "../../store/authSlice";
import { fetchProfile } from "../../store/profileSlice";
import { fetchOrg } from "../../store/orgSlice";

export default function AuthBootstrap() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(initSession())
      .unwrap()
      .then(() => dispatch(fetchProfile()).unwrap())
      .then((p) => {
        // Note: We'll add org fetching in Step 2
      })
      .catch(() => {
        /* not logged‑in */
      });
  }, [dispatch]);
  return null;
}
