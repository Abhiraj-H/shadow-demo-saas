export async function sendEmail(
  email: string,
  subject: string,
  body: string
) {
  console.log("Sending email", {
    email,
    subject,
    body,
  });
}
