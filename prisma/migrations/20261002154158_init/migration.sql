-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verdict" TEXT NOT NULL,
    "why" TEXT NOT NULL,
    "extractionMode" TEXT NOT NULL,
    "redactedTranscript" TEXT,
    "indicatorHashes" TEXT
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scanId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "nextAction" TEXT,
    "limitations" TEXT,
    "sourcesJson" TEXT,
    CONSTRAINT "Claim_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Indicator" (
    "hash" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "firstSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "scanCount" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "indicatorHash" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "reporterHash" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Report_indicatorHash_reporterHash_key" ON "Report"("indicatorHash", "reporterHash");
