import { NextResponse } from 'next/server';
import { scanAndIndexFolder, getIndexedFolderData, getAllIndexedFolders } from '@/utils/folderIndexer';
import { retrieveRelevantChunks } from '@/utils/ragRetriever';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const folderPath = searchParams.get('folderPath');

    if (folderPath) {
      const data = getIndexedFolderData(folderPath);
      if (!data) {
        return NextResponse.json({ success: false, error: 'Folder not indexed yet' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data });
    }

    const all = getAllIndexedFolders();
    return NextResponse.json({ success: true, data: all });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, folderPath, forceReindex, query, topK } = body;

    // Action 1: Search chunks
    if (action === 'search') {
      if (!query) {
        return NextResponse.json({ success: false, error: 'Query is required' }, { status: 400 });
      }

      let targetPath = folderPath;
      if (!targetPath) {
        const all = getAllIndexedFolders();
        if (all.length > 0) targetPath = all[0].folderPath;
      }

      if (!targetPath) {
        return NextResponse.json({ success: false, error: 'No indexed folder available' }, { status: 400 });
      }

      const indexData = getIndexedFolderData(targetPath);
      if (!indexData || !indexData.chunks) {
        return NextResponse.json({ success: false, error: 'Folder not indexed' }, { status: 404 });
      }

      const relevantChunks = retrieveRelevantChunks(query, indexData.chunks, topK || 5);
      return NextResponse.json({
        success: true,
        folderPath: targetPath,
        query,
        count: relevantChunks.length,
        results: relevantChunks
      });
    }

    // Action 2: Scan and Index Folder
    if (!folderPath) {
      return NextResponse.json({ success: false, error: 'folderPath is required' }, { status: 400 });
    }

    const result = await scanAndIndexFolder(folderPath, !!forceReindex);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Đã quét và lập chỉ mục thành công ${result.parsedFiles} tài liệu.`,
      data: {
        folderPath: result.folderPath,
        totalFiles: result.totalFilesFound,
        parsedFiles: result.parsedFiles,
        totalChunks: result.totalChunks,
        fileSummaries: result.fileSummaries
      }
    });
  } catch (error) {
    console.error('Folder indexer API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
