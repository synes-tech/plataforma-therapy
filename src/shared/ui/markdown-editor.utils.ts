export interface TextAreaEditResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export function applyTextAreaEdit(
  currentValue: string,
  selectionStart: number,
  selectionEnd: number,
  insert: string,
  replaceSelection = true,
): TextAreaEditResult {
  const start = Math.max(0, selectionStart);
  const end = Math.max(start, selectionEnd);

  if (replaceSelection) {
    const value = currentValue.slice(0, start) + insert + currentValue.slice(end);
    const cursor = start + insert.length;
    return { value, selectionStart: cursor, selectionEnd: cursor };
  }

  const value = currentValue.slice(0, start) + insert + currentValue.slice(start);
  const cursor = start + insert.length;
  return { value, selectionStart: cursor, selectionEnd: cursor };
}

export function wrapTextAreaSelection(
  currentValue: string,
  selectionStart: number,
  selectionEnd: number,
  before: string,
  after: string = before,
): TextAreaEditResult {
  const start = Math.max(0, selectionStart);
  const end = Math.max(start, selectionEnd);
  const selected = currentValue.slice(start, end);
  const insert = `${before}${selected || 'texto'}${after}`;
  return applyTextAreaEdit(currentValue, start, end, insert);
}

export function prefixTextAreaLines(
  currentValue: string,
  selectionStart: number,
  selectionEnd: number,
  linePrefix: string,
): TextAreaEditResult {
  const start = Math.max(0, selectionStart);
  const end = Math.max(start, selectionEnd);
  const blockStart = currentValue.lastIndexOf('\n', start - 1) + 1;
  const blockEnd = currentValue.indexOf('\n', end);
  const sliceEnd = blockEnd === -1 ? currentValue.length : blockEnd;
  const block = currentValue.slice(blockStart, sliceEnd);

  const prefixed = block
    .split('\n')
    .map((line) => (line.trim() ? `${linePrefix}${line.replace(/^[-*•]\s+|^\d+\.\s+/, '')}` : line))
    .join('\n');

  const value = currentValue.slice(0, blockStart) + prefixed + currentValue.slice(sliceEnd);
  return {
    value,
    selectionStart: blockStart,
    selectionEnd: blockStart + prefixed.length,
  };
}

export function insertHeadingLine(
  currentValue: string,
  selectionStart: number,
  selectionEnd: number,
  level: 1 | 2 | 3,
): TextAreaEditResult {
  const hashes = '#'.repeat(level);
  return prefixTextAreaLines(currentValue, selectionStart, selectionEnd, `${hashes} `);
}
