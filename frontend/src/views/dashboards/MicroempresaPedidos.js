import React, { useEffect, useMemo, useState } from "react";
import SectionCard from "../SectionCard";
import { fetchMe } from "../../controllers/authController";
import { fetchPedidos, marcarEmpaquetado, rechazarVenta } from "../../controllers/ventaController";
import ToastModal from "../ToastModal";

// PDF
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { openPdf } from "../../utils/pdf";


const API_BASE = (process.env.REACT_APP_API_BASE || "").replace(/\/$/, "");

// ------------------------------
// Helpers
// ------------------------------
const formatMoney = (n) => `Bs ${Number(n || 0).toFixed(2)}`;

const resolveUrl = (value) => {
  if (!value) return null;
  if (value.startsWith("http")) return value;
  if (value.startsWith("/")) return `${API_BASE}${value}`;
  return `${API_BASE}/${value}`;
};

const buildMapsLinkFromQuery = (query) => {
  const q = String(query || "").trim();
  if (!q) return "";
  // Link clickeable (maps)
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
};

const buildEmbedSrcFromQuery = (query) => {
  const q = String(query || "").trim();
  if (!q) return "";
  // Embed sin API key (simple)
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
};

const getMonthKey = (dateValue) => {
  if (!dateValue) return null;
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const monthLabelFromKey = (key) => {
  // key = YYYY-MM
  if (!key || !/^\d{4}-\d{2}$/.test(key)) return "Sin fecha";
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
};

// ------------------------------
// Mini componente: MapPicker
// - Busca lugar, muestra preview, y llena maps_url
// ------------------------------
const MapPicker = ({ mapsUrl, onChangeMapsUrl, placeholder = "Ej: Plaza Murillo, La Paz" }) => {
  const [query, setQuery] = useState("");

  const embedSrc = useMemo(() => buildEmbedSrcFromQuery(query), [query]);
  const suggestedLink = useMemo(() => buildMapsLinkFromQuery(query), [query]);

  return (
    <div style={{ marginTop: 8 }}>
      <div className="muted" style={{ marginBottom: 6 }}>
        Mapa (buscar lugar y autollenar link)
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={query}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <button
          type="button"
          className="ghost-button"
          disabled={!suggestedLink}
          onClick={() => onChangeMapsUrl(suggestedLink)}
        >
          Usar este lugar
        </button>
      </div>

      {embedSrc ? (
        <div style={{ marginTop: 10 }}>
          <iframe
            title="map-preview"
            src={embedSrc}
            width="100%"
            height="220"
            style={{ border: 0, borderRadius: 10 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="muted" style={{ marginTop: 6 }}>
            Link sugerido:{" "}
            <a href={suggestedLink} target="_blank" rel="noopener noreferrer">
              abrir
            </a>
          </div>
        </div>
      ) : (
        <div className="muted" style={{ marginTop: 8 }}>
          Escribe un lugar para ver el mapa aquí.
        </div>
      )}

      {mapsUrl ? (
        <div className="muted" style={{ marginTop: 8 }}>
          Link actual:{" "}
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
            ver en Google Maps
          </a>
        </div>
      ) : null}
    </div>
  );
};

const MicroempresaPedidos = () => {
  const [pedidos, setPedidos] = useState([]);
  const [micro, setMicro] = useState(null);

  const [message, setMessage] = useState("");
  const [toast, setToast] = useState({ open: false, message: "", variant: "success" });
  const [previewFile, setPreviewFile] = useState(null);
  const [actionLock, setActionLock] = useState({});
  const [opcionesEntrega, setOpcionesEntrega] = useState({});
  const [reprogramOpen, setReprogramOpen] = useState({});

  //  NUEVO: mes seleccionado (select)
  const [selectedMonth, setSelectedMonth] = useState("");

  // Nota: agrego campo local "maps_query" para UI (no se manda al backend)
  const emptyOpcion = {
    fecha: "",
    hora_inicio: "",
    hora_fin: "",
    lugar_texto: "",
    maps_url: "",
    maps_query: "",
  };

  const load = async () => {
    const [pedRes, meRes] = await Promise.all([fetchPedidos(), fetchMe()]);
    if (pedRes.response?.ok) setPedidos(pedRes.data?.pedidos || []);
    if (meRes.response?.ok) setMicro(meRes.data?.user || null);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!message) return;
    const lower = String(message || "").toLowerCase();
    const variant = lower.includes("no") || lower.includes("error") ? "warning" : "success";
    setToast({ open: true, message, variant });
  }, [message]);

  // ---------------------------
  // Agrupar pedidos por mes (YYYY-MM)
  // ---------------------------
  const pedidosPorMes = useMemo(() => {
    const map = new Map();

    (pedidos || []).forEach((p) => {
      const key = getMonthKey(p?.created_at) || "Sin fecha";
      if (!map.has(key)) {
        map.set(key, { key, label: key === "Sin fecha" ? "Sin fecha" : monthLabelFromKey(key), pedidos: [], total: 0, count: 0 });
      }
      const bucket = map.get(key);
      bucket.pedidos.push(p);
      bucket.total += Number(p?.total || 0);
      bucket.count += 1;
    });

    const arr = Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
    arr.forEach((m) => {
      m.pedidos.sort((a, b) => {
        const da = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
      });
    });

    return arr;
  }, [pedidos]);

  //  por defecto: mes actual si existe; si no, el más reciente
  useEffect(() => {
    if (pedidosPorMes.length === 0) return;
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const exists = pedidosPorMes.find((m) => m.key === currentKey);
    setSelectedMonth((prev) => prev || (exists ? currentKey : pedidosPorMes[0].key));
  }, [pedidosPorMes]);

  const mesActual = useMemo(
    () => pedidosPorMes.find((m) => m.key === selectedMonth) || null,
    [pedidosPorMes, selectedMonth]
  );

  // ---------------------------
  // PDF (con logo)
  // ---------------------------
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

  const generarReportePDFDelMes = async () => {
    if (!mesActual) {
      setMessage("No hay mes seleccionado para generar reporte.");
      return;
    }

    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginX = 40;

      const empresaNombre = micro?.razon_social || micro?.nombre || micro?.name || "Microempresa";
      const titulo = `Reporte de pedidos — ${mesActual.label}`;
      const generado = new Date().toLocaleString();

      // Logo (si existe, no bloquea si falla)
      let y = 40;
      const logoUrl = getMicroLogoUrl();
      let logoDrawn = false;

      if (logoUrl) {
        try {
          const dataUrl = await fetchImageAsDataUrl(logoUrl);
          const format = String(dataUrl).startsWith("data:image/png") ? "PNG" : "JPEG";
          doc.addImage(dataUrl, format, marginX, y, 64, 64);
          logoDrawn = true;
        } catch {
          logoDrawn = false;
        }
      }

      doc.setFontSize(16);
      doc.text(empresaNombre, logoDrawn ? marginX + 78 : marginX, y + 20);

      doc.setFontSize(12);
      doc.text(titulo, logoDrawn ? marginX + 78 : marginX, y + 40);

      doc.setFontSize(10);
      doc.text(`Generado: ${generado}`, logoDrawn ? marginX + 78 : marginX, y + 58);

      y += 90;

      // Resumen
      doc.setFontSize(12);
      doc.text("Resumen", marginX, y);
      y += 16;

      doc.setFontSize(10);
      doc.text(`Cantidad de pedidos: ${mesActual.count}`, marginX, y);
      doc.text(`Total del mes: ${formatMoney(mesActual.total)}`, marginX + 240, y);
      y += 14;

      // Resumen por estado_envio
      const porEstado = {};
      (mesActual.pedidos || []).forEach((p) => {
        const st = p?.estado_envio || p?.estado || "—";
        porEstado[st] = (porEstado[st] || 0) + 1;
      });
      const estadoLine = Object.entries(porEstado)
        .slice(0, 8)
        .map(([k, v]) => `${k}: ${v}`)
        .join("  |  ");
      if (estadoLine) {
        doc.text(`Por estado: ${estadoLine}`, marginX, y);
        y += 14;
      }

      y += 8;

      // Tabla
      const rows = (mesActual.pedidos || []).map((p) => {
        const fecha = p?.created_at ? new Date(p.created_at).toLocaleString() : "-";
        const cliente = p?.cliente_nombre || p?.cliente_email || "Sin cliente";
        const estado = p?.estado_envio || p?.estado || "-";
        const total = `Bs ${Number(p?.total || 0).toFixed(2)}`;
        const comprob = p?.comprobante_url ? "Sí" : "No";
        return [`#${p?.id_venta}`, fecha, cliente, estado, total, comprob];
      });

      autoTable(doc, {
        head: [["Pedido", "Fecha", "Cliente", "Estado", "Total", "Comprobante"]],
        body: rows,
        styles: { fontSize: 9, cellPadding: 4 },
        margin: { left: marginX, right: marginX },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 110 },
          2: { cellWidth: 140 },
          3: { cellWidth: 85 },
          4: { cellWidth: 70, halign: "right" },
          5: { cellWidth: 70 },
        },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
          doc.setFontSize(9);
          doc.text(`Página ${currentPage} / ${pageCount}`, pageW - marginX, pageH - 20, { align: "right" });
        },
      });

      openPdf(doc, `reporte_pedidos_${mesActual.key}.pdf`);
      setMessage("Reporte PDF generado.");
    } catch (e) {
      setMessage(e?.message || "No se pudo generar el reporte PDF.");
    }
  };

  // ---------------------------
  // Acciones existentes
  // ---------------------------
  const handleEmpaquetar = async (ventaId) => {
    setMessage("");

    const opcionesUI = (opcionesEntrega[ventaId] || []).length ? opcionesEntrega[ventaId] : [];
    if (!opcionesUI.length) {
      setMessage("Agrega al menos una opcion de entrega.");
      return;
    }

    for (const opt of opcionesUI) {
      if (!opt.fecha || !opt.hora_inicio || !opt.hora_fin || !opt.lugar_texto || !opt.maps_url) {
        setMessage("Completa fecha, rango de hora, lugar y link de maps.");
        return;
      }
    }

    //  Solo mandar campos que backend espera (ignorar maps_query)
    const opciones = opcionesUI.map(({ fecha, hora_inicio, hora_fin, lugar_texto, maps_url }) => ({
      fecha,
      hora_inicio,
      hora_fin,
      lugar_texto,
      maps_url,
    }));

    setActionLock((prev) => ({ ...prev, [ventaId]: "empaquetado" }));
    const { response, data } = await marcarEmpaquetado(ventaId, { opciones });

    if (!response.ok) {
      setMessage(data.error || "No se pudo actualizar.");
      setActionLock((prev) => {
        const next = { ...prev };
        delete next[ventaId];
        return next;
      });
      return;
    }

    setMessage("Pedido marcado como empaquetado y en envío.");
    setOpcionesEntrega((prev) => {
      const next = { ...prev };
      delete next[ventaId];
      return next;
    });
    await load();
  };

  const updateOpcion = (ventaId, index, field, value) => {
    setOpcionesEntrega((prev) => {
      const current = prev[ventaId]?.length ? prev[ventaId] : [{ ...emptyOpcion }];
      const next = current.map((opt, idx) => (idx === index ? { ...opt, [field]: value } : opt));
      return { ...prev, [ventaId]: next };
    });
  };

  const addOpcion = (ventaId) => {
    setOpcionesEntrega((prev) => {
      const current = prev[ventaId]?.length ? prev[ventaId] : [{ ...emptyOpcion }];
      return { ...prev, [ventaId]: [...current, { ...emptyOpcion }] };
    });
  };

  const removeOpcion = (ventaId, index) => {
    setOpcionesEntrega((prev) => {
      const current = prev[ventaId]?.length ? prev[ventaId] : [{ ...emptyOpcion }];
      const next = current.filter((_, idx) => idx !== index);
      return { ...prev, [ventaId]: next.length ? next : [{ ...emptyOpcion }] };
    });
  };

  const handleRechazar = async (ventaId) => {
    setMessage("");
    setActionLock((prev) => ({ ...prev, [ventaId]: "rechazado" }));
    const { response, data } = await rechazarVenta(ventaId);
    if (!response.ok) {
      setMessage(data.error || "No se pudo rechazar.");
      setActionLock((prev) => {
        const next = { ...prev };
        delete next[ventaId];
        return next;
      });
      return;
    }
    setMessage("Pedido rechazado.");
    await load();
  };

  const closePreview = () => {
    if (previewFile?.url) URL.revokeObjectURL(previewFile.url);
    setPreviewFile(null);
  };

  const handleVerComprobante = async (ventaId) => {
    setMessage("");
    const url = `${API_BASE}/api/ventas/${ventaId}/comprobante/download`;
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error || "No se pudo abrir el comprobante.");
        return;
      }
      const contentType = res.headers.get("content-type") || "";
      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      setPreviewFile({
        url: objectUrl,
        title: "Comprobante",
        isPdf: contentType.includes("pdf"),
      });
    } catch (err) {
      setMessage(err?.message || "No se pudo abrir el comprobante.");
    }
  };

  // ---------------------------
  // Render
  // ---------------------------
  return (
    <SectionCard title="Pedidos virtuales" description="Revisa comprobantes y prepara envios.">
      <div className="card">
      <ToastModal
          open={toast.open}
          message={toast.message}
          variant={toast.variant}
          duration={10000}
          onClose={() => setToast({ open: false, message: "", variant: "success" })}
      />

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

        {/*  Selector de mes + botón PDF */}
        <div
          style={{
            marginBottom: 14,
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
              {pedidosPorMes.length === 0 ? (
                <option value="">Sin pedidos</option>
              ) : (
                pedidosPorMes.map((m) => (
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
            <div className="muted">{mesActual ? `${mesActual.count} pedido(s)` : ""}</div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={generarReportePDFDelMes} disabled={!mesActual}>
              Reporte PDF del mes
            </button>
          </div>
        </div>

        <div className="pedidos-list">
          {!mesActual || mesActual.pedidos.length === 0 ? (
            <p className="muted">No hay pedidos en este mes.</p>
          ) : (
            mesActual.pedidos.map((pedido) => {
              const entrega = pedido.entrega || (pedido.entregas || [])[0];
              const seleccionId = entrega?.seleccion_opcion_id;
              const seleccion = (entrega?.opciones || []).find((o) => String(o.id_opcion) === String(seleccionId));

              const opciones =
                opcionesEntrega[pedido.id_venta]?.length
                  ? opcionesEntrega[pedido.id_venta]
                  : entrega?.opciones?.length
                  ? entrega.opciones.map((opt) => ({
                      fecha: opt.fecha || "",
                      hora_inicio: opt.hora_inicio || "",
                      hora_fin: opt.hora_fin || "",
                      lugar_texto: opt.lugar_texto || "",
                      maps_url: opt.maps_url || "",
                      maps_query: "",
                    }))
                  : [{ ...emptyOpcion }];

              return (
                <div key={pedido.id_venta} className="pedido-card">
                  <div className="pedido-head">
                    <div>
                      <strong>Pedido #{pedido.id_venta}</strong>
                      <div className="muted">{pedido.created_at ? new Date(pedido.created_at).toLocaleString() : "-"}</div>
                    </div>
                    <span className={`status-pill ${pedido.estado_envio === "empaquetado" ? "active" : ""}`}>
                      {pedido.estado_envio}
                    </span>
                  </div>

                  <div className="pedido-body">
                    <div>
                      <div className="muted">Cliente</div>
                      <div>{pedido.cliente_nombre || pedido.cliente_email || "Sin cliente"}</div>
                    </div>
                    <div>
                      <div className="muted">Total</div>
                      <div>{formatMoney(pedido.total || 0)}</div>
                    </div>
                    <div>
                      <div className="muted">Comprobante</div>
                      {pedido.comprobante_url ? (
                        <button type="button" className="link-button" onClick={() => handleVerComprobante(pedido.id_venta)}>
                          Ver comprobante
                        </button>
                      ) : (
                        <span className="muted">Pendiente</span>
                      )}
                    </div>
                  </div>

                  <div className="pedido-items">
                    {(pedido.items || []).map((item) => (
                      <div key={item.id_item} className="pedido-item">
                        <span>{item.nombre}</span>
                        <span>x{item.cantidad}</span>
                        <span>{formatMoney(item.subtotal || 0)}</span>
                      </div>
                    ))}
                  </div>

                  {(pedido.estado_envio === "empaquetado" || pedido.estado_envio === "entregado") && (
                    <div className="card" style={{ boxShadow: "none" }}>
                      <div className="form-title">Entrega seleccionada</div>
                      {seleccion ? (
                        <div className="muted">
                          {seleccion.fecha} {seleccion.hora_inicio} - {seleccion.hora_fin} - {seleccion.lugar_texto} (
                          <a href={seleccion.maps_url} target="_blank" rel="noopener noreferrer">
                            Ver mapa
                          </a>
                          )
                        </div>
                      ) : (
                        <div className="muted">Esperando selección del cliente.</div>
                      )}
                    </div>
                  )}

                  <div className="pedido-actions">
                    {(() => {
                      const locked = actionLock[pedido.id_venta];
                      if (locked === "empaquetado") return <span className="muted">Pedido marcado como empaquetado.</span>;
                      if (locked === "rechazado") return <span className="muted">Pedido denegado.</span>;

                      // Crear opciones (pagado/pendiente)
                      if (pedido.estado_envio === "pagado" || pedido.estado_envio === "pendiente") {
                        return (
                          <>
                            <div className="card" style={{ boxShadow: "none" }}>
                              <div className="form-title">Opciones de entrega</div>
                              <div style={{ display: "grid", gap: 10 }}>
                                {opciones.map((opt, idx) => (
                                  <div key={`${pedido.id_venta}-${idx}`} className="pos-client-grid">
                                    <label>
                                      Fecha
                                      <input
                                        type="date"
                                        value={opt.fecha}
                                        onChange={(e) => updateOpcion(pedido.id_venta, idx, "fecha", e.target.value)}
                                      />
                                    </label>

                                    <label>
                                      Hora inicio
                                      <input
                                        type="time"
                                        value={opt.hora_inicio}
                                        onChange={(e) => updateOpcion(pedido.id_venta, idx, "hora_inicio", e.target.value)}
                                      />
                                    </label>

                                    <label>
                                      Hora fin
                                      <input
                                        type="time"
                                        value={opt.hora_fin}
                                        onChange={(e) => updateOpcion(pedido.id_venta, idx, "hora_fin", e.target.value)}
                                      />
                                    </label>

                                    <label>
                                      Lugar
                                      <input
                                        value={opt.lugar_texto}
                                        onChange={(e) => updateOpcion(pedido.id_venta, idx, "lugar_texto", e.target.value)}
                                      />
                                    </label>

                                    <label>
                                      Link Maps
                                      <input
                                        value={opt.maps_url}
                                        onChange={(e) => updateOpcion(pedido.id_venta, idx, "maps_url", e.target.value)}
                                        placeholder="Se autollena con el mapa"
                                      />
                                      <MapPicker
                                        mapsUrl={opt.maps_url}
                                        onChangeMapsUrl={(url) => updateOpcion(pedido.id_venta, idx, "maps_url", url)}
                                      />
                                    </label>

                                    <div style={{ display: "flex", alignItems: "flex-end" }}>
                                      <button
                                        type="button"
                                        className="ghost-button"
                                        onClick={() => removeOpcion(pedido.id_venta, idx)}
                                      >
                                        Quitar
                                      </button>
                                    </div>
                                  </div>
                                ))}

                                <button type="button" className="ghost-button" onClick={() => addOpcion(pedido.id_venta)}>
                                  Agregar lugar
                                </button>
                              </div>
                            </div>

                            <button type="button" className="primary-button" onClick={() => handleEmpaquetar(pedido.id_venta)}>
                              Marcar empaquetado y en envio
                            </button>

                            <button type="button" className="danger-button" onClick={() => handleRechazar(pedido.id_venta)}>
                              Denegar pedido
                            </button>
                          </>
                        );
                      }

                      // Reprogramar (si ya está empaquetado)
                      if (pedido.estado_envio === "empaquetado") {
                        return (
                          <>
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() =>
                                setReprogramOpen((prev) => ({
                                  ...prev,
                                  [pedido.id_venta]: !prev[pedido.id_venta],
                                }))
                              }
                            >
                              Reprogramar
                            </button>

                            {reprogramOpen[pedido.id_venta] && (
                              <div className="card" style={{ boxShadow: "none" }}>
                                <div className="form-title">Nuevas opciones</div>
                                <div style={{ display: "grid", gap: 10 }}>
                                  {opciones.map((opt, idx) => (
                                    <div key={`${pedido.id_venta}-r-${idx}`} className="pos-client-grid">
                                      <label>
                                        Fecha
                                        <input
                                          type="date"
                                          value={opt.fecha}
                                          onChange={(e) => updateOpcion(pedido.id_venta, idx, "fecha", e.target.value)}
                                        />
                                      </label>

                                      <label>
                                        Hora inicio
                                        <input
                                          type="time"
                                          value={opt.hora_inicio}
                                          onChange={(e) => updateOpcion(pedido.id_venta, idx, "hora_inicio", e.target.value)}
                                        />
                                      </label>

                                      <label>
                                        Hora fin
                                        <input
                                          type="time"
                                          value={opt.hora_fin}
                                          onChange={(e) => updateOpcion(pedido.id_venta, idx, "hora_fin", e.target.value)}
                                        />
                                      </label>

                                      <label>
                                        Lugar
                                        <input
                                          value={opt.lugar_texto}
                                          onChange={(e) => updateOpcion(pedido.id_venta, idx, "lugar_texto", e.target.value)}
                                        />
                                      </label>

                                      <label>
                                        Link Maps
                                        <input
                                          value={opt.maps_url}
                                          onChange={(e) => updateOpcion(pedido.id_venta, idx, "maps_url", e.target.value)}
                                          placeholder="Se autollena con el mapa"
                                        />
                                        <MapPicker
                                          mapsUrl={opt.maps_url}
                                          onChangeMapsUrl={(url) => updateOpcion(pedido.id_venta, idx, "maps_url", url)}
                                        />
                                      </label>

                                      <div style={{ display: "flex", alignItems: "flex-end" }}>
                                        <button
                                          type="button"
                                          className="ghost-button"
                                          onClick={() => removeOpcion(pedido.id_venta, idx)}
                                        >
                                          Quitar
                                        </button>
                                      </div>
                                    </div>
                                  ))}

                                  <button type="button" className="ghost-button" onClick={() => addOpcion(pedido.id_venta)}>
                                    Agregar lugar
                                  </button>
                                </div>

                                <button type="button" className="primary-button" onClick={() => handleEmpaquetar(pedido.id_venta)}>
                                  Enviar nuevas opciones
                                </button>
                              </div>
                            )}
                          </>
                        );
                      }

                      if (pedido.estado_envio === "rechazado") return <span className="muted">Pedido denegado.</span>;

                      return <span className="muted">Estado actualizado</span>;
                    })()}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </SectionCard>
  );
};

export default MicroempresaPedidos;
