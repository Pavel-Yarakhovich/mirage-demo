import { call, takeEvery, put } from "@redux-saga/core/effects";
import axios from "axios";
import { sagaActions } from "./sagaActions";
import { setRandomData } from "../../features/team/randomDataSlice";

const callAPI = async ({ url, method, data }) => {
  const response = await axios({
    url,
    method,
    data,
  });
  console.log("RES ", response);
  return response;
};

export function* fetchDataSaga(action) {
  try {
    yield put(
      setRandomData({
        [action.payload]: {
          loading: true,
        },
      })
    );
    const result = yield call(() =>
      callAPI({
        url: "https://jsonplaceholder.typicode.com/users",
      })
    );
    console.log("RES ", result);
    yield put(
      setRandomData({
        [action.payload]: {
          loading: false,
          data: result.data,
        },
      })
    );
  } catch (e) {
    yield put({ type: "FETCH_FAILED" });
  }
}

export default function* rootSaga() {
  yield takeEvery(sagaActions.FETCH_DATA_SAGA, fetchDataSaga);
}
