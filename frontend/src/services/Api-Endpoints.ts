/**
 * Enumeration of URL slugs for different routes or endpoints in the application.
 */
export enum Slug {
  LOGIN = "/auth/login",
  REGISTER = "/auth/signup",
  REFRESH = "/auth/refresh",
  UPLOAD_CHUNK = "/upload/chunk",
  COMPLETE_UPLOAD = "/upload/complete",
  FILE_STATUS = "/upload/status",
  INITIATE_FILE_UPLOAD = "/upload/initiate",
  GET_ALL_FILES = "/upload/all",
  CREATE_FOLDER = "/upload/folder",
  CREATE_FILE = "/upload/create-file",
  PAUSE_UPLOAD = "/upload/pause",
  UPDATE_ACTIVITY = "/upload",
  THUMBNAILS = "/upload/thumbnails",
  MOVE_ITEM = "/upload/move",
  HISTORY = "/upload"
}
