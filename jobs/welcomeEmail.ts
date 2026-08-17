import { sendEmail } from "@/lib/email";
import type { User } from "@/types/user";

export async function sendWelcomeEmail(
  user: User
) {
  await sendEmail(
    user.email,
    "Welcome!",
    "Thanks for joining."
  );
}
