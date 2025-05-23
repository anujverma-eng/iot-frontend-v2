import { configureStore } from "@reduxjs/toolkit";
import auth from "./authSlice";
import profile from "./profileSlice";
import org from "./orgSlice";
import confirmation from "./confirmationSlice";

export const store = configureStore({
  reducer: { auth, profile, org, confirmation },
});
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
