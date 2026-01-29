import React, { useEffect, useMemo, useState } from "react";
import SectionCard from "../SectionCard";
import { fetchCompras, fetchCompraDetalle } from "../../controllers/compraController";
import { fetchMe } from "../../controllers/authController";

// PDF
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { openPdf } from "../../utils/pdf";
import { formatDateTimeLaPaz, formatDateTimeLaPazShort } from "../../utils/date";

// Formatea fechas de forma consistente
const formatFecha = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return formatDateTimeLaPazShort(date);
};

const API_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:5000").replace(/\/$/, "");

// Resuelve rutas relativas a URL absoluta usando el API_BASE
const resolveUrl = (value) => {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  if (value.startsWith("/")) return `${API_BASE}${value}`;
  return `${API_BASE}/${value}`;
};

const MicroempresaHistorialCompras = () => {
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(false);

  // Datos de la microempresa para el encabezado del PDF (nombre/logo)
  const [micro, setMicro] = useState(null);

  // Modal de detalle
  const [selected, setSelected] = useState(null);
  const [detalleLoading, setDetalleLoading] = useState(false);

  // Búsqueda local
  const [search, setSearch] = useState("");

  // Carga inicial de compras y microempresa
  const load = async () => {
    setLoading(true);

    // Se carga la lista de compras y los datos del usuario/microempresa en paralelo
    const [comprasRes, meRes] = await Promise.all([fetchCompras(), fetchMe()]);

    if (comprasRes.response.ok) {
      setCompras(comprasRes.data.compras || []);
    }

    if (meRes.response.ok) {
      setMicro(meRes.data.user || null);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Filtra compras por proveedor o por id
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return compras;
    return compras.filter((c) => {
      const proveedor = c.proveedor?.nombre || "";
      return String(c.id_compra).includes(term) || proveedor.toLowerCase().includes(term);
    });
  }, [compras, search]);

  // Abre el detalle de una compra consultando al backend
  const openDetalle = async (compraId) => {
    setDetalleLoading(true);
    const { response, data } = await fetchCompraDetalle(compraId);
    if (response.ok) {
      setSelected(data.compra);
    }
    setDetalleLoading(false);
  };

  // Cierra el modal de detalle
  const closeDetalle = () => setSelected(null);

  const openDetallePdf = async () => {
    if (!selected?.id_compra) return;
    const url = `${API_BASE}/api/compras/${selected.id_compra}/pdf`;
    if (typeof window !== "undefined" && window.Capacitor) {
      try {
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url, presentationStyle: "fullscreen" });
        return;
      } catch (e) {
        // fallback to web open
      }
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Devuelve una URL de logo si existe en el objeto micro
  const getMicroLogoUrl = () => {
    const raw =
      micro?.logo_url ||
      micro?.logo ||
      micro?.imagen_url ||
      micro?.image_url ||
      micro?.foto_url ||
      "";
    return resolveUrl(raw);
  };

  // Convierte una imagen remota a DataURL para poder insertarla en jsPDF
  const fetchImageAsDataUrl = async (url) => {
    const res = await fetch(url, { mode: "cors", credentials: "include" });
    if (!res.ok) throw new Error("No se pudo cargar el logo.");
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Genera el informe PDF del historial de compras usando la lista visible (respeta filtros)
  const generarInformeComprasPDF = async () => {
    try {
      const rowsSource = visible;

      // Datos de cabecera
      const empresaNombre = micro?.razon_social || micro?.nombre || micro?.name || "Microempresa";
      const generado = formatDateTimeLaPaz();

      // Resumen simple
      const resumen = rowsSource.reduce(
        (acc, c) => {
          acc.totalCompras += 1;
          acc.totalMonto += Number(c.total || 0);
          acc.totalItems += Number((c.detalles || []).length);
          return acc;
        },
        { totalCompras: 0, totalMonto: 0, totalItems: 0 }
      );

      // Se usa landscape para que la tabla entre sin cortar columnas
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginX = 24;

      // Encabezado con logo (si se puede cargar, si no, se omite)
      let y = 28;
      const logoUrl = getMicroLogoUrl();
      let logoDrawn = false;

      if (logoUrl) {
        try {
          const dataUrl = await fetchImageAsDataUrl(logoUrl);
          const format = String(dataUrl).startsWith("data:image/png") ? "PNG" : "JPEG";
          doc.addImage(dataUrl, format, marginX, y, 56, 56);
          logoDrawn = true;
        } catch {
          logoDrawn = false;
        }
      }

      // Títulos del reporte
      doc.setFontSize(16);
      doc.text(empresaNombre, logoDrawn ? marginX + 70 : marginX, y + 18);

      doc.setFontSize(12);
      doc.text("Informe de historial de compras", logoDrawn ? marginX + 70 : marginX, y + 38);

      doc.setFontSize(9);
      doc.text(`Generado: ${generado}`, logoDrawn ? marginX + 70 : marginX, y + 54);

      y += 74;

      // Resumen debajo del encabezado
      doc.setFontSize(11);
      doc.text(
        `Compras: ${resumen.totalCompras}   |   Items (registros): ${resumen.totalItems}   |   Total: Bs ${resumen.totalMonto.toFixed(
          2
        )}`,
        marginX,
        y
      );

      // Prepara filas de tabla
      const body = rowsSource.map((c) => {
        const proveedor = c.proveedor?.nombre || "-";
        const items = (c.detalles || []).length;
        const total = `Bs ${Number(c.total || 0).toFixed(2)}`;
        const estado = c.estado || "registrada";
        return [String(c.id_compra), formatFecha(c.fecha), proveedor, String(items), total, estado];
      });

      // Tabla con ajuste automático al ancho, para evitar recortes
      autoTable(doc, {
        startY: y + 10,
        tableWidth: "auto",
        margin: { left: marginX, right: marginX },
        styles: {
          fontSize: 8,
          cellPadding: 3,
          overflow: "linebreak",
        },
        headStyles: {
          fontSize: 8,
        },
        head: [["#", "Fecha", "Proveedor", "Items", "Total", "Estado"]],
        body,
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 105 },
          2: { cellWidth: 220 },
          3: { cellWidth: 55, halign: "right" },
          4: { cellWidth: 90, halign: "right" },
          5: { cellWidth: 90 },
        },
        didDrawPage: () => {
          const pageCount = doc.internal.getNumberOfPages();
          const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
          doc.setFontSize(9);
          doc.text(`Página ${currentPage} / ${pageCount}`, pageW - marginX, pageH - 16, { align: "right" });
        },
      });

      // Nombre del archivo
      const stamp = new Date().toISOString().slice(0, 10);
      openPdf(doc, `informe_compras_${stamp}.pdf`);
    } catch (e) {
      // Si falla el logo o la generación, se muestra un error simple
      // Se evita un Toast aquí para no introducir dependencias adicionales no presentes
      // Puedes reemplazarlo por tu sistema de notificaciones si lo prefieres
      console.error(e);
    }
  };

  return (
    <SectionCard title="Historial de compras" description="Revisa compras anteriores y sus detalles.">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ minWidth: 240 }}>
            <span className="form-title">Buscar</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por proveedor o # compra"
            />
          </label>

          {/* Botón para generar el informe en PDF (usa la lista visible y respeta filtros) */}
          <div>
            <button type="button" onClick={generarInformeComprasPDF} disabled={loading}>
              Generar informe (PDF)
            </button>
          </div>
        </div>

        <div className="historial-table" style={{ marginTop: 16 }}>
          <div className="historial-row head">
            <div>#</div>
            <div>Fecha</div>
            <div>Proveedor</div>
            <div>Items</div>
            <div>Total</div>
            <div>Estado</div>
            <div>Acciones</div>
          </div>

          {loading ? (
            <p className="muted">Cargando...</p>
          ) : visible.length === 0 ? (
            <p className="muted">No hay compras.</p>
          ) : (
            visible.map((compra) => (
              <div key={compra.id_compra} className="historial-row">
                <div>{compra.id_compra}</div>
                <div>{formatFecha(compra.fecha)}</div>
                <div>{compra.proveedor?.nombre || "-"}</div>
                <div>{(compra.detalles || []).length}</div>
                <div>Bs {Number(compra.total || 0).toFixed(2)}</div>
                <div>
                  <span className={`status-pill ${compra.estado === "registrada" ? "active" : ""}`}>
                    {compra.estado || "registrada"}
                  </span>
                </div>
                <div className="producto-table-actions">
                  <button type="button" className="ghost-button" onClick={() => openDetalle(compra.id_compra)}>
                    Ver detalles
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal de detalle de compra */}
      {selected && (
        <div className="text-modal" onClick={closeDetalle}>
          <div className="text-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="form-title">Compra #{selected.id_compra}</div>
            <div className="muted">Fecha: {formatFecha(selected.fecha)}</div>
            <div className="muted">Proveedor: {selected.proveedor?.nombre || "-"}</div>
            <div className="muted">Total: Bs {Number(selected.total || 0).toFixed(2)}</div>

            <div className="data-list" style={{ marginTop: 12 }}>
              {(selected.detalles || []).length === 0 ? (
                <p className="muted">Sin detalles.</p>
              ) : (
                selected.detalles.map((det) => (
                  <div key={det.id_detalle_compra} className="data-row">
                    <div>
                      <strong>{det.nombre || `#${det.id_producto}`}</strong>
                      {det.lote ? <div className="muted">Lote: {det.lote}</div> : null}
                    </div>
                    <div className="muted">Cantidad: {det.cantidad}</div>
                    <div className="muted">Precio: Bs {Number(det.precio_unitario || 0).toFixed(2)}</div>
                    <div className="muted">Subtotal: Bs {Number(det.subtotal || 0).toFixed(2)}</div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              <button type="button" className="primary-button" onClick={openDetallePdf}>
                Descargar PDF
              </button>
              <button type="button" className="ghost-button" onClick={closeDetalle} disabled={detalleLoading}>
                {detalleLoading ? "Cargando..." : "Cerrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
};

export default MicroempresaHistorialCompras;
