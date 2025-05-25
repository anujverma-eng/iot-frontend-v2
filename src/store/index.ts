import { configureStore } from "@reduxjs/toolkit";
import auth from "./authSlice";
import profile from "./profileSlice";
import org from "./orgSlice";
import confirmation from "./confirmationSlice";
import gateways from "./gatewaySlice";
import sensors from "./sensorsSlice";
import telemetry from "./telemetrySlice";
export const store = configureStore({
  reducer: { auth, profile, org, confirmation, gateways, sensors, telemetry },
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
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
