import React, { useEffect, useMemo, useState } from "react";
import SectionCard from "../SectionCard";
import { fetchMe } from "../../controllers/authController";
import { fetchVentas } from "../../controllers/ventaController";
import { uploadMicroempresaQr } from "../../controllers/userController";
import ToastModal from "../ToastModal";
import { resolveAssetUrl } from "../../utils/url";

// PDF
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { openPdf } from "../../utils/pdf";
import { formatDateTimeLaPaz } from "../../utils/date";

const API_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:5000").replace(/\/$/, "");

const MicroempresaVentas = () => {
  const [ventas, setVentas] = useState([]);
  const [totalGeneral, setTotalGeneral] = useState(0);
  const [dailyTotals, setDailyTotals] = useState([]);
  const [micro, setMicro] = useState(null);
  const [message, setMessage] = useState("");
  const [selectedVenta, setSelectedVenta] = useState(null);
  const [toast, setToast] = useState({ open: false, message: "", variant: "success" });
  const [qrPreviewOpen, setQrPreviewOpen] = useState(false);
  const [qrUploading, setQrUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  //  NUEVO: mes seleccionado
  const [selectedMonth, setSelectedMonth] = useState("");

  const load = async () => {
    const [ventasRes, meRes] = await Promise.all([fetchVentas(), fetchMe()]);
    if (ventasRes.response.ok) {
      setVentas(ventasRes.data.ventas || []);
      setTotalGeneral(ventasRes.data.total_general || 0);
      setDailyTotals(ventasRes.data.daily_totals || []);
    }
    if (meRes.response.ok) {
      setMicro(meRes.data.user || null);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("ventasUpdated", handler);
    return () => window.removeEventListener("ventasUpdated", handler);
  }, []);

  useEffect(() => {
    if (!message) return;
    const lower = String(message || "").toLowerCase();
    const variant = lower.includes("no") || lower.includes("error") ? "warning" : "success";
    setToast({ open: true, message, variant });
  }, [message]);

  const handleQrUpload = async (file) => {
    if (!file || !micro?.tenant_id) return;
    setMessage("");
    setQrUploading(true);
    const { response, data } = await uploadMicroempresaQr(micro.tenant_id, file);
    setQrUploading(false);
    if (!response.ok) {
      setMessage(data.error || "No se pudo subir el QR.");
      return;
    }
    setMicro(data.microempresa || micro);
    setMessage("QR actualizado.");
  };

  const resolveComprobanteUrl = (value) => {
    if (!value) return null;
    if (value.startsWith("http")) return value;
    if (value.startsWith("/")) return `${API_BASE}${value}`;
    return `${API_BASE}/${value}`;
  };

  const closePreview = () => {
    if (previewFile?.url) URL.revokeObjectURL(previewFile.url);
    setPreviewFile(null);
  };

  const isExternalUrl = (url) => {
    if (!url) return false;
    if (!url.startsWith("http")) return false;
    return !url.startsWith(API_BASE);
  };

  const openComprobante = async (value) => {
    const url = resolveComprobanteUrl(value);
    if (!url) {
      setMessage("Comprobante no disponible.");
      return;
    }
    if (isExternalUrl(url)) {
      const isPdf = url.toLowerCase().includes(".pdf");
      setPreviewFile({ url, title: "Comprobante", isPdf });
      return;
    }
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error || "No se pudo abrir el comprobante.");
        return;
      }
      const contentType = res.headers.get("content-type") || "";
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      setPreviewFile({
        url: objectUrl,
        title: "Comprobante",
        isPdf: contentType.includes("pdf"),
      });
    } catch (err) {
      setMessage(err?.message || "No se pudo abrir el comprobante.");
    }
  };

  const formatMoney = (n) => `Bs ${Number(n || 0).toFixed(2)}`;

  // ---------------------------
  //  Agrupar ventas por mes (YYYY-MM)
  // ---------------------------
  const ventasPorMes = useMemo(() => {
    const map = new Map();

    (ventas || []).forEach((v) => {
      if (!v?.created_at) return;
      const d = new Date(v.created_at);
      if (Number.isNaN(d.getTime())) return;

      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString(undefined, { year: "numeric", month: "long" });

      if (!map.has(key)) {
        map.set(key, { key, label, ventas: [], total: 0, count: 0 });
      }
      const bucket = map.get(key);
      bucket.ventas.push(v);
      bucket.total += Number(v.total || 0);
      bucket.count += 1;
    });

    const arr = Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
    arr.forEach((m) => {
      m.ventas.sort((a, b) => {
        const da = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
      });
    });
    return arr;
  }, [ventas]);

  //  Por defecto: mes actual; si no existe, el más reciente con ventas
  useEffect(() => {
    if (ventasPorMes.length === 0) return;

    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const exists = ventasPorMes.find((m) => m.key === currentKey);

    setSelectedMonth((prev) => prev || (exists ? currentKey : ventasPorMes[0].key));
  }, [ventasPorMes]);

  const mesActual = useMemo(
    () => ventasPorMes.find((m) => m.key === selectedMonth) || null,
    [ventasPorMes, selectedMonth]
  );

  // ---------------------------
  //  PDF con logo
  // ---------------------------
  const getMicroLogoUrl = () => {
    // Ajusta si tu backend usa otro campo
    const raw =
      micro?.logo_url ||
      micro?.logo ||
      micro?.imagen_url ||
      micro?.image_url ||
      micro?.foto_url ||
      "";

    const url = resolveComprobanteUrl(raw);
    return url || null;
  };

  const fetchImageAsDataUrl = async (url) => {
    // Convierte imagen remota a DataURL para poder insertarla en jsPDF
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("No se pudo cargar el logo.");
    const blob = await res.blob();

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const generarReportePDFDelMes = async () => {
    if (!mesActual) {
      setMessage("No hay mes seleccionado para generar reporte.");
      return;
    }

    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 40;

      // Header
      const empresaNombre =
        micro?.razon_social || micro?.nombre || micro?.name || "Microempresa";
      const titulo = `Reporte de ventas — ${mesActual.label}`;

      // Logo (si existe)
      let y = 40;
      const logoUrl = getMicroLogoUrl();
      let logoDrawn = false;

      if (logoUrl) {
        try {
          const dataUrl = await fetchImageAsDataUrl(logoUrl);
          // Intentar detectar formato para addImage
          const isPng = String(dataUrl).startsWith("data:image/png");
          const format = isPng ? "PNG" : "JPEG";

          // Tamaño fijo (mantener simple)
          const logoW = 64;
          const logoH = 64;
          doc.addImage(dataUrl, format, marginX, y, logoW, logoH);
          logoDrawn = true;
        } catch (e) {
          // Si falla por CORS o URL inválida, no bloquees el reporte
          logoDrawn = false;
        }
      }

      // Textos cabecera
      doc.setFontSize(16);
      doc.text(empresaNombre, logoDrawn ? marginX + 78 : marginX, y + 20);

      doc.setFontSize(12);
      doc.text(titulo, logoDrawn ? marginX + 78 : marginX, y + 40);

      doc.setFontSize(10);
      const fechaGen = formatDateTimeLaPaz();
      doc.text(`Generado: ${fechaGen}`, logoDrawn ? marginX + 78 : marginX, y + 58);

      y = y + 90;

      // Resumen
      const totalMes = Number(mesActual.total || 0);
      const cantidad = Number(mesActual.count || mesActual.ventas?.length || 0);

      // Agrupar por método pago y tipo (resumen rápido)
      const porMetodo = {};
      const porTipo = {};

      (mesActual.ventas || []).forEach((v) => {
        const metodo = v?.metodo_pago || "—";
        porMetodo[metodo] = (porMetodo[metodo] || 0) + Number(v.total || 0);

        const tipo = v?.tipo || "—";
        porTipo[tipo] = (porTipo[tipo] || 0) + Number(v.total || 0);
      });

      doc.setFontSize(12);
      doc.text("Resumen", marginX, y);
      y += 14;

      doc.setFontSize(10);
      doc.text(`Cantidad de ventas: ${cantidad}`, marginX, y);
      doc.text(`Total del mes: ${formatMoney(totalMes)}`, marginX + 220, y);
      y += 16;

      // mini-resúmenes en texto (sin tablas grandes)
      const metodoLine = Object.entries(porMetodo)
        .slice(0, 6)
        .map(([k, val]) => `${k}: ${formatMoney(val)}`)
        .join("  |  ");

      const tipoLine = Object.entries(porTipo)
        .slice(0, 6)
        .map(([k, val]) => `${k}: ${formatMoney(val)}`)
        .join("  |  ");

      if (metodoLine) {
        doc.text(`Por método: ${metodoLine}`, marginX, y);
        y += 14;
      }
      if (tipoLine) {
        doc.text(`Por tipo: ${tipoLine}`, marginX, y);
        y += 14;
      }

      y += 6;

      // Tabla de ventas
      const rows = (mesActual.ventas || []).map((v) => {
        const fecha = v?.created_at ? formatDateTimeLaPaz(v.created_at) : "-";
        const cliente = v?.cliente_nombre || v?.cliente_email || "Sin cliente";
        const metodo = v?.metodo_pago || "-";
        const estado = v?.estado_envio || v?.estado || "-";
        const total = Number(v?.total || 0).toFixed(2);
        return [fecha, v?.tipo || "-", cliente, metodo, estado, `Bs ${total}`];
      });

      autoTable(doc, {
        startY: y,
        head: [["Fecha", "Tipo", "Cliente", "Método", "Estado", "Total"]],
        body: rows,
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 110 },
          1: { cellWidth: 55 },
          2: { cellWidth: 120 },
          3: { cellWidth: 70 },
          4: { cellWidth: 65 },
          5: { cellWidth: 60, halign: "right" },
        },
        margin: { left: marginX, right: marginX },
        didDrawPage: () => {
          // Footer page number
          const pageCount = doc.internal.getNumberOfPages();
          const pageCurrent = doc.internal.getCurrentPageInfo().pageNumber;
          doc.setFontSize(9);
          doc.text(
            `Página ${pageCurrent} / ${pageCount}`,
            pageWidth - marginX,
            doc.internal.pageSize.getHeight() - 20,
            { align: "right" }
          );
        },
      });

      const safeMonth = mesActual.key || "mes";
      openPdf(doc, `reporte_ventas_${safeMonth}.pdf`);
      setMessage("Reporte PDF generado.");
    } catch (e) {
      setMessage(e?.message || "No se pudo generar el reporte PDF.");
    }
  };

  // ---------------------------
  // Vista detalle de venta
  // ---------------------------
  if (selectedVenta) {
    const clienteLabel =
      selectedVenta.cliente_nombre || selectedVenta.cliente_email || "Sin cliente";
    const clienteExtra = [
      selectedVenta.cliente_ci ? `CI: ${selectedVenta.cliente_ci}` : "",
      selectedVenta.cliente_razon_social ? `Razon social: ${selectedVenta.cliente_razon_social}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    return (
      <SectionCard title="Detalle de venta">
        <div className="card">
          <div className="ventas-table">
            <div className="ventas-row head ventas-7">
              <div>Fecha</div>
              <div>Tipo</div>
              <div>Cliente</div>
              <div>Metodo</div>
              <div>Estado</div>
              <div>Total</div>
              <div>Comprobante</div>
            </div>
            <div className="ventas-row ventas-7">
              <div>
                {selectedVenta.created_at ? formatDateTimeLaPaz(selectedVenta.created_at) : "-"}
              </div>
              <div>{selectedVenta.tipo}</div>
              <div>
                <div>{clienteLabel}</div>
                {clienteExtra && <div className="muted">{clienteExtra}</div>}
              </div>
              <div>{selectedVenta.metodo_pago || "-"}</div>
              <div>
                <span className={`status-pill ${selectedVenta.estado_envio === "entregado" ? "active" : ""}`}>
                  {selectedVenta.estado_envio || selectedVenta.estado}
                </span>
              </div>
              <div>{formatMoney(selectedVenta.total || 0)}</div>
              <div>
                {selectedVenta.comprobante_url ? (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => openComprobante(selectedVenta.comprobante_url)}
                  >
                    Ver
                  </button>
                ) : (
                  <span className="muted">-</span>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="form-title">Items</div>
            {Array.isArray(selectedVenta.items) && selectedVenta.items.length > 0 ? (
              <div className="ventas-table" style={{ marginTop: 10 }}>
                <div className="ventas-row head ventas-4">
                  <div>Producto</div>
                  <div>Cantidad</div>
                  <div>Precio</div>
                  <div>Subtotal</div>
                </div>
                {selectedVenta.items.map((item) => (
                  <div key={item.id_item || item.id_producto} className="ventas-row ventas-4">
                    <div>{item.nombre || `#${item.id_producto}`}</div>
                    <div>{item.cantidad}</div>
                    <div>{formatMoney(item.precio_unitario || 0)}</div>
                    <div>{formatMoney(item.subtotal || 0)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No hay detalles de items.</p>
            )}
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <button type="button" className="ghost-button" onClick={() => setSelectedVenta(null)}>
              Volver al listado
            </button>
          </div>
        </div>

        {previewFile && (
          <div className="image-modal" onClick={closePreview}>
            <div className="image-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="image-modal-title">{previewFile.title}</div>
              <button type="button" className="image-modal-close" onClick={closePreview} aria-label="Cerrar">
                ×
              </button>
              {previewFile.isPdf ? (
                <iframe className="image-modal-frame" src={previewFile.url} title={previewFile.title} />
              ) : (
                <img src={previewFile.url} alt={previewFile.title} />
              )}
            </div>
          </div>
        )}
      </SectionCard>
    );
  }

  // ---------------------------
  // Vista principal
  // ---------------------------
  return (
    <SectionCard title="Ventas" description="Historial de ventas (fisicas y virtuales).">
      <div className="card">
        <div className="ventas-summary">
          <div>
            <div className="muted">Total general</div>
            <strong className="ventas-total">{formatMoney(totalGeneral || 0)}</strong>
          </div>

          <div className="ventas-qr">
            <div className="form-title">QR de pagos</div>
            {micro?.qr_url ? (
              <img
                src={resolveAssetUrl(micro.qr_url)}
                alt="QR de pagos"
                style={{ width: 180, height: 180, objectFit: "contain", cursor: "zoom-in", borderRadius: 14, border: "1px solid #e5e7eb", background: "#fff" }}
                onClick={() => setQrPreviewOpen(true)}
              />
            ) : (
              <div className="muted">Sin QR cargado</div>
            )}

            {qrPreviewOpen && micro?.qr_url && (
              <div className="image-modal" onClick={() => setQrPreviewOpen(false)}>
                <div className="image-modal-card" onClick={(e) => e.stopPropagation()}>
                  <div className="image-modal-title">QR de pagos</div>
                  <button type="button" className="image-modal-close" onClick={() => setQrPreviewOpen(false)} aria-label="Cerrar">
                    ×
                  </button>
                  <img src={resolveAssetUrl(micro.qr_url)} alt="QR de pagos" />
                </div>
              </div>
            )}
            {previewFile && (
              <div className="image-modal" onClick={closePreview}>
                <div className="image-modal-card" onClick={(e) => e.stopPropagation()}>
                  <div className="image-modal-title">{previewFile.title}</div>
                  <button type="button" className="image-modal-close" onClick={closePreview} aria-label="Cerrar">
                    ×
                  </button>
                  {previewFile.isPdf ? (
                    <iframe className="image-modal-frame" src={previewFile.url} title={previewFile.title} />
                  ) : (
                    <img src={previewFile.url} alt={previewFile.title} />
                  )}
                </div>
              </div>
            )}
            <label className="upload-button">
              <span>{qrUploading ? "Subiendo..." : "Subir QR"}</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  handleQrUpload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>

        <ToastModal
          open={toast.open}
          message={toast.message}
          variant={toast.variant}
          duration={10000}
          onClose={() => setToast({ open: false, message: "", variant: "success" })}
        />

        {/* Totales por día (tal como lo tenías) */}
        {dailyTotals.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="form-title">Totales por dia</div>
            <div className="ventas-table" style={{ marginTop: 8 }}>
              <div className="ventas-row head ventas-2">
                <div>Fecha</div>
                <div>Total</div>
              </div>
              {dailyTotals.map((item) => (
                <div key={item.date} className="ventas-row ventas-2">
                  <div>{item.date}</div>
                  <div>{formatMoney(item.total || 0)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/*  Selector de mes + botón PDF */}
        <div
          style={{
            marginTop: 16,
            marginBottom: 12,
            display: "flex",
            gap: 16,
            alignItems: "flex-end",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              Mes
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ minWidth: 240, padding: "8px 10px" }}
            >
              {ventasPorMes.length === 0 ? (
                <option value="">Sin ventas</option>
              ) : (
                ventasPorMes.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))
              )}
            </select>
          </div>

          <div style={{ textAlign: "right" }}>
            <div className="muted" style={{ marginBottom: 6 }}>
              Total del mes
            </div>
            <strong style={{ fontSize: 16 }}>{formatMoney(mesActual?.total || 0)}</strong>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={generarReportePDFDelMes} disabled={!mesActual}>
              Reporte PDF del mes
            </button>
          </div>
        </div>

        {/* Tabla de ventas DEL MES seleccionado */}
        <div className="ventas-table">
          <div className="ventas-row head ventas-7">
            <div>Fecha</div>
            <div>Tipo</div>
            <div>Cliente</div>
            <div>Metodo</div>
            <div>Estado</div>
            <div>Total</div>
            <div>Acciones</div>
          </div>

          {!mesActual || mesActual.ventas.length === 0 ? (
            <p className="muted">No hay ventas registradas en este mes.</p>
          ) : (
            mesActual.ventas.map((venta) => (
              <div key={venta.id_venta} className="ventas-row ventas-7">
                <div>{venta.created_at ? formatDateTimeLaPaz(venta.created_at) : "-"}</div>
                <div>{venta.tipo}</div>
                <div>{venta.cliente_nombre || venta.cliente_email || "Sin cliente"}</div>
                <div>{venta.metodo_pago}</div>
                <div>
                  <span className={`status-pill ${venta.estado_envio === "entregado" ? "active" : ""}`}>
                    {venta.estado_envio || venta.estado || "-"}
                  </span>
                </div>
                <div>{formatMoney(venta.total || 0)}</div>
                <div>
                  <button type="button" onClick={() => setSelectedVenta(venta)}>
                    Ver detalles
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </SectionCard>
  );
};

export default MicroempresaVentas;
