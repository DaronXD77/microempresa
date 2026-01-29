export const openImageModal = (src, title = "Imagen") => {
  if (!src) return;
  const existing = document.getElementById("image-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "image-modal";
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
  titleEl.textContent = title;
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
  close.onclick = () => modal.remove();

  const img = document.createElement("img");
  img.src = src;
  img.alt = title;
  img.style.width = "100%";
  img.style.maxHeight = "70vh";
  img.style.borderRadius = "12px";
  img.style.objectFit = "contain";
  img.style.background = "#fff";

  const fallback = document.createElement("div");
  fallback.textContent = "No se pudo cargar la imagen.";
  fallback.style.fontSize = "13px";
  fallback.style.color = "#4b5563";
  fallback.style.textAlign = "center";
  fallback.style.padding = "8px 0";
  fallback.style.display = "none";

  img.onerror = () => {
    fallback.style.display = "block";
  };

  modal.onclick = () => modal.remove();
  card.onclick = (e) => e.stopPropagation();

  card.appendChild(titleEl);
  card.appendChild(close);
  card.appendChild(img);
  card.appendChild(fallback);
  modal.appendChild(card);
  document.body.appendChild(modal);
};
