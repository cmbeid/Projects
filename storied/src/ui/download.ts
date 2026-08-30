/** Saves `content` as a file via a synthetic `<a download>` click — the ordinary, unblocked way to do this in a built app served like any other page. */
export function downloadFile(filename: string, content: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // A moment for the browser to pick the download up before the URL goes away.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
