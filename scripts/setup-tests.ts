import { beforeAll, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

const workerId = process.env.VITEST_POOL_ID || '1';
process.env.DATABASE_URL = `file:./test_${workerId}.db`;

let prisma: PrismaClient;

beforeAll(() => {
  // Run Prisma migrate or push for this specific db
  execSync('npx prisma db push --accept-data-loss', { stdio: 'ignore' });
  prisma = new PrismaClient();
});

beforeEach(async () => {
  if (prisma) {
    await prisma.report.deleteMany();
    await prisma.claim.deleteMany();
    await prisma.scan.deleteMany();
    await prisma.indicator.deleteMany();
  }
});
