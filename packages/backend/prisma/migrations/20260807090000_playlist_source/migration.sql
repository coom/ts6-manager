-- AlterTable
-- Both nullable so playlists created by hand stay valid without a backfill.
-- SQLite treats NULLs as distinct in a unique index, so existing rows cannot
-- collide with each other on the new constraint.
ALTER TABLE "Playlist" ADD COLUMN "serverConfigId" INTEGER REFERENCES "TsServerConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Playlist" ADD COLUMN "sourceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Playlist_serverConfigId_sourceId_key" ON "Playlist"("serverConfigId", "sourceId");
