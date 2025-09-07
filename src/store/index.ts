import { configureStore } from "@reduxjs/toolkit";
import auth from "./authSlice";
import profile from "./profileSlice";
import org from "./orgSlice";
import activeOrg from "./activeOrgSlice";
import confirmation from "./confirmationSlice";
import gateways from "./gatewaySlice";
import sensors from "./sensorsSlice";
import telemetry from "./telemetrySlice";
import liveData from "./liveDataSlice";
import settings from "./settingsSlice";
import members from "./membersSlice";
import invites from "./invitesSlice";
import permissionsCatalog from "./permissionsCatalogSlice";
import rolePermissions from "./rolePermissionsSlice";
import { setStoreReference } from "../api/http";

export const store = configureStore({
  reducer: { 
    auth, 
    profile, 
    org, 
    activeOrg, 
    confirmation, 
    gateways, 
    sensors, 
    telemetry, 
    liveData, 
    settings,
    members,
    invites,
    permissionsCatalog,
    rolePermissions
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ["sensors/setFilters", "telemetry/setTimeRange"],
        // Ignore these field paths in all actions
        ignoredActionPaths: ["payload.timeRange.start", "payload.timeRange.end"],
        // Ignore these paths in the state
        ignoredPaths: [
          "sensors.filters.timeRange.start",
          "sensors.filters.timeRange.end",
          "telemetry.timeRange.start",
          "telemetry.timeRange.end",
        ],
      },
    }),
});

// Set store reference for HTTP client to avoid circular dependency
setStoreReference(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
