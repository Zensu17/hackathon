function escapePdfText(input: string): string {
  return input
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) {
    lines.push(current);
  }
  return lines;
}

// Build a valid minimal single-page PDF 1.4 document for offline demo handouts in local fallback mode.
export function buildSampleStudyPdf(params: {
  title: string;
  courseLabel: string;
  fileName: string;
  summary: string;
}): Uint8Array {
  const lines: string[] = [
    'LiteLearn Offline Study Handout (Local Demo Sample)',
    '----------------------------------------------------------------',
    `Course: ${params.courseLabel}`,
    `File: ${params.fileName}`,
    '',
    ...wrapText(params.title, 72),
    '',
    'Summary:',
    ...wrapText(
      params.summary || 'Offline study notes stored locally in IndexedDB.',
      76,
    ),
    '',
    'Verification Note:',
    'This PDF was saved locally inside your browser IndexedDB blob store.',
    'You can reopen this document with airplane mode turned on.',
  ];

  const textOps = [
    'BT',
    '/F1 12 Tf',
    '54 756 Td',
    '18 TL',
    ...lines.map((line, index) =>
      index === 0
        ? `(${escapePdfText(line)}) Tj`
        : `T* (${escapePdfText(line)}) Tj`,
    ),
    'ET',
  ].join('\n');

  const encoder = new TextEncoder();
  const streamBytes = encoder.encode(textOps);

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${streamBytes.byteLength} >>\nstream\n${textOps}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(encoder.encode(pdf).byteLength);
    pdf += obj;
  }

  const xrefOffset = encoder.encode(pdf).byteLength;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return encoder.encode(pdf);
}
