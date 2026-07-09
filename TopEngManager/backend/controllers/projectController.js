const { query } = require('../config/db');

exports.getProjects = async (req, res, next) => {
  try {
    const projects = await query(`
      SELECT project_id as id, project_name as name, project_description as description, 
             project_key, 'Thực thi' as status, '2026-06-01' as start_date, '2026-12-31' as end_date, 
             create_by, 1 as is_public 
      FROM Project
    `);
    res.json(projects.map(p => ({
      ...p,
      project_key: p.project_key || p.id.split('-').pop().toUpperCase().slice(0, 5),
      is_public: !!p.is_public
    })));
  } catch (err) {
    next(err);
  }
};

exports.getProjectMembers = async (req, res, next) => {
  try {
    const members = await query('SELECT id, project_id, userId as user_id, role as project_role FROM ProjectMember');
    res.json(members);
  } catch (err) {
    next(err);
  }
};

exports.saveProject = async (req, res, next) => {
  try {
    const { proj, membersList } = req.body;
    const isNew = !proj.id;
    const id = proj.id || 'proj-' + Date.now();

    if (isNew) {
      // Derive a unique key from the project name
      let projectKey = proj.name
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, '')
        .split(/\s+/)
        .map(w => w.charAt(0))
        .join('')
        .slice(0, 5);
      
      if (!projectKey || projectKey.length === 0) {
        projectKey = 'PRJ';
      }

      // Check unique
      const existing = await query('SELECT project_id FROM Project WHERE project_key = ?', [projectKey]);
      if (existing.length > 0) {
        projectKey = `${projectKey}${Date.now().toString().slice(-2)}`;
      }

      await query(
        'INSERT INTO Project (project_id, project_name, project_description, project_key, create_by) VALUES (?, ?, ?, ?, ?)',
        [id, proj.name, proj.description, projectKey, proj.create_by || null]
      );
    } else {
      await query(
        'UPDATE Project SET project_name = ?, project_description = ? WHERE project_id = ?',
        [proj.name, proj.description, id]
      );
    }

    // Sync project members
    if (membersList && membersList.length > 0) {
      await query('DELETE FROM ProjectMember WHERE project_id = ?', [id]);
      for (const m of membersList) {
        await query(
          'INSERT INTO ProjectMember (project_id, userId, role) VALUES (?, ?, ?)',
          [id, m.user_id, m.project_role]
        );
      }
    }

    const saved = await query('SELECT project_id as id, project_name as name, project_description as description, project_key, create_by FROM Project WHERE project_id = ?', [id]);
    res.json({
      ...saved[0],
      project_key: saved[0].project_key || 'PRJ',
      status: proj.status || 'Thực thi',
      start_date: proj.start_date || '2026-06-01',
      end_date: proj.end_date || '2026-12-31',
      is_public: !!proj.is_public
    });
  } catch (err) {
    next(err);
  }
};

exports.addProjectMember = async (req, res, next) => {
  try {
    const { projectId, userId, projectRole } = req.body;
    await query('DELETE FROM ProjectMember WHERE project_id = ? AND userId = ?', [projectId, userId]);
    await query(
      'INSERT INTO ProjectMember (project_id, userId, role) VALUES (?, ?, ?)',
      [projectId, userId, projectRole]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.removeProjectMember = async (req, res, next) => {
  try {
    const { projectId, userId } = req.body;
    await query('DELETE FROM ProjectMember WHERE project_id = ? AND userId = ?', [projectId, userId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.getCustomers = async (req, res, next) => {
  try {
    const customers = await query('SELECT * FROM Customer ORDER BY customer_name ASC');
    res.json(customers);
  } catch (err) {
    next(err);
  }
};

exports.getDepartments = async (req, res, next) => {
  try {
    const depts = await query('SELECT * FROM Department ORDER BY name ASC');
    res.json(depts);
  } catch (err) {
    next(err);
  }
};
