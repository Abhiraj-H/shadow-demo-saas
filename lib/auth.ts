import { sendEmail } from "./email";
import type { User } from "@/types/user";

export async function sendPasswordReset(
  user: User
) {
  await sendEmail(
    user.email,
    "Reset your password",
    "Click the reset link"
  );
}
