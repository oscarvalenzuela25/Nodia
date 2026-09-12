import { mainInstance } from "../../../../../config/api";
import type {
  Action,
  CreateActionPayload,
  GetActionsParams,
  PaginatedResponse,
  UpdateActionPayload,
} from "../types";

const getEndpoint = (path: string) => {
  const hasV1 = mainInstance.defaults.baseURL?.includes("/api/v1");
  return hasV1 ? path : `/api/v1${path}`;
};

export const getActions = async (
  params?: GetActionsParams
): Promise<PaginatedResponse<Action>> => {
  const { data } = await mainInstance.get<PaginatedResponse<Action>>(
    getEndpoint("/action"),
    { params }
  );
  return data;
};

export const createAction = async (
  payload: CreateActionPayload
): Promise<Action> => {
  const { data } = await mainInstance.post<Action>(
    getEndpoint("/action"),
    payload
  );
  return data;
};

export const updateAction = async (
  actionId: string,
  payload: UpdateActionPayload
): Promise<Action> => {
  const { data } = await mainInstance.put<Action>(
    getEndpoint(`/action/${actionId}`),
    payload
  );
  return data;
};
