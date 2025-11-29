import { counterSlice } from "../features/counter";
import { fileUploadSlice } from "../features/fileUpload/fileUploadSlice";

export const reducer = {
  [counterSlice.name]: counterSlice.reducer,
  [fileUploadSlice.name]: fileUploadSlice.reducer
};
