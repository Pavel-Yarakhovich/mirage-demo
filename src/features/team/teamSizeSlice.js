import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  value: 0,
};

export const teamSizeSlice = createSlice({
  name: "teamSize",
  initialState,
  reducers: {
    increment: (state) => {
      state.value += 1;
    },
    decrement: (state) => {
      state.value -= 1;
    },
    setByAmount: (state, action) => {
      state.value = action.payload;
    },
  },
});

export const { increment, decrement, setByAmount } = teamSizeSlice.actions;

export default teamSizeSlice.reducer;
