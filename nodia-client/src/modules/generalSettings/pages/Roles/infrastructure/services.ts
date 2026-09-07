import { mainInstance } from "../../../../../config/axiosInstance";
import type {
  CreateRolePayload,
  GetRolesParams,
  PaginatedResponse,
  Role,
  UpdateRolePayload,
} from "../types";

const getEndpoint = (path: string) => {
  const hasV1 = mainInstance.defaults.baseURL?.includes("/api/v1");
  return hasV1 ? path : `/api/v1${path}`;
};

export const getRoles = async (
  params?: GetRolesParams
): Promise<PaginatedResponse<Role>> => {
  const { data } = await mainInstance.get<PaginatedResponse<Role>>(
    getEndpoint("/roles"),
    { params }
  );
  return data;
};

export const createRole = async (
  payload: CreateRolePayload
): Promise<Role> => {
  const { data } = await mainInstance.post<Role>(
    getEndpoint("/role"),
    payload
  );
  return data;
};

export const updateRole = async (
  roleId: string,
  payload: UpdateRolePayload
): Promise<Role> => {
  const { data } = await mainInstance.put<Role>(
    getEndpoint(`/role/${roleId}`),
    payload
  );
  return data;
};
