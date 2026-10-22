// Shared by build-time authoring checks; never imports Nest, DB or provider clients.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

function parseStrictJson(raw) {
  assert(Buffer.byteLength(raw, 'utf8') <= 1048576, 'json_too_large');
  try { JSON.parse(raw); } catch { throw new Error('invalid_json'); }
  const tokens = raw.match(/"(?:\\[\s\S]|[^"\\])*"|[{}:,]|\[|\]|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g) ?? [];
  assert(tokens.length <= 131072, 'json_too_many_tokens');
  let cursor = 0;
  function value(depth) {
    assert(depth <= 32, 'json_too_deep');
    const token = tokens[cursor++];
    if (token === '{') {
      const entries = [], seen = new Set();
      while (tokens[cursor] !== '}') {
        const key = JSON.parse(tokens[cursor++]);
        assert(!seen.has(key), 'duplicate_json_key'); seen.add(key);
        assert(tokens[cursor++] === ':', 'invalid_json_member');
        entries.push([key, value(depth + 1)]);
        if (tokens[cursor] !== ',') break;
        cursor++;
      }
      assert(tokens[cursor++] === '}', 'invalid_json_object');
      return Object.fromEntries(entries);
    }
    if (token === '[') {
      const items = [];
      while (tokens[cursor] !== ']') {
        items.push(value(depth + 1));
        if (tokens[cursor] !== ',') break;
        cursor++;
      }
      assert(tokens[cursor++] === ']', 'invalid_json_array'); return items;
    }
    const parsed = JSON.parse(token);
    if (typeof parsed === 'number') assert(Number.isSafeInteger(parsed), 'unsafe_json_number');
    return parsed;
  }
  const result = value(0);
  assert(cursor === tokens.length, 'trailing_json_tokens'); return result;
}

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort()
    .map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

function parseDocument(raw) {
  assert(Buffer.byteLength(raw, 'utf8') <= 262144, 'document_too_large');
  assert(!raw.startsWith('\uFEFF'), 'document_bom');
  const normalized = raw.replaceAll('\r\n', '\n');
  const match = /^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/.exec(normalized);
  assert(match, 'json_frontmatter_required');
  const metadata = parseStrictJson(match[1]);
  assert(!/^\| (?:Metadato|Identidad documental|Estado documental|Revisión documental) \|/m.test(match[2]), 'duplicate_authoring_metadata');
  assert(/^# \S/m.test(match[2]), 'document_title_required');
  return { metadata, body: match[2] };
}
function contentHash(metadata, body) {
  const { approval: _approval, ...contentMetadata } = metadata;
  return sha256(canonical(contentMetadata) + '\n' + body.replaceAll('\r\n', '\n'));
}
function serializeDocument(metadata, body) {
  return '---\n' + JSON.stringify(metadata, null, 2) + '\n---\n\n' + body;
}

module.exports = { parseStrictJson, canonical, sha256, parseDocument, contentHash, serializeDocument };
