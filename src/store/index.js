import { configureStore, getDefaultMiddleware } from "@reduxjs/toolkit";
import createSagaMiddleware from "@redux-saga/core";
import saga from "./saga";

// reducers
import teamSizeReducer from "../features/team/teamSizeSlice";
import randomDataSlice from "../features/team/randomDataSlice";

// middleware
const sagaMiddleware = createSagaMiddleware();
const middleware = [...getDefaultMiddleware({ thunk: false }), sagaMiddleware];

// This creates a Redux store, and also automatically configure
// the Redux DevTools extension so that you can inspect the
// store while developing
const store = configureStore({
  reducer: {
    teamSize: teamSizeReducer,
    randomData: randomDataSlice,
  },
  middleware,
});

sagaMiddleware.run(saga);

export default store;
