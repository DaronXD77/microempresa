const isMobileLike = () => {
  if (typeof window === "undefined") return false;
  if (window.Capacitor) return true;
  const ua = navigator.userAgent || "";
  return /android|iphone|ipad|ipod/i.test(ua);
};

export const openPdf = (doc, filename) => {
  try {
    if (isMobileLike()) {
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }
  } catch (e) {
    // fallback to download
  }
  doc.save(filename);
};
