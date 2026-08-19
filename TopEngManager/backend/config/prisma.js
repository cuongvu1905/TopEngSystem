const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

// All self-healing migration steps below used to be independent self-invoking async
// IIFEs, which run concurrently rather than in sequence. That's harmless when each
// step only touches its own pre-existing table, but it's a real race when a later
// step ALTERs a table that an earlier step is still in the middle of CREATE-ing (e.g.
// on a brand new production DB, the "add default_prefix to foldertemplate" step could
// run its "SHOW COLUMNS" check before the "create foldertemplate table" step had
// finished inserting its seed rows, silently fail with a caught error, and never
// retry — leaving the column missing forever even though the table exists). Running
// every step sequentially, awaited in order, removes that entire class of bug.
async function runMigrations() {
  // Self-healing database migration check for security fields
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

  // Self-healing table creation for the Document Repository feature
  try {
    const tables = await prisma.$queryRaw`SHOW TABLES LIKE 'documentfolder'`;
    if (tables.length === 0) {
      console.log('Creating documentfolder / document tables...');
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`documentfolder\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`folder_id\` VARCHAR(50) NOT NULL UNIQUE,
          \`name\` VARCHAR(255) NOT NULL,
          \`parent_folder_id\` VARCHAR(50) DEFAULT NULL,
          \`project_id\` VARCHAR(36) DEFAULT NULL,
          \`created_by\` VARCHAR(36) DEFAULT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT \`fk_folder_parent\` FOREIGN KEY (\`parent_folder_id\`) REFERENCES \`documentfolder\` (\`folder_id\`) ON DELETE CASCADE,
          CONSTRAINT \`fk_folder_project\` FOREIGN KEY (\`project_id\`) REFERENCES \`project\` (\`project_id\`) ON DELETE CASCADE,
          CONSTRAINT \`fk_folder_creator\` FOREIGN KEY (\`created_by\`) REFERENCES \`user\` (\`user_id\`) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`document\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`document_id\` VARCHAR(50) NOT NULL UNIQUE,
          \`folder_id\` VARCHAR(50) DEFAULT NULL,
          \`project_id\` VARCHAR(36) DEFAULT NULL,
          \`original_name\` VARCHAR(255) NOT NULL,
          \`stored_name\` VARCHAR(255) NOT NULL,
          \`file_path\` VARCHAR(500) NOT NULL,
          \`file_size\` INT DEFAULT NULL,
          \`file_ext\` VARCHAR(20) DEFAULT NULL,
          \`uploaded_by\` VARCHAR(36) DEFAULT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`doc_type\` VARCHAR(20) NOT NULL DEFAULT 'upload',
          \`updated_at\` TIMESTAMP NULL DEFAULT NULL,
          CONSTRAINT \`fk_document_folder\` FOREIGN KEY (\`folder_id\`) REFERENCES \`documentfolder\` (\`folder_id\`) ON DELETE CASCADE,
          CONSTRAINT \`fk_document_project\` FOREIGN KEY (\`project_id\`) REFERENCES \`project\` (\`project_id\`) ON DELETE CASCADE,
          CONSTRAINT \`fk_document_uploader\` FOREIGN KEY (\`uploaded_by\`) REFERENCES \`user\` (\`user_id\`) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('documentfolder / document tables created successfully.');
    } else {
      // Widen folder_id/document_id columns if they were created by an older version of this app
      const folderCols = await prisma.$queryRaw`SHOW COLUMNS FROM \`documentfolder\` WHERE Field = 'folder_id'`;
      if (folderCols[0] && folderCols[0].Type === 'varchar(36)') {
        console.log('Widening documentfolder/document id columns to varchar(50)...');
        await prisma.$executeRawUnsafe('ALTER TABLE `document` DROP FOREIGN KEY `fk_document_folder`;');
        await prisma.$executeRawUnsafe('ALTER TABLE `documentfolder` DROP FOREIGN KEY `fk_folder_parent`;');
        await prisma.$executeRawUnsafe('ALTER TABLE `documentfolder` MODIFY `folder_id` VARCHAR(50) NOT NULL;');
        await prisma.$executeRawUnsafe('ALTER TABLE `documentfolder` MODIFY `parent_folder_id` VARCHAR(50) DEFAULT NULL;');
        await prisma.$executeRawUnsafe('ALTER TABLE `document` MODIFY `document_id` VARCHAR(50) NOT NULL;');
        await prisma.$executeRawUnsafe('ALTER TABLE `document` MODIFY `folder_id` VARCHAR(50) DEFAULT NULL;');
        await prisma.$executeRawUnsafe('ALTER TABLE `documentfolder` ADD CONSTRAINT `fk_folder_parent` FOREIGN KEY (`parent_folder_id`) REFERENCES `documentfolder` (`folder_id`) ON DELETE CASCADE;');
        await prisma.$executeRawUnsafe('ALTER TABLE `document` ADD CONSTRAINT `fk_document_folder` FOREIGN KEY (`folder_id`) REFERENCES `documentfolder` (`folder_id`) ON DELETE CASCADE;');
        console.log('documentfolder/document id columns widened successfully.');
      }
    }
  } catch (err) {
    console.error('Error during document tables migration check:', err);
  }

  // Self-healing column addition for the in-browser Text Document feature
  try {
    const columns = await prisma.$queryRaw`SHOW COLUMNS FROM \`document\` LIKE 'doc_type'`;
    if (columns.length === 0) {
      console.log('Adding doc_type/updated_at columns to document table...');
      await prisma.$executeRawUnsafe("ALTER TABLE `document` ADD COLUMN `doc_type` VARCHAR(20) NOT NULL DEFAULT 'upload';");
      await prisma.$executeRawUnsafe('ALTER TABLE `document` ADD COLUMN `updated_at` TIMESTAMP NULL DEFAULT NULL;');
      console.log('doc_type/updated_at columns added successfully.');
    }
  } catch (err) {
    console.error('Error during text document columns migration check:', err);
  }

  // Self-healing column addition for hidden departments (e.g. an "Administrator" department)
  try {
    const columns = await prisma.$queryRaw`SHOW COLUMNS FROM \`department\` LIKE 'is_hidden'`;
    if (columns.length === 0) {
      console.log('Adding is_hidden column to department table...');
      await prisma.$executeRawUnsafe('ALTER TABLE `department` ADD COLUMN `is_hidden` TINYINT(1) NOT NULL DEFAULT 0;');
      console.log('is_hidden column added successfully.');
    }
  } catch (err) {
    console.error('Error during department is_hidden migration check:', err);
  }

  // Self-healing column addition for dual Team Leader / additional Part Leader assignment
  try {
    const columns = await prisma.$queryRaw`SHOW COLUMNS FROM \`user\` LIKE 'additional_part_leader_of'`;
    if (columns.length === 0) {
      console.log('Adding additional_part_leader_of column to user table...');
      await prisma.$executeRawUnsafe('ALTER TABLE `user` ADD COLUMN `additional_part_leader_of` VARCHAR(50) NULL;');
      console.log('additional_part_leader_of column added successfully.');
    }
  } catch (err) {
    console.error('Error during additional_part_leader_of migration check:', err);
  }

  // Self-healing table creation for multi-Part additional leadership (a Team Leader
  // can additionally lead any number of Parts, replacing the old single-value
  // user.additional_part_leader_of column which is left in place but unused).
  try {
    const tables = await prisma.$queryRaw`SHOW TABLES LIKE 'partleadership'`;
    if (tables.length === 0) {
      console.log('Creating partleadership table...');
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`partleadership\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`user_id\` VARCHAR(36) NOT NULL,
          \`department_id\` VARCHAR(50) NOT NULL,
          CONSTRAINT \`fk_partleadership_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`user\` (\`user_id\`) ON DELETE CASCADE,
          CONSTRAINT \`fk_partleadership_department\` FOREIGN KEY (\`department_id\`) REFERENCES \`department\` (\`department_id\`) ON DELETE CASCADE,
          UNIQUE KEY \`unique_user_department_leadership\` (\`user_id\`, \`department_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('partleadership table created successfully.');

      // One-time backfill from the old scalar column, if it exists and has data.
      try {
        await prisma.$executeRawUnsafe(`
          INSERT IGNORE INTO \`partleadership\` (\`user_id\`, \`department_id\`)
          SELECT \`user_id\`, \`additional_part_leader_of\` FROM \`user\` WHERE \`additional_part_leader_of\` IS NOT NULL;
        `);
        console.log('Backfilled partleadership from legacy additional_part_leader_of column.');
      } catch (backfillErr) {
        console.error('Skipped partleadership backfill (legacy column may not exist yet):', backfillErr.message);
      }
    }
  } catch (err) {
    console.error('Error during partleadership table migration check:', err);
  }

  // Self-healing column addition for "show once" rejected-report popup tracking
  try {
    const columns = await prisma.$queryRaw`SHOW COLUMNS FROM \`notificyations\` LIKE 'modal_shown'`;
    if (columns.length === 0) {
      console.log('Adding modal_shown column to notificyations table...');
      await prisma.$executeRawUnsafe('ALTER TABLE `notificyations` ADD COLUMN `modal_shown` TINYINT(1) NOT NULL DEFAULT 0;');
      console.log('modal_shown column added successfully.');
    }
  } catch (err) {
    console.error('Error during notificyations modal_shown migration check:', err);
  }

  // Self-healing column addition for tracking who approved/rejected a daily report
  try {
    const columns = await prisma.$queryRaw`SHOW COLUMNS FROM \`dailyreport\` LIKE 'reviewer_id'`;
    if (columns.length === 0) {
      console.log('Adding reviewer_id column to dailyreport table...');
      await prisma.$executeRawUnsafe('ALTER TABLE `dailyreport` ADD COLUMN `reviewer_id` VARCHAR(36) NULL;');
      console.log('reviewer_id column added successfully.');
    }
  } catch (err) {
    console.error('Error during dailyreport reviewer_id migration check:', err);
  }

  // Self-healing column addition for tagging special-purpose document folders
  // (e.g. the auto-provisioned "01.TK Điện" folder that renders a file-slot table)
  try {
    const columns = await prisma.$queryRaw`SHOW COLUMNS FROM \`documentfolder\` LIKE 'folder_type'`;
    if (columns.length === 0) {
      console.log('Adding folder_type column to documentfolder table...');
      await prisma.$executeRawUnsafe('ALTER TABLE `documentfolder` ADD COLUMN `folder_type` VARCHAR(30) NULL;');
      console.log('folder_type column added successfully.');
    }
  } catch (err) {
    console.error('Error during documentfolder folder_type migration check:', err);
  }

  // Self-healing table creation for the Document file-slot table feature
  try {
    const tables = await prisma.$queryRaw`SHOW TABLES LIKE 'documentfileslot'`;
    if (tables.length === 0) {
      console.log('Creating documentfileslot table...');
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`documentfileslot\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`folder_id\` VARCHAR(50) NOT NULL,
          \`row_order\` INT NOT NULL,
          \`prefix\` VARCHAR(150) DEFAULT NULL,
          \`document_id\` VARCHAR(50) DEFAULT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT \`fk_fileslot_folder\` FOREIGN KEY (\`folder_id\`) REFERENCES \`documentfolder\` (\`folder_id\`) ON DELETE CASCADE,
          CONSTRAINT \`fk_fileslot_document\` FOREIGN KEY (\`document_id\`) REFERENCES \`document\` (\`document_id\`) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('documentfileslot table created successfully.');
    }
  } catch (err) {
    console.error('Error during documentfileslot table migration check:', err);
  }

  // Self-healing table creation for the admin-editable default project folder tree
  // template. Seeded once, on first creation only, with exactly the tree that used
  // to be hardcoded in documentController.js's createDefaultProjectFolderTree, so
  // existing deployments see zero behavior change until an admin actually edits it.
  try {
    const tables = await prisma.$queryRaw`SHOW TABLES LIKE 'foldertemplate'`;
    if (tables.length === 0) {
      console.log('Creating foldertemplate / foldertemplateslot tables...');
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`foldertemplate\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`template_folder_id\` VARCHAR(50) NOT NULL UNIQUE,
          \`name\` VARCHAR(255) NOT NULL,
          \`parent_template_folder_id\` VARCHAR(50) DEFAULT NULL,
          \`folder_type\` VARCHAR(30) DEFAULT NULL,
          \`default_prefix\` VARCHAR(150) DEFAULT NULL,
          \`allowed_extensions\` VARCHAR(255) DEFAULT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT \`fk_foldertemplate_parent\` FOREIGN KEY (\`parent_template_folder_id\`) REFERENCES \`foldertemplate\` (\`template_folder_id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`foldertemplateslot\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`template_folder_id\` VARCHAR(50) NOT NULL,
          \`row_order\` INT NOT NULL,
          \`prefix\` VARCHAR(150) NOT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT \`fk_foldertemplateslot_folder\` FOREIGN KEY (\`template_folder_id\`) REFERENCES \`foldertemplate\` (\`template_folder_id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('foldertemplate / foldertemplateslot tables created successfully.');

      try {
        const genId = () => 'ftpl-' + crypto.randomUUID();
        const workshopId = genId();
        const machineId = genId();
        const mechId = genId();
        const electricalId = genId();
        const pgmId = genId();

        await prisma.foldertemplate.create({ data: { template_folder_id: workshopId, name: '<Tên_Xưởng>', parent_template_folder_id: null, folder_type: null } });
        await prisma.foldertemplate.create({ data: { template_folder_id: machineId, name: '<Tên_Máy>', parent_template_folder_id: workshopId, folder_type: null } });
        await prisma.foldertemplate.create({ data: { template_folder_id: mechId, name: '00.TK Cơ Khí', parent_template_folder_id: machineId, folder_type: null } });
        await prisma.foldertemplate.create({ data: { template_folder_id: electricalId, name: '01.TK Điện', parent_template_folder_id: machineId, folder_type: 'file_slot_table' } });
        await prisma.foldertemplate.create({ data: { template_folder_id: pgmId, name: '02.PGM', parent_template_folder_id: machineId, folder_type: null } });

        const prefixes = ['1.[BOM LIST]', '2.[IO MAP]', '3.[LAYOUT DRAW]', '4.[Schematic Diagram]'];
        let rowOrder = 1;
        for (const prefix of prefixes) {
          await prisma.foldertemplateslot.create({ data: { template_folder_id: electricalId, row_order: rowOrder++, prefix } });
        }
        console.log('Seeded default folder tree template successfully.');
      } catch (seedErr) {
        console.error('Error seeding default folder tree template:', seedErr);
      }
    }
  } catch (err) {
    console.error('Error during foldertemplate table migration check:', err);
  }

  // Self-healing column addition for a folder-level required upload-name prefix
  // (applies to every file uploaded into that folder, both on the admin's template
  // and the real per-project folders cloned from it).
  try {
    const templateColumns = await prisma.$queryRaw`SHOW COLUMNS FROM \`foldertemplate\` LIKE 'default_prefix'`;
    if (templateColumns.length === 0) {
      console.log('Adding default_prefix column to foldertemplate table...');
      await prisma.$executeRawUnsafe('ALTER TABLE `foldertemplate` ADD COLUMN `default_prefix` VARCHAR(150) NULL;');
      console.log('default_prefix column added to foldertemplate successfully.');
    }
    const folderColumns = await prisma.$queryRaw`SHOW COLUMNS FROM \`documentfolder\` LIKE 'default_prefix'`;
    if (folderColumns.length === 0) {
      console.log('Adding default_prefix column to documentfolder table...');
      await prisma.$executeRawUnsafe('ALTER TABLE `documentfolder` ADD COLUMN `default_prefix` VARCHAR(150) NULL;');
      console.log('default_prefix column added to documentfolder successfully.');
    }
  } catch (err) {
    console.error('Error during default_prefix migration check:', err);
  }

  // Self-healing column addition for a folder-level allowed-file-extension list
  // (semicolon-separated, e.g. "pdf;xlsx;pptx"), on both the admin's template and
  // the real per-project folders cloned from it.
  try {
    const templateColumns = await prisma.$queryRaw`SHOW COLUMNS FROM \`foldertemplate\` LIKE 'allowed_extensions'`;
    if (templateColumns.length === 0) {
      console.log('Adding allowed_extensions column to foldertemplate table...');
      await prisma.$executeRawUnsafe('ALTER TABLE `foldertemplate` ADD COLUMN `allowed_extensions` VARCHAR(255) NULL;');
      console.log('allowed_extensions column added to foldertemplate successfully.');
    }
    const folderColumns = await prisma.$queryRaw`SHOW COLUMNS FROM \`documentfolder\` LIKE 'allowed_extensions'`;
    if (folderColumns.length === 0) {
      console.log('Adding allowed_extensions column to documentfolder table...');
      await prisma.$executeRawUnsafe('ALTER TABLE `documentfolder` ADD COLUMN `allowed_extensions` VARCHAR(255) NULL;');
      console.log('allowed_extensions column added to documentfolder successfully.');
    }
  } catch (err) {
    console.error('Error during allowed_extensions migration check:', err);
  }

  // Self-healing table creation for the Project Manpower board (HR → "Nhân lực dự án").
  // Its project list is intentionally separate from the `project` table — it is a
  // lightweight, manually curated list used only for the daily headcount board.
  try {
    const tables = await prisma.$queryRaw`SHOW TABLES LIKE 'manpowerproject'`;
    if (tables.length === 0) {
      console.log('Creating manpowerproject / manpowerlocation / manpowerreport tables...');
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`manpowerproject\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`manpower_project_id\` VARCHAR(50) NOT NULL UNIQUE,
          \`name\` VARCHAR(255) NOT NULL,
          \`row_order\` INT NOT NULL DEFAULT 0,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`manpowerlocation\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`manpower_location_id\` VARCHAR(50) NOT NULL UNIQUE,
          \`name\` VARCHAR(255) NOT NULL,
          \`col_order\` INT NOT NULL DEFAULT 0,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`manpowerreport\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`report_date\` VARCHAR(10) NOT NULL UNIQUE,
          \`file_name\` VARCHAR(255) NOT NULL,
          \`file_path\` VARCHAR(500) NOT NULL,
          \`updated_by\` VARCHAR(36) DEFAULT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('manpower tables created successfully.');
    }

    // Seed the work-location columns from the reference layout so the board is usable
    // immediately. Guarded on "no locations yet AND no report ever saved" rather than
    // on "tables were just created": that way a half-applied migration (tables created
    // but the seed loop interrupted part-way) still heals on the next start, while a
    // board already in real use is never silently re-seeded behind the admin's back.
    try {
      const existingCount = await prisma.manpowerlocation.count();
      if (existingCount === 0 && (await prisma.manpowerreport.count()) === 0) {
        const defaultLocations = ['Phú Thọ', 'Hà Nội', 'Hải Phòng', 'Bắc Ninh', 'Thái Nguyên', 'Nghỉ', 'Nghỉ Sinh', 'Hàn Quốc', 'Trung Quốc'];
        let colOrder = 1;
        for (const name of defaultLocations) {
          await prisma.manpowerlocation.create({
            data: { manpower_location_id: 'mloc-' + crypto.randomUUID(), name, col_order: colOrder++ }
          });
        }
        console.log('Seeded default manpower work locations successfully.');
      }
    } catch (seedErr) {
      console.error('Error seeding default manpower locations:', seedErr);
    }
  } catch (err) {
    console.error('Error during manpower tables migration check:', err);
  }

  // Self-healing scope columns for the Project Manpower board: a manpower project and
  // a saved daily board both belong to exactly one Team or Part (department). Existing
  // rows keep department_id = '' meaning "unscoped/legacy" so nothing is reassigned
  // behind the user's back. The report's uniqueness therefore moves from report_date
  // alone to (report_date, department_id) — one board per day *per* Team/Part.
  try {
    const projCols = await prisma.$queryRaw`SHOW COLUMNS FROM \`manpowerproject\` LIKE 'department_id'`;
    if (projCols.length === 0) {
      console.log('Adding department_id column to manpowerproject table...');
      await prisma.$executeRawUnsafe("ALTER TABLE `manpowerproject` ADD COLUMN `department_id` VARCHAR(36) NOT NULL DEFAULT '';");
      await prisma.$executeRawUnsafe('ALTER TABLE `manpowerproject` ADD INDEX `idx_manpowerproject_department` (`department_id`);');
      console.log('manpowerproject.department_id added successfully.');
    }

    const reportCols = await prisma.$queryRaw`SHOW COLUMNS FROM \`manpowerreport\` LIKE 'department_id'`;
    if (reportCols.length === 0) {
      console.log('Adding department_id column to manpowerreport table...');
      await prisma.$executeRawUnsafe("ALTER TABLE `manpowerreport` ADD COLUMN `department_id` VARCHAR(36) NOT NULL DEFAULT '';");
      console.log('manpowerreport.department_id added successfully.');
    }

    // Swap the single-column unique key for the composite one. Checked independently of
    // the column check above so an interrupted run still finishes on the next start.
    const indexes = await prisma.$queryRaw`SHOW INDEX FROM \`manpowerreport\``;
    const hasComposite = indexes.some(i => i.Key_name === 'unique_report_date_department');
    if (!hasComposite) {
      console.log('Replacing manpowerreport unique key with (report_date, department_id)...');
      if (indexes.some(i => i.Key_name === 'report_date')) {
        await prisma.$executeRawUnsafe('ALTER TABLE `manpowerreport` DROP INDEX `report_date`;');
      }
      await prisma.$executeRawUnsafe('ALTER TABLE `manpowerreport` ADD UNIQUE KEY `unique_report_date_department` (`report_date`, `department_id`);');
      console.log('manpowerreport composite unique key created successfully.');
    }
  } catch (err) {
    console.error('Error during manpower department scope migration check:', err);
  }

  // Self-healing table for members added to a manpower cell by hand (they filed no
  // daily report but still count toward that cell's headcount).
  try {
    const tables = await prisma.$queryRaw`SHOW TABLES LIKE 'manpowercellmember'`;
    if (tables.length === 0) {
      console.log('Creating manpowercellmember table...');
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`manpowercellmember\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`report_date\` VARCHAR(10) NOT NULL,
          \`manpower_project_id\` VARCHAR(50) NOT NULL,
          \`manpower_location_id\` VARCHAR(50) NOT NULL,
          \`user_id\` VARCHAR(36) NOT NULL,
          \`added_by\` VARCHAR(36) DEFAULT NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY \`unique_manpower_cell_member\` (\`report_date\`, \`manpower_project_id\`, \`manpower_location_id\`, \`user_id\`),
          KEY \`idx_manpowercellmember_date\` (\`report_date\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('manpowercellmember table created successfully.');
    }
  } catch (err) {
    console.error('Error during manpowercellmember migration check:', err);
  }

  // Manpower projects now belong to a Team, never to an individual Part. Any project
  // still pinned to a Part is lifted to that Part's owning Team so nothing disappears
  // from the board. Idempotent: a project already on a Team is left alone.
  try {
    const tables = await prisma.$queryRaw`SHOW TABLES LIKE 'manpowerproject'`;
    if (tables.length > 0) {
      const departments = await prisma.department.findMany({
        select: { department_id: true, parent_id: true }
      });
      const byId = new Map(departments.map(d => [d.department_id, d]));
      // Depth 0 = root (BOD), depth 1 = Team, depth 2+ = Part.
      const owningTeamOf = (departmentId) => {
        const chain = [];
        let current = byId.get(departmentId);
        const seen = new Set();
        while (current && !seen.has(current.department_id)) {
          seen.add(current.department_id);
          chain.unshift(current.department_id);
          current = current.parent_id ? byId.get(current.parent_id) : null;
        }
        return chain.length >= 2 ? chain[1] : null;
      };

      const projects = await prisma.manpowerproject.findMany({
        select: { id: true, department_id: true }
      });
      let moved = 0;
      for (const project of projects) {
        if (!project.department_id) continue; // legacy unscoped rows stay as they are
        const team = owningTeamOf(project.department_id);
        if (team && team !== project.department_id) {
          await prisma.manpowerproject.update({
            where: { id: project.id },
            data: { department_id: team }
          });
          moved += 1;
        }
      }
      if (moved > 0) {
        console.log(`Moved ${moved} manpower project(s) from a Part up to their Team.`);
      }
    }
  } catch (err) {
    console.error('Error during manpower project Team-scope migration:', err);
  }

  // Self-healing column addition for a user's personal phone number
  try {
    const columns = await prisma.$queryRaw`SHOW COLUMNS FROM \`user\` LIKE 'phone'`;
    if (columns.length === 0) {
      console.log('Adding phone column to user table...');
      await prisma.$executeRawUnsafe('ALTER TABLE `user` ADD COLUMN `phone` VARCHAR(20) NULL;');
      console.log('phone column added successfully.');
    }
  } catch (err) {
    console.error('Error during user phone migration check:', err);
  }

  // Meeting-room bookings used to be kept in each browser's localStorage, which meant a
  // booking was only ever visible to the person who created it. They are a shared resource,
  // so they belong in the database.
  try {
    const tables = await prisma.$queryRaw`SHOW TABLES LIKE 'roombooking'`;
    if (tables.length === 0) {
      console.log('Creating roombooking table...');
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`roombooking\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`booking_id\` VARCHAR(50) NOT NULL UNIQUE,
          \`location\` VARCHAR(20) NOT NULL,
          \`room_id\` VARCHAR(30) NOT NULL,
          \`booking_date\` VARCHAR(10) NOT NULL,
          \`start_time\` VARCHAR(5) NOT NULL,
          \`end_time\` VARCHAR(5) NOT NULL,
          \`team\` VARCHAR(150) NOT NULL,
          \`booker_name\` VARCHAR(150) NOT NULL,
          \`booker_id\` VARCHAR(36) NULL,
          \`purpose\` TEXT NULL,
          \`importance\` VARCHAR(10) NULL,
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX \`idx_roombooking_slot\` (\`location\`, \`room_id\`, \`booking_date\`),
          INDEX \`idx_roombooking_date\` (\`booking_date\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      console.log('roombooking table created.');
    }
  } catch (err) {
    console.error('roombooking migration failed:', err.message);
  }
}

runMigrations();

module.exports = prisma;
