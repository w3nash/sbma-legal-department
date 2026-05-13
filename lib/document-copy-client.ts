export type DocumentCopyIntent = "download" | "print";

type PerformDocumentCopyActionOptions = {
  intent: DocumentCopyIntent;
  documentId: string;
  filename: string;
  refresh: () => void;
  fetchImpl?: typeof fetch;
  downloadBlob?: (blob: Blob, filename: string) => void | Promise<void>;
  printBlob?: (blob: Blob, filename: string) => void | Promise<void>;
};

export async function performDocumentCopyAction({
  intent,
  documentId,
  filename,
  refresh,
  fetchImpl = fetch,
  downloadBlob = downloadBlobToBrowser,
  printBlob = printBlobToBrowser,
}: PerformDocumentCopyActionOptions): Promise<void> {
  const response = await fetchImpl(
    `/api/documents/${documentId}/download?intent=${intent}`
  );

  if (!response.ok) {
    let message = `Unable to ${intent} this document right now.`;

    try {
      const data = (await response.json()) as { message?: string };
      if (typeof data.message === "string" && data.message.length > 0) {
        message = data.message;
      }
    } catch {}

    throw new Error(message);
  }

  const blob = await response.blob();

  if (intent === "print") {
    await printBlob(blob, filename);
  } else {
    await downloadBlob(blob, filename);
  }

  refresh();
}

function downloadBlobToBrowser(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}

function printBlobToBrowser(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.title = `print-${filename}`;
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";

  const cleanup = () => {
    setTimeout(() => {
      iframe.remove();
      URL.revokeObjectURL(objectUrl);
    }, 1000);
  };

  iframe.onload = () => {
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) {
      cleanup();
      return;
    }

    frameWindow.focus();
    frameWindow.print();
    cleanup();
  };

  iframe.src = objectUrl;
  document.body.appendChild(iframe);
}
