import React, { useEffect, useMemo, useState } from "react";
import SectionCard from "../SectionCard";
import { fetchDashboard } from "../../controllers/dashboardController";
import { fetchAdminVenta, fetchAdminVentas } from "../../controllers/ventaController";

// PDF
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { openPdf } from "../../utils/pdf";
import { formatDateTimeLaPaz } from "../../utils/date";

const API_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:5000").replace(/\/$/, "");

const formatDate = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : formatDateTimeLaPaz(d);
};

const formatMoney = (value) => `Bs ${Number(value || 0).toFixed(2)}`;

const SuperUsuarioVentas = () => {
  const [ventas, setVentas] = useState([]);
  const [microempresas, setMicroempresas] = useState([]);
  const [filters, setFilters] = useState({ date: "", tenant_id: "" });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  const [selectedVenta, setSelectedVenta] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadMicroempresas = async () => {
    const { response, data } = await fetchDashboard();
    if (response.ok) {
      setMicroempresas(data.microempresas || []);
    }
  };

  const loadVentas = async (overrideFilters) => {
    setLoading(true);
    setMessage("");
    try {
      const { response, data } = await fetchAdminVentas(overrideFilters || filters);
      if (!response.ok) {
        setMessage(data.error || "No se pudo cargar ventas.");
        return;
      }
      setVentas(data.ventas || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMicroempresas();
    loadVentas();
  }, []);

  const handleFilter = async () => {
    await loadVentas();
  };

  const handleClear = async () => {
    const cleared = { date: "", tenant_id: "" };
    setFilters(cleared);
    await loadVentas(cleared);
  };

  const handleViewDetails = async (ventaId) => {
    if (!ventaId) return;
    setDetailLoading(true);
    setMessage("");
    try {
      const { response, data } = await fetchAdminVenta(ventaId);
      if (!response.ok) {
        setMessage(data.error || "No se pudo cargar el detalle.");
        return;
      }
      setSelectedVenta(data.venta || null);
    } finally {
      setDetailLoading(false);
    }
  };

  const microNameById = useMemo(() => {
    const map = new Map();
    (microempresas || []).forEach((m) => map.set(String(m.tenant_id), m.nombre));
    return map;
  }, [microempresas]);

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
    if (!url) return;
    if (isExternalUrl(url)) {
      const isPdf = url.toLowerCase().includes(".pdf");
      setPreviewFile({ url, title: "Comprobante", isPdf });
      return;
    }
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return;
      const contentType = res.headers.get("content-type") || "";
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      setPreviewFile({
        url: objectUrl,
        title: "Comprobante",
        isPdf: contentType.includes("pdf"),
      });
    } catch (e) {
      // ignore
    }
  };

  // Genera un informe PDF con las ventas actualmente listadas (respeta filtros)
  const generarInformeVentasPDF = () => {
    try {
      const rowsSource = ventas || [];

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginX = 24;

      const generado = formatDateTimeLaPaz();

      let y = 34;
      doc.setFontSize(16);
      doc.text("Informe de ventas (superusuario)", marginX, y);

      doc.setFontSize(9);
      doc.text(`Generado: ${generado}`, marginX, y + 16);

      // Resumen simple de filtros aplicados
      const filtroFecha = filters.date ? `Fecha: ${filters.date}` : "Fecha: Todas";
      const filtroTenant =
        filters.tenant_id
          ? `Microempresa: ${
              microNameById.get(String(filters.tenant_id)) || `#${filters.tenant_id}`
            }`
          : "Microempresa: Todas";

      doc.setFontSize(9);
      doc.text(`${filtroFecha}  |  ${filtroTenant}  |  Ventas: ${rowsSource.length}`, marginX, y + 32);

      y += 48;

      // Total general del listado
      const totalGeneral = rowsSource.reduce((acc, v) => acc + Number(v?.total || 0), 0);

      doc.setFontSize(10);
      doc.text(`Total general del listado: ${formatMoney(totalGeneral)}`, marginX, y);
      y += 10;

      const body = rowsSource.map((venta) => {
        const microLabel =
          venta.microempresa_nombre ||
          microNameById.get(String(venta.tenant_id)) ||
          "Microempresa";

        const clienteLabel = venta.cliente_nombre || venta.cliente_email || "Sin cliente";

        return [
          formatDate(venta.created_at),
          `${microLabel}${venta.tenant_id ? ` (#${venta.tenant_id})` : ""}`,
          clienteLabel,
          venta.tipo || "-",
          venta.metodo_pago || "-",
          venta.estado_envio || venta.estado || "-",
          formatMoney(venta.total),
        ];
      });

      autoTable(doc, {
        startY: y + 12,
        tableWidth: "auto",
        margin: { left: marginX, right: marginX },
        styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
        headStyles: { fontSize: 8 },
        head: [[
          "Fecha",
          "Microempresa",
          "Cliente",
          "Tipo",
          "Método",
          "Estado",
          "Total",
        ]],
        body,
        columnStyles: {
          0: { cellWidth: 120 },
          1: { cellWidth: 190 },
          2: { cellWidth: 160 },
          3: { cellWidth: 70 },
          4: { cellWidth: 80 },
          5: { cellWidth: 90 },
          6: { cellWidth: 80, halign: "right" },
        },
        didDrawPage: () => {
          const pageCount = doc.internal.getNumberOfPages();
          const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
          doc.setFontSize(9);
          doc.text(`Página ${currentPage} / ${pageCount}`, pageW - marginX, pageH - 16, { align: "right" });
        },
      });

      const stamp = new Date().toISOString().slice(0, 10);
      openPdf(doc, `informe_ventas_admin_${stamp}.pdf`);
    } catch (e) {
      console.error(e);
      setMessage(e?.message || "No se pudo generar el informe.");
    }
  };

  if (selectedVenta) {
    const clienteLabel =
      selectedVenta.cliente_nombre || selectedVenta.cliente_email || "Sin cliente";
    const clienteExtra = [
      selectedVenta.cliente_ci ? `CI: ${selectedVenta.cliente_ci}` : "",
      selectedVenta.cliente_razon_social ? `Razon social: ${selectedVenta.cliente_razon_social}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
    const microLabel =
      selectedVenta.microempresa_nombre ||
      microNameById.get(String(selectedVenta.tenant_id)) ||
      "Microempresa";

    return (
      <SectionCard title="Detalle de venta">
        <div className="card">
          <div className="ventas-table">
            <div className="ventas-row head ventas-8">
              <div>Fecha</div>
              <div>Microempresa</div>
              <div>Cliente</div>
              <div>Tipo</div>
              <div>Metodo</div>
              <div>Estado</div>
              <div>Total</div>
              <div>Comprobante</div>
            </div>
            <div className="ventas-row ventas-8">
              <div>{formatDate(selectedVenta.created_at)}</div>
              <div>
                {microLabel} {selectedVenta.tenant_id ? `(#${selectedVenta.tenant_id})` : ""}
              </div>
              <div>
                <div>{clienteLabel}</div>
                {clienteExtra && <div className="muted">{clienteExtra}</div>}
              </div>
              <div>{selectedVenta.tipo}</div>
              <div>{selectedVenta.metodo_pago || "-"}</div>
              <div>
                <span
                  className={`status-pill ${selectedVenta.estado_envio === "entregado" ? "active" : ""}`}
                >
                  {selectedVenta.estado_envio || selectedVenta.estado}
                </span>
              </div>
              <div>{formatMoney(selectedVenta.total)}</div>
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
                <div className="ventas-row head">
                  <div>Producto</div>
                  <div>Cantidad</div>
                  <div>Precio</div>
                  <div>Subtotal</div>
                </div>
                {selectedVenta.items.map((item) => (
                  <div key={item.id_item || item.id_producto} className="ventas-row">
                    <div>{item.nombre || `#${item.id_producto}`}</div>
                    <div>{item.cantidad}</div>
                    <div>{formatMoney(item.precio_unitario)}</div>
                    <div>{formatMoney(item.subtotal)}</div>
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

  return (
    <SectionCard title="Ventas (todas las microempresas)">
      <div className="card">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters((prev) => ({ ...prev, date: e.target.value }))}
            />
            <select
              value={filters.tenant_id}
              onChange={(e) => setFilters((prev) => ({ ...prev, tenant_id: e.target.value }))}
            >
              <option value="">Todas las microempresas</option>
              {microempresas.map((m) => (
                <option key={m.tenant_id} value={String(m.tenant_id)}>
                  {m.nombre}
                </option>
              ))}
            </select>

            <button type="button" onClick={handleFilter} disabled={loading}>
              {loading ? "Cargando..." : "Filtrar"}
            </button>
            <button type="button" className="ghost-button" onClick={handleClear} disabled={loading}>
              Limpiar
            </button>

            {/* Botón nuevo para generar informe PDF */}
            <button type="button" className="ghost-button" onClick={generarInformeVentasPDF} disabled={loading}>
              Generar informe (PDF)
            </button>
          </div>

          <div className="muted">{ventas.length} venta(s)</div>
        </div>

        {message && <p className="error">{message}</p>}

        {ventas.length === 0 ? (
          <p className="muted">{loading ? "Cargando..." : "No hay ventas registradas."}</p>
        ) : (
          <div className="ventas-table">
            <div className="ventas-row head ventas-8">
              <div>Fecha</div>
              <div>Microempresa</div>
              <div>Cliente</div>
              <div>Tipo</div>
              <div>Metodo</div>
              <div>Estado</div>
              <div>Total</div>
              <div>Acciones</div>
            </div>
            {ventas.map((venta) => {
              const microLabel =
                venta.microempresa_nombre ||
                microNameById.get(String(venta.tenant_id)) ||
                "Microempresa";
              const clienteLabel =
                venta.cliente_nombre || venta.cliente_email || "Sin cliente";

              return (
                <div key={venta.id_venta} className="ventas-row ventas-8">
                  <div>{formatDate(venta.created_at)}</div>
                  <div>
                    {microLabel} {venta.tenant_id ? `(#${venta.tenant_id})` : ""}
                  </div>
                  <div>{clienteLabel}</div>
                  <div>{venta.tipo}</div>
                  <div>{venta.metodo_pago || "-"}</div>
                  <div>
                    <span className={`status-pill ${venta.estado_envio === "entregado" ? "active" : ""}`}>
                      {venta.estado_envio || venta.estado}
                    </span>
                  </div>
                  <div>{formatMoney(venta.total)}</div>
                  <div>
                    <button type="button" onClick={() => handleViewDetails(venta.id_venta)}>
                      {detailLoading ? "Cargando..." : "Ver detalles"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SectionCard>
  );
};

export default SuperUsuarioVentas;
