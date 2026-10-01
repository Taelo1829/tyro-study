// Re-use the single Prisma client from ./prisma. This file used to create a
// second PrismaClient with its own connection pool, doubling DB connections
// (which matters on serverless/Vercel where connections are limited).
export { prisma as db } from "./prisma"
