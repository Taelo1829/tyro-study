-- Superusers: admins who manage other admins (roles, superuser access, deleting admins)
ALTER TABLE "users" ADD COLUMN "isSuperuser" BOOLEAN NOT NULL DEFAULT false;
