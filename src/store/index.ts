import { configureStore } from "@reduxjs/toolkit";
import auth from "./authSlice";
import profile from "./profileSlice";
import org from "./orgSlice";
import confirmation from "./confirmationSlice";
import gateways from './gatewaySlice';
import sensors from "./sensorsSlice";
import telemetry from "./telemetrySlice";
export const store = configureStore({
  reducer: { auth, profile, org, confirmation, gateways, sensors, telemetry },
});
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
