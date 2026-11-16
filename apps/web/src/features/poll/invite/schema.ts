import * as z from "zod";

export const sendPollInviteSchema = z.object({
  pollId: z.string().min(1),
  // Normalized before validation so "  Jessie@Example.com " matches the
  // citext unique index the same way the stored row does.
  email: z.string().trim().toLowerCase().pipe(z.email()),
});

export const MAX_INVITES_PER_SUBMIT = 20;

// The invite field accepts several addresses separated by commas, semicolons
// or spaces. Each one still goes through sendPollInviteSchema on the server.
export const inviteEmailsSchema = z
  .string()
  .transform((value) => [
    ...new Set(
      value
        .split(/[\s,;]+/)
        .map((address) => address.trim().toLowerCase())
        .filter(Boolean),
    ),
  ])
  .pipe(z.array(z.email()).min(1).max(MAX_INVITES_PER_SUBMIT));

export const recordPollInviteOpenSchema = z.object({
  pollId: z.string().min(1),
  token: z.string().min(1),
});

export const revokePollInviteSchema = z.object({
  pollId: z.string().min(1),
  inviteId: z.string().min(1),
});
