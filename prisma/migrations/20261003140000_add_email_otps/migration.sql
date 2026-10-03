-- One-time codes emailed to check an address works: when signing up and when changing email
CREATE TABLE "email_otps" (
    "id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "codeHash" TEXT NOT NULL,
    "payload" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sends" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_otps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_otps_purpose_key_key" ON "email_otps"("purpose", "key");

ALTER TABLE "email_otps" ADD CONSTRAINT "email_otps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
