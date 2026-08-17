import { sendPasswordReset } from "@/lib/auth";

export async function POST() {
  const user = {
    id: "user_123",
    email: "alex@example.com",
    name: "Alex",
  };

  await sendPasswordReset(user);

  return Response.json({
    success: true,
  });
}
