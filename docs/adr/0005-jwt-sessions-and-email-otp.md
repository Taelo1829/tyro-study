# 0005 JWT sessions with email-verified sign-up

- **Status:** Accepted
- **Date:** 2026-10-29 (records the existing choice, plans changes)

## Context
Students sign in with email and password. Accounts must have a working email (password resets, reminders). Serverless functions favour stateless sessions.

## Decision
NextAuth 4 credentials provider with **JWT sessions** in an httpOnly, SameSite=Lax cookie, Secure in production; the cookie name is shared with the middleware (`src/lib/auth-cookies.ts`). Sign-up creates the account only after a 6-digit emailed code (hashed, 10-minute expiry, 5 attempts). Passwords are bcrypt cost 12. Admin rights are always re-checked in the database (`requireAdmin()`), never trusted from the token alone.

Planned (architecture doc §6.1): sign-in rate limit, `tokenVersion` for revoking sessions, admin sign-in OTP, role read from the database wherever it grants extra rights.

## Consequences
No session table lookups per request. A role change takes effect for admin checks immediately but not for anything that reads `session.user.role`, which is why that pattern is being removed.
