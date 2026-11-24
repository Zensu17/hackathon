// Open an offline PDF blob safely: always pin MIME type to application/pdf so untrusted content cannot execute in-origin.
export function openOfflinePdfBlob(bytes: Uint8Array, fileName: string): void {
  const bytesCopy = new Uint8Array(bytes.byteLength);
  bytesCopy.set(bytes);
  const pdfBlob = new Blob([bytesCopy], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(pdfBlob);

  // Avoid passing 'noopener,noreferrer' in windowFeatures since HTML spec makes window.open return null and triggers a duplicate download.
  const win = window.open(blobUrl, '_blank');
  if (win) {
    win.opener = null;
  } else {
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = fileName.toLowerCase().endsWith('.pdf')
      ? fileName
      : `${fileName}.pdf`;
    anchor.click();
  }

  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
