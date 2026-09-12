import { mainInstance } from "../../../../../config/api";
import type {
  GetUsersParams,
  PaginatedResponse,
  User,
  CreateUserPayload,
  UpdateUserPayload,
} from "../types";

const getEndpoint = (path: string) => {
  const hasV1 = mainInstance.defaults.baseURL?.includes("/api/v1");
  return hasV1 ? path : `/api/v1${path}`;
};

export const getUsers = async (
  params?: GetUsersParams
): Promise<PaginatedResponse<User>> => {
  const { data } = await mainInstance.get<PaginatedResponse<User>>(
    getEndpoint("/users"),
    { params }
  );
  return data;
};

export const createUser = async (
  payload: CreateUserPayload
): Promise<User> => {
  const { data } = await mainInstance.post<User>(
    getEndpoint("/user"),
    payload
  );
  return data;
};

export const updateUser = async (
  userId: string,
  payload: UpdateUserPayload
): Promise<User> => {
  const { data } = await mainInstance.put<User>(
    getEndpoint(`/user/${userId}`),
    payload
  );
  return data;
};
