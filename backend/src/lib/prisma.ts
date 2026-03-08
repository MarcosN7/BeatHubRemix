import { PrismaClient } from '@prisma/client';

// By exporting a single instance of the client, we ensure that
// our entire application shares the same database connection pool.
export const prisma = new PrismaClient();