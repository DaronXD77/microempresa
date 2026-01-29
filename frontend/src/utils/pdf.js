const isMobileLike = () => {
  if (typeof window === "undefined") return false;
  if (window.Capacitor) return true;
  const ua = navigator.userAgent || "";
  return /android|iphone|ipad|ipod/i.test(ua);
};

const ensurePdfJs = async () => {
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  if (!window.pdfjsLib) {
    throw new Error("pdfjs no disponible");
  }
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  return window.pdfjsLib;
};

const cleanupModal = (modal) => {
  if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
};

const openPdfModal = async (data, title, onDownload) => {
  const existing = document.getElementById("pdf-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "pdf-modal";
  modal.style.position = "fixed";
  modal.style.inset = "0";
  modal.style.background = "rgba(15, 23, 42, 0.6)";
  modal.style.zIndex = "3000";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.padding = "16px";

  const card = document.createElement("div");
  card.style.width = "min(900px, 96vw)";
  card.style.maxHeight = "85vh";
  card.style.background = "#fff";
  card.style.borderRadius = "16px";
  card.style.padding = "14px";
  card.style.display = "grid";
  card.style.gap = "10px";
  card.style.position = "relative";
  card.style.boxShadow = "0 20px 46px rgba(0,0,0,0.22)";
  card.style.overflow = "auto";

  const titleEl = document.createElement("div");
  titleEl.textContent = title || "Reporte";
  titleEl.style.fontWeight = "700";
  titleEl.style.color = "#111827";

  const close = document.createElement("button");
  close.textContent = "×";
  close.setAttribute("aria-label", "Cerrar");
  close.style.width = "34px";
  close.style.height = "34px";
  close.style.borderRadius = "999px";
  close.style.border = "1px solid #d0d7de";
  close.style.background = "#fff";
  close.style.fontSize = "20px";
  close.style.cursor = "pointer";
  close.onclick = () => cleanupModal(modal);

  const download = document.createElement("button");
  download.textContent = "Descargar";
  download.style.border = "1px solid #111827";
  download.style.background = "#111827";
  download.style.color = "#fff";
  download.style.borderRadius = "10px";
  download.style.padding = "8px 14px";
  download.style.fontWeight = "600";
  download.style.cursor = "pointer";
  download.onclick = async () => {
    if (typeof onDownload === "function") {
      await onDownload();
    }
  };

  const fallback = document.createElement("div");
  fallback.textContent = "No se pudo mostrar el PDF.";
  fallback.style.fontSize = "13px";
  fallback.style.color = "#4b5563";
  fallback.style.textAlign = "center";
  fallback.style.padding = "8px 0";
  fallback.style.display = "none";

  const pagesWrap = document.createElement("div");
  pagesWrap.style.display = "grid";
  pagesWrap.style.gap = "12px";

  const loading = document.createElement("div");
  loading.textContent = "Cargando PDF...";
  loading.style.fontSize = "13px";
  loading.style.color = "#4b5563";

  modal.onclick = () => cleanupModal(modal);
  card.onclick = (e) => e.stopPropagation();

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.gap = "10px";
  header.appendChild(titleEl);
  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "8px";
  actions.appendChild(download);
  actions.appendChild(close);
  header.appendChild(actions);
  card.appendChild(header);
  card.appendChild(loading);
  card.appendChild(pagesWrap);
  card.appendChild(fallback);
  modal.appendChild(card);
  document.body.appendChild(modal);

  try {
    const pdfjsLib = await ensurePdfJs();
    const pdf = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;
    loading.remove();
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.25 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = "100%";
      canvas.style.borderRadius = "12px";
      canvas.style.border = "1px solid #e5e7eb";
      await page.render({ canvasContext: context, viewport }).promise;
      pagesWrap.appendChild(canvas);
    }
  } catch (err) {
    loading.remove();
    fallback.style.display = "block";
  }
};

const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const downloadBrowser = (buffer, filename) => {
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const openPdf = async (doc, filename) => {
  const safeName = filename || "reporte.pdf";
  const data = doc.output("arraybuffer");

  const handleDownload = async () => {
    if (typeof window !== "undefined" && window.Capacitor) {
      try {
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const base64 = arrayBufferToBase64(data);
        await Filesystem.writeFile({
          path: safeName,
          data: base64,
          directory: Directory.Downloads,
          recursive: true,
        });
      } catch (e) {
        downloadBrowser(data, safeName);
      }
      return;
    }
    downloadBrowser(data, safeName);
  };

  await openPdfModal(data, safeName, handleDownload);
};
