const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Self-healing database migration check for security fields
(async () => {
  try {
    const columns = await prisma.$queryRaw`SHOW COLUMNS FROM \`user\``;
    const hasSessionToken = columns.some(col => col.Field === 'session_token');
    if (!hasSessionToken) {
      console.log('Adding security columns to user table...');
      await prisma.$executeRawUnsafe('ALTER TABLE `user` ADD COLUMN `session_token` VARCHAR(255) NULL;');
      await prisma.$executeRawUnsafe('ALTER TABLE `user` ADD COLUMN `last_login_ip` VARCHAR(100) NULL;');
      await prisma.$executeRawUnsafe('ALTER TABLE `user` ADD COLUMN `last_login_ua` TEXT NULL;');
      await prisma.$executeRawUnsafe('ALTER TABLE `user` ADD COLUMN `last_login_at` TIMESTAMP NULL;');
      console.log('Security columns added successfully.');
    }
  } catch (err) {
    console.error('Error during security migration check:', err);
  }
})();

module.exports = prisma;
