-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "indicatorHash" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "reporterHash" TEXT NOT NULL,
    CONSTRAINT "Report_indicatorHash_fkey" FOREIGN KEY ("indicatorHash") REFERENCES "Indicator" ("hash") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Report" ("createdAt", "id", "indicatorHash", "note", "reporterHash", "type") SELECT "createdAt", "id", "indicatorHash", "note", "reporterHash", "type" FROM "Report";
DROP TABLE "Report";
ALTER TABLE "new_Report" RENAME TO "Report";
CREATE UNIQUE INDEX "Report_indicatorHash_reporterHash_key" ON "Report"("indicatorHash", "reporterHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
