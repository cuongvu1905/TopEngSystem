import fs from 'fs';
import path from 'path';

/**
 * Parses file content based on file extension.
 * Supports PDF, DOCX, XLSX/XLS, CSV, JSON, Markdown, Code, and plain text.
 * 
 * @param {string} filePath - Absolute or relative path to file
 * @returns {Promise<{ success: boolean, text: string, extension: string, metadata: object, error?: string }>}
 */
export async function parseFileContent(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, text: '', error: 'File does not exist' };
    }

    const ext = path.extname(filePath).toLowerCase();
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);

    // Skip very large files (> 20MB) to prevent memory crashes
    if (stats.size > 20 * 1024 * 1024) {
      return {
        success: false,
        text: '',
        extension: ext,
        metadata: { fileName, fileSize: stats.size },
        error: 'File size exceeds 20MB limit'
      };
    }

    // 1. PDF Parser
    if (ext === '.pdf') {
      try {
        const pdfParseModule = await import('pdf-parse');
        const pdfParse = pdfParseModule.default || pdfParseModule;
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        return {
          success: true,
          text: pdfData.text || '',
          extension: ext,
          metadata: {
            fileName,
            fileSize: stats.size,
            numPages: pdfData.numpages,
            info: pdfData.info
          }
        };
      } catch (pdfErr) {
        console.error(`Error parsing PDF ${filePath}:`, pdfErr.message);
        return {
          success: false,
          text: '',
          extension: ext,
          error: `PDF Parse Error: ${pdfErr.message}`
        };
      }
    }

    // 2. Word (.docx) Parser
    if (ext === '.docx') {
      try {
        const mammothModule = await import('mammoth');
        const mammoth = mammothModule.default || mammothModule;
        const result = await mammoth.extractRawText({ path: filePath });
        return {
          success: true,
          text: result.value || '',
          extension: ext,
          metadata: {
            fileName,
            fileSize: stats.size,
            warnings: result.messages
          }
        };
      } catch (docxErr) {
        console.error(`Error parsing DOCX ${filePath}:`, docxErr.message);
        return {
          success: false,
          text: '',
          extension: ext,
          error: `DOCX Parse Error: ${docxErr.message}`
        };
      }
    }

    // 3. Excel (.xlsx, .xls) Parser
    if (ext === '.xlsx' || ext === '.xls') {
      try {
        const xlsxModule = await import('xlsx');
        const XLSX = xlsxModule.default || xlsxModule;
        const workbook = XLSX.readFile(filePath);
        const sheetTexts = [];

        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          if (sheet) {
            const csv = XLSX.utils.sheet_to_csv(sheet);
            if (csv && csv.trim()) {
              sheetTexts.push(`--- [Sheet: ${sheetName}] ---\n${csv.trim()}`);
            }
          }
        });

        return {
          success: true,
          text: sheetTexts.join('\n\n'),
          extension: ext,
          metadata: {
            fileName,
            fileSize: stats.size,
            sheetNames: workbook.SheetNames
          }
        };
      } catch (xlsxErr) {
        console.error(`Error parsing Excel ${filePath}:`, xlsxErr.message);
        return {
          success: false,
          text: '',
          extension: ext,
          error: `Excel Parse Error: ${xlsxErr.message}`
        };
      }
    }

    // 4. Plain Text, Markdown, Code, JSON, CSV, Configs
    const textExtensions = [
      '.txt', '.md', '.markdown', '.json', '.csv', '.tsv',
      '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
      '.py', '.sql', '.html', '.htm', '.css', '.scss', '.less',
      '.xml', '.svg', '.yaml', '.yml', '.env', '.log', '.ini',
      '.conf', '.sh', '.bat', '.ps1', '.cmd'
    ];

    if (textExtensions.includes(ext) || ext === '') {
      try {
        const text = fs.readFileSync(filePath, 'utf-8');
        return {
          success: true,
          text,
          extension: ext || '.txt',
          metadata: {
            fileName,
            fileSize: stats.size
          }
        };
      } catch (textErr) {
        return {
          success: false,
          text: '',
          extension: ext,
          error: `Text Read Error: ${textErr.message}`
        };
      }
    }

    // Unsupported binary files (images, audio, video, zip, exe, etc.)
    return {
      success: false,
      text: '',
      extension: ext,
      metadata: { fileName, fileSize: stats.size },
      error: `Unsupported file format '${ext}'`
    };

  } catch (err) {
    return {
      success: false,
      text: '',
      error: `General Parse Error: ${err.message}`
    };
  }
}
