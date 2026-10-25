import { PrismaClient } from '../generated/prisma/index.js';

const prisma = new PrismaClient();

async function main() {
  // Seed default app settings (no default admin — use /setup wizard instead)
  await prisma.appSetting.upsert({
    where: { key: 'max_music_bots' },
    update: {},
    create: { key: 'max_music_bots', value: '5' },
  });

  await prisma.appSetting.upsert({
    where: { key: 'max_playlist_import' },
    update: {},
    create: { key: 'max_playlist_import', value: '50' },
  });

  console.log('Seed completed: app settings created. Visit /setup to create your admin account.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
