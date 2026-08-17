import type { User } from "@/types/user";

export async function syncBillingCustomer(
  user: User
) {
  return {
    customerId: user.id,
    metadata: {
      email: user.email.toLowerCase(),
    },
  };
}
