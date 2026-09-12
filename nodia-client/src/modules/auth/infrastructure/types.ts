import type { AuthUser } from "../../../store/authStore";

export interface AuthResponse {
  token: string;
  expiresAt: number;
  user: AuthUser;
}
