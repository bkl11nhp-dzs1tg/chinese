// Bộ đọc CSV nhỏ (RFC 4180): hỗ trợ dấu ngoặc kép, dấu phẩy và xuống dòng trong ô, BOM, CRLF.

/** Trả về mảng các dòng; mỗi dòng là mảng ô (chuỗi). Kèm số dòng gốc (1-based). */
export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let rowLine = 1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\r') { /* bỏ qua, xử lý ở \n */ }
    else if (ch === '\n') {
      row.push(field);
      rows.push({ line: rowLine, cells: row });
      row = []; field = ''; line++; rowLine = line;
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push({ line: rowLine, cells: row });
  }
  return rows;
}

/** Ghi một ô CSV, thêm ngoặc kép khi cần. */
export function csvCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header, records) {
  const lines = [header.join(',')];
  for (const r of records) lines.push(header.map((k) => csvCell(Array.isArray(r[k]) ? r[k].join(';') : r[k])).join(','));
  return lines.join('\n') + '\n';
}
