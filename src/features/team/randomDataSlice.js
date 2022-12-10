import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  dataPerTeammate: {},
};

export const randowDataSlice = createSlice({
  name: "randomData",
  initialState,
  reducers: {
    setRandomData: (state, action) => {
      state.dataPerTeammate = {
        ...state.dataPerTeammate,
        ...action.payload,
      };
    },
  },
});

export const { setRandomData } = randowDataSlice.actions;

export default randowDataSlice.reducer;
