// lib/prisma.ts

import { PrismaClient } from "../prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let opt:any = {}
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(opt);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}