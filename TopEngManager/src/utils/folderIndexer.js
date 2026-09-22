import fs from 'fs';
import path from 'path';
import { parseFileContent } from './documentParsers.js';

const IGNORED_DIRS = new Set([
  '.git',
  '.github',
  '.next',
  'node_modules',
  'dist',
  'build',
  '.vscode',
  '.idea',
  '.cache',
  'coverage',
  '.gemini',
  '.claude',
  '.codegraph'
]);

const IGNORED_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib', '.bin', '.iso',
  '.zip', '.tar', '.gz', '.7z', '.rar',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp',
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv',
  '.woff', '.woff2', '.ttf', '.eot',
  '.class', '.pyc', '.o', '.obj'
]);

/**
 * Splits document text into overlapping semantic chunks
 */
export function chunkText(text, metadata = {}, maxChunkWords = 500, overlapWords = 80) {
  if (!text || typeof text !== 'string') return [];

  // Normalize newlines
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  // Split by paragraphs first, or by words
  const paragraphs = normalized.split(/\n{2,}/);
  const chunks = [];
  let currentWords = [];
  let chunkIdx = 0;

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    if (currentWords.length + words.length > maxChunkWords) {
      if (currentWords.length > 0) {
        chunks.push({
          id: `${metadata.fileName || 'doc'}_chunk_${chunkIdx++}`,
          filePath: metadata.filePath || '',
          fileName: metadata.fileName || '',
          extension: metadata.extension || '',
          chunkIndex: chunkIdx,
          content: currentWords.join(' '),
          wordCount: currentWords.length
        });

        // Keep overlap words for context continuity
        currentWords = currentWords.slice(Math.max(0, currentWords.length - overlapWords));
      }
    }

    // If a single paragraph is very long, break it up
    if (words.length > maxChunkWords) {
      for (let i = 0; i < words.length; i += (maxChunkWords - overlapWords)) {
        const slice = words.slice(i, i + maxChunkWords);
        chunks.push({
          id: `${metadata.fileName || 'doc'}_chunk_${chunkIdx++}`,
          filePath: metadata.filePath || '',
          fileName: metadata.fileName || '',
          extension: metadata.extension || '',
          chunkIndex: chunkIdx,
          content: slice.join(' '),
          wordCount: slice.length
        });
      }
      currentWords = [];
    } else {
      currentWords.push(...words);
    }
  }

  if (currentWords.length > 0) {
    chunks.push({
      id: `${metadata.fileName || 'doc'}_chunk_${chunkIdx++}`,
      filePath: metadata.filePath || '',
      fileName: metadata.fileName || '',
      extension: metadata.extension || '',
      chunkIndex: chunkIdx,
      content: currentWords.join(' '),
      wordCount: currentWords.length
    });
  }

  return chunks;
}

/**
 * Recursively scans directory and extracts all supported files
 */
function getAllFilesRecursive(dirPath, maxDepth = 8, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];
  if (!fs.existsSync(dirPath)) return [];

  const results = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          results.push(...getAllFilesRecursive(fullPath, maxDepth, currentDepth + 1));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!IGNORED_EXTENSIONS.has(ext) && !entry.name.startsWith('~$')) {
          results.push(fullPath);
        }
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dirPath}:`, err.message);
  }

  return results;
}

// In-memory cache for indexed folders
const INDEX_CACHE = new Map();

/**
 * Scans, parses, chunks, and indexes a folder for DeepSeek RAG
 */
export async function scanAndIndexFolder(folderPath, forceReindex = false) {
  try {
    const resolvedPath = path.resolve(folderPath);

    if (!fs.existsSync(resolvedPath)) {
      return {
        success: false,
        error: `Thư mục không tồn tại: ${folderPath}`
      };
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      return {
        success: false,
        error: `Đường dẫn không phải là thư mục: ${folderPath}`
      };
    }

    // Check memory cache
    if (!forceReindex && INDEX_CACHE.has(resolvedPath)) {
      const cached = INDEX_CACHE.get(resolvedPath);
      // Return cached index if under 5 minutes old
      if (Date.now() - cached.lastIndexedAt < 5 * 60 * 1000) {
        return {
          success: true,
          fromCache: true,
          ...cached
        };
      }
    }

    const filePaths = getAllFilesRecursive(resolvedPath);
    const fileSummaries = [];
    const allChunks = [];
    let parsedCount = 0;
    let failedCount = 0;

    for (const filePath of filePaths) {
      const fileName = path.basename(filePath);
      const ext = path.extname(filePath).toLowerCase();

      try {
        const parseResult = await parseFileContent(filePath);
        if (parseResult.success && parseResult.text && parseResult.text.trim().length > 0) {
          const docMetadata = {
            filePath,
            fileName,
            extension: ext,
            relativeFilePath: path.relative(resolvedPath, filePath),
            fileSize: parseResult.metadata?.fileSize || 0
          };

          const chunks = chunkText(parseResult.text, docMetadata);
          allChunks.push(...chunks);

          fileSummaries.push({
            fileName,
            relativePath: docMetadata.relativeFilePath,
            fullPath: filePath,
            extension: ext,
            chunksCount: chunks.length,
            characterCount: parseResult.text.length,
            status: 'success'
          });
          parsedCount++;
        } else {
          fileSummaries.push({
            fileName,
            relativePath: path.relative(resolvedPath, filePath),
            fullPath: filePath,
            extension: ext,
            chunksCount: 0,
            status: 'skipped_or_empty',
            reason: parseResult.error || 'Empty content'
          });
          failedCount++;
        }
      } catch (fileErr) {
        fileSummaries.push({
          fileName,
          relativePath: path.relative(resolvedPath, filePath),
          fullPath: filePath,
          extension: ext,
          chunksCount: 0,
          status: 'error',
          reason: fileErr.message
        });
        failedCount++;
      }
    }

    const indexData = {
      folderPath: resolvedPath,
      totalFilesFound: filePaths.length,
      parsedFiles: parsedCount,
      skippedOrFailedFiles: failedCount,
      totalChunks: allChunks.length,
      fileSummaries,
      chunks: allChunks,
      lastIndexedAt: Date.now()
    };

    INDEX_CACHE.set(resolvedPath, indexData);

    return {
      success: true,
      fromCache: false,
      ...indexData
    };
  } catch (err) {
    return {
      success: false,
      error: `Lỗi quét thư mục: ${err.message}`
    };
  }
}

/**
 * Returns currently indexed folder data from cache
 */
export function getIndexedFolderData(folderPath) {
  const resolvedPath = path.resolve(folderPath);
  return INDEX_CACHE.get(resolvedPath) || null;
}

/**
 * Returns all currently indexed folders
 */
export function getAllIndexedFolders() {
  const list = [];
  INDEX_CACHE.forEach((val, key) => {
    list.push({
      folderPath: key,
      totalFiles: val.totalFilesFound,
      parsedFiles: val.parsedFiles,
      totalChunks: val.totalChunks,
      lastIndexedAt: val.lastIndexedAt
    });
  });
  return list;
}
