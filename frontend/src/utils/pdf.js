const isMobileLike = () => {
  if (typeof window === "undefined") return false;
  if (window.Capacitor) return true;
  const ua = navigator.userAgent || "";
  return /android|iphone|ipad|ipod/i.test(ua);
};

const cleanupModal = (modal) => {
  if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
};

const openPdfModal = async (data, title) => {
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
  close.style.position = "absolute";
  close.style.top = "10px";
  close.style.right = "10px";
  close.style.width = "34px";
  close.style.height = "34px";
  close.style.borderRadius = "999px";
  close.style.border = "1px solid #d0d7de";
  close.style.background = "#fff";
  close.style.fontSize = "20px";
  close.style.cursor = "pointer";
  close.onclick = () => cleanupModal(modal);

  const pagesWrap = document.createElement("div");
  pagesWrap.style.display = "grid";
  pagesWrap.style.gap = "12px";

  const loading = document.createElement("div");
  loading.textContent = "Cargando PDF...";
  loading.style.fontSize = "13px";
  loading.style.color = "#4b5563";

  modal.onclick = () => cleanupModal(modal);
  card.onclick = (e) => e.stopPropagation();

  card.appendChild(titleEl);
  card.appendChild(close);
  card.appendChild(loading);
  card.appendChild(pagesWrap);
  modal.appendChild(card);
  document.body.appendChild(modal);

  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf");
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
    loading.textContent = "No se pudo mostrar el PDF.";
  }
};

export const openPdf = async (doc, filename) => {
  try {
    if (isMobileLike()) {
      const data = doc.output("arraybuffer");
      await openPdfModal(data, filename || "Reporte");
      return;
    }
  } catch (e) {
    // fallback to download
  }
  doc.save(filename);
};
