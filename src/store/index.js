import { configureStore } from "@reduxjs/toolkit";

// reducers
import teamSizeReducer from "../features/team/teamSizeSlice";

// This creates a Redux store, and also automatically configure
// the Redux DevTools extension so that you can inspect the
// store while developing
export const store = configureStore({
  reducer: {
    teamSize: teamSizeReducer,
  },
});
