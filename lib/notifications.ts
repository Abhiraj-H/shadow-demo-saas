import type { User } from "@/types/user";

export function getNotificationTarget(
  user: User
) {
  return user.email.trim();
}
