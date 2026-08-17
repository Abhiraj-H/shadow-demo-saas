# Shadow Demo SaaS

A sample Next.js & TypeScript SaaS application designed to demonstrate semantic dependency graph analysis, blast-radius calculation, and AI-driven risk detection with **Shadow**.

## Architecture & Key Workflows

- **Prisma Schema** (`prisma/schema.prisma`): User models and database definition.
- **Authentication** (`lib/auth.ts`, `app/api/auth/reset-password/route.ts`): User authentication and password reset dispatch.
- **Billing & Customer Sync** (`lib/billing.ts`): Customer metadata formatting and downstream synchronization.
- **Notifications & Background Jobs** (`jobs/welcomeEmail.ts`, `lib/notifications.ts`, `lib/email.ts`): Asynchronous email processing and notification targets.
