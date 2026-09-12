import envs from "./.envs";

export const apiPath = (path: string) =>
  envs.API_URL.replace(/\/$/, "").endsWith("/api/v1") ? path : `/api/v1${path}`;
