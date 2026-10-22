import { z } from "zod";
import { mainInstance } from "../../../config/api";

const user = z.object({
  id: z.string().regex(/^[1-9]\d*$/),
  name: z.string().nullable(),
  email: z.string(),
  is_active: z.boolean(),
});
const page = z.object({
  data: z.array(user),
  meta: z.object({
    page: z.number().int().positive(),
    total_pages: z.number().int().nonnegative(),
  }),
});
export async function getScopeUsers(
  search: string,
  pageNumber: number,
  selectedId?: string,
  signal?: AbortSignal,
  activeOnly = false,
) {
  const endpoint = mainInstance.defaults.baseURL?.includes("/api/v1")
    ? "/users"
    : "/api/v1/users";
  const { data } = await mainInstance.get<unknown>(endpoint, {
    signal,
    params: {
      page: pageNumber,
      limit: 20,
      includes: false,
      q: selectedId
        ? { id_eq: selectedId }
        : {
            ...(activeOnly ? { is_active_eq: true } : {}),
            ...(search ? { email_cont: search } : {}),
          },
    },
  });
  return page.parse(data);
}
