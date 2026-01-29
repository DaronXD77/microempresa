const isMobileLike = () => {
  if (typeof window === "undefined") return false;
  if (window.Capacitor) return true;
  const ua = navigator.userAgent || "";
  return /android|iphone|ipad|ipod/i.test(ua);
};

const cleanupModal = (modal, url) => {
  try {
    if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
};

const openPdfModal = (src, title, revokeUrl = null) => {
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
  card.style.width = "min(720px, 94vw)";
  card.style.maxHeight = "80vh";
  card.style.background = "#fff";
  card.style.borderRadius = "16px";
  card.style.padding = "14px";
  card.style.display = "grid";
  card.style.gap = "10px";
  card.style.position = "relative";
  card.style.boxShadow = "0 20px 46px rgba(0,0,0,0.22)";

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
  close.onclick = () => cleanupModal(modal, revokeUrl);

  const frame = document.createElement("iframe");
  frame.src = src;
  frame.title = title || "Reporte";
  frame.style.width = "100%";
  frame.style.height = "70vh";
  frame.style.border = "0";
  frame.style.borderRadius = "12px";

  modal.onclick = () => cleanupModal(modal, revokeUrl);
  card.onclick = (e) => e.stopPropagation();

  card.appendChild(titleEl);
  card.appendChild(close);
  card.appendChild(frame);
  modal.appendChild(card);
  document.body.appendChild(modal);
};

export const openPdf = (doc, filename) => {
  try {
    if (isMobileLike()) {
      const dataUrl = doc.output("datauristring");
      if (dataUrl) {
        openPdfModal(dataUrl, filename || "Reporte");
        return;
      }
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      openPdfModal(url, filename || "Reporte", url);
      return;
    }
  } catch (e) {
    // fallback to download
  }
  doc.save(filename);
};
