// RFC 4180 records: quoted separators, escaped quotes and embedded newlines.
export function readCsvRecords(input: string): string[][] {
  if (new TextEncoder().encode(input).length > 2 * 1024 * 1024) throw new Error('business:provider_csv_size_error');
  const text = input.replace(/^\uFEFF/, '');
  const header = text.split(/\r?\n/, 1)[0];
  const delimiter = header.includes(';') && !header.includes(',') ? ';' : ',';
  const records: string[][] = [];
  let row: string[] = [], value = '', quoted = false, closed = false, wasQuoted = false;
  const field = () => { row.push(wasQuoted ? value : value.trim()); value = ''; wasQuoted = false; closed = false; };
  const record = () => { field(); if (row.some((cell) => cell !== '')) records.push(row); row = []; };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { value += '"'; index++; }
        else { quoted = false; closed = true; }
      } else value += char;
    } else if (char === delimiter) field();
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      record();
    } else if (char === '"' && !value.trim() && !closed) { quoted = true; wasQuoted = true; value = ''; }
    else if (char === '"' || (closed && char.trim())) throw new Error('business:provider_csv_format_error');
    else if (!closed) value += char;
  }
  if (quoted) throw new Error('business:provider_csv_format_error');
  if (value || row.length || closed) record();
  if (records.length > 1001) throw new Error('business:provider_csv_size_error');
  return records;
}
