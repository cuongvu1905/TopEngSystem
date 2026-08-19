// Tab-separated clipboard format, the dialect Excel actually uses when copying and
// pasting a block of cells. A field containing a tab, newline or double quote is wrapped
// in double quotes with inner quotes doubled — needed here because the manpower board's
// "Chi tiết công việc của dự án" cells hold free, multi-line text.

export function escapeTsvCell(value) {
  const text = String(value ?? '');
  if (/[\t\n\r"]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

// Excel expects CRLF between rows on paste, and emits CRLF when copying.
export function toTsv(matrix) {
  return matrix.map(row => row.map(escapeTsvCell).join('\t')).join('\r\n');
}

export function parseTsv(text) {
  const src = String(text ?? '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      field += ch; i += 1; continue;
    }

    // A quote only opens a quoted field at the very start of that field.
    if (ch === '"' && field === '') { inQuotes = true; i += 1; continue; }

    if (ch === '\t') { row.push(field); field = ''; i += 1; continue; }

    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field); field = ''; rows.push(row); row = []; i += 1; continue;
    }

    field += ch; i += 1;
  }

  row.push(field);
  rows.push(row);

  // A trailing newline yields one bogus empty row; drop it (but never the only row).
  while (rows.length > 1) {
    const last = rows[rows.length - 1];
    if (last.length === 1 && last[0] === '') rows.pop();
    else break;
  }

  return rows;
}
