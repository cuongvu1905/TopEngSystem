exports.getDocumentCategories = async (req, res, next) => {
  try {
    // Document categories table is deleted, return empty array to prevent crashes
    res.json([]);
  } catch (err) {
    next(err);
  }
};

exports.getDocuments = async (req, res, next) => {
  try {
    // Documents table is deleted, return empty array to prevent crashes
    res.json([]);
  } catch (err) {
    next(err);
  }
};

exports.getDocumentVersions = async (req, res, next) => {
  try {
    // Document versions table is deleted, return empty array to prevent crashes
    res.json([]);
  } catch (err) {
    next(err);
  }
};

exports.saveDocument = async (req, res, next) => {
  try {
    // Documents table is deleted, mock success save response
    const { doc } = req.body;
    res.json({
      id: doc.id || 'doc-' + Date.now(),
      project_id: doc.project_id,
      title: doc.title,
      category_id: doc.category_id,
      uploaded_by: doc.uploaded_by,
      project_phase: doc.project_phase || null,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
};
