import { SERVER_CONFIG } from "@/constants/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool } from 'pg'
import { neonConfig, Pool as NeonPool } from '@neondatabase/serverless'

const connString = SERVER_CONFIG.DATABASE_URL
let adapter = null

if (SERVER_CONFIG.DATABASE_ADAPTER === "neon") {
    const pool = new NeonPool({ connectionString: connString })
    adapter = new PrismaNeon(pool)
} else {
    const pool = new Pool({ connectionString: connString })
    adapter = new PrismaPg(pool)
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || (adapter ? new PrismaClient({ adapter }) : new PrismaClient());

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
