import { counterSlice } from "../features/counter";
import { fileUploadSlice } from "../features/fileUpload/fileUploadSlice";
import { profileSlice } from "../features/profileStore/profileSlice";

export const reducer = {
  [counterSlice.name]: counterSlice.reducer,
  [fileUploadSlice.name]: fileUploadSlice.reducer,
  [profileSlice.name]: profileSlice.reducer
};
