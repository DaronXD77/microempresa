import React, { useEffect, useState } from "react";
import { cancelarVenta, fetchMisPedidos, marcarEntregado, seleccionarEntrega } from "../controllers/ventaController";
import ToastModal from "./ToastModal";
import { formatDateTimeLaPaz } from "../utils/date";

const PortalPedidos = () => {
  const [pedidos, setPedidos] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState({ open: false, message: "", variant: "success" });
  const [previewFile, setPreviewFile] = useState(null);
  const API_BASE = (process.env.REACT_APP_API_BASE || "").replace(/\/$/, "");

  const load = async () => {
    const { response, data } = await fetchMisPedidos();
    if (response.ok) {
      setPedidos(data.pedidos || []);
    }
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

  const visiblePedidos = pedidos.filter((pedido) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (pedido.items || []).some((item) =>
      String(item.nombre || "").toLowerCase().includes(term)
    );
  });

  const handleEntregar = async (pedido) => {
    const { response, data } = await marcarEntregado(pedido.id_venta, pedido.public_token);
    if (!response.ok) {
      setMessage(data.error || "No se pudo actualizar.");
      return;
    }
    setMessage("Pedido terminado.");
    await load();
  };

  const handleSeleccionar = async (pedido, opcionId) => {
    const { response, data } = await seleccionarEntrega(pedido.id_venta, opcionId, pedido.public_token);
    if (!response.ok) {
      setMessage(data.error || "No se pudo seleccionar la entrega.");
      return;
    }
    setMessage("Opcion seleccionada.");
    await load();
  };

  const closePreview = () => {
    if (previewFile?.url) URL.revokeObjectURL(previewFile.url);
    setPreviewFile(null);
  };

  const handleVerComprobante = async (ventaId) => {
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

  const handleCancelar = async (pedido) => {
    const { response, data } = await cancelarVenta(pedido.id_venta);
    if (!response.ok) {
      setMessage(data.error || "No se pudo cancelar el pedido.");
      return;
    }
    setMessage("Pedido cancelado.");
    await load();
  };

  const buildEmbedSrcFromQuery = (value, fallbackText = "") => {
    const raw = String(value || "").trim();
    const fallback = String(fallbackText || "").trim();
    const toEmbed = (query) => `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
    if (!raw && fallback) return toEmbed(fallback);
    if (!raw) return "";
    if (raw.startsWith("http")) {
      try {
        const url = new URL(raw);
        const q = url.searchParams.get("q") || url.searchParams.get("query");
        if (q) return toEmbed(q);
        const match = url.pathname.match(/\/maps\/place\/([^/]+)/);
        if (match?.[1]) return toEmbed(decodeURIComponent(match[1].replace(/\+/g, " ")));
        if (url.hostname.includes("google.com") && url.pathname.startsWith("/maps")) {
          const withEmbed = raw.includes("output=embed")
            ? raw
            : `${raw}${raw.includes("?") ? "&" : "?"}output=embed`;
          return withEmbed;
        }
      } catch {
        // ignore
      }
      return fallback ? toEmbed(fallback) : raw;
    }
    return toEmbed(raw);
  };

  const isVirtualDireccion = (value) => {
    const text = String(value || "").toLowerCase();
    return text.includes("virtual") || text.includes("sin tienda");
  };

  const isPhysicalStore = (pedido) => {
    const tipo = String(pedido?.microempresa_tipo || "").toLowerCase();
    if (tipo === "fisica") return true;
    if (tipo === "virtual") return false;
    const direccion = String(pedido?.microempresa_direccion || "");
    return direccion && !isVirtualDireccion(direccion);
  };

  const hasMapsLink = (pedido) => {
    const direccion = String(pedido?.microempresa_direccion || "").trim();
    return Boolean(direccion && direccion.startsWith("http"));
  };

  const shouldShowLocalMap = (pedido) =>
    isPhysicalStore(pedido)
    && hasMapsLink(pedido)
    && String(pedido?.microempresa_horario || "").trim();

  const renderTracker = (estado) => {
    if (estado === "rechazado") {
      return (
        <div className="status-tracker">
          <div className="tracker-step active">rechazado</div>
        </div>
      );
    }
    if (estado === "cancelado") {
      return (
        <div className="status-tracker">
          <div className="tracker-step active">cancelado</div>
        </div>
      );
    }
    const steps = ["pagado", "empaquetado", "entregado"];
    const activeIndex = steps.indexOf(estado);
    return (
      <div className="status-tracker">
        {steps.map((step, index) => (
          <div key={step} className={`tracker-step ${index <= activeIndex ? "active" : ""}`}>
            <span>{step}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="portal-page">
      <div className="portal-container">
        <div className="portal-breadcrumb">Mis pedidos</div>
        <div className="card">
          <div className="pedido-search">
            <input
              placeholder="Buscar por nombre de producto"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button type="button" onClick={load}>
              Actualizar
            </button>
          </div>
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

          <div className="pedidos-list">
            {visiblePedidos.length === 0 ? (
              <p className="muted">No hay pedidos registrados.</p>
            ) : (
              visiblePedidos.map((pedido) => (
                <div key={pedido.id_venta} className="pedido-card">
                  <div className="pedido-head">
                    <div>
                      <strong>Pedido #{pedido.id_venta}</strong>
                      <div className="muted">
                        {pedido.created_at ? formatDateTimeLaPaz(pedido.created_at) : "-"}
                      </div>
                    </div>
                    <span className={`status-pill ${pedido.estado_envio === "entregado" ? "active" : ""}`}>
                      {pedido.estado_envio}
                    </span>
                  </div>

                  {renderTracker(pedido.estado_envio)}

                  <div className="pedido-items">
                    {(pedido.items || []).map((item) => (
                      <div key={item.id_item} className="pedido-item">
                        <span>{item.nombre}</span>
                        <span>x{item.cantidad}</span>
                        <span>Bs {Number(item.subtotal || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pedido-actions">
                    {(() => {
                      if (pedido.estado_envio === "rechazado") {
                        return <span className="error">Pedido denegado por la microempresa</span>;
                      }
                      if (pedido.estado_envio === "cancelado") {
                        return <span className="muted">Pedido cancelado</span>;
                      }
                      const entrega = pedido.entrega || (pedido.entregas || [])[0];
                      const opciones = entrega?.opciones || [];
                      const seleccionId = entrega?.seleccion_opcion_id;
                      const seleccionAt = entrega?.seleccion_at ? new Date(entrega.seleccion_at).getTime() : null;
                      const seleccion = opciones.find((o) => String(o.id_opcion) === String(seleccionId));
                      if (pedido.estado_envio === "entregado") {
                        return <span className="muted">Pedido terminado</span>;
                      }
                      const createdAt = pedido.created_at ? new Date(pedido.created_at).getTime() : null;
                      const now = Date.now();
                      const canCancel = createdAt ? now - createdAt <= 5 * 60 * 1000 : false;

                      if (pedido.estado_envio !== "empaquetado") {
                        return (
                          <div style={{ display: "grid", gap: 8 }}>
                            <span className="muted">Esperando actualizacion</span>
                            {canCancel && (
                              <button type="button" className="ghost-button" onClick={() => handleCancelar(pedido)}>
                                Cancelar pedido
                              </button>
                            )}
                          </div>
                        );
                      }
                      const readyAt = seleccionAt ? seleccionAt + 5 * 60 * 1000 : null;
                      const ready = readyAt ? now >= readyAt : false;
                      const remainingMin = readyAt ? Math.max(0, Math.ceil((readyAt - now) / 60000)) : null;

                      if (!seleccionId) {
                        return (
                          <div className="card" style={{ boxShadow: "none" }}>
                            <div className="form-title">Selecciona tu entrega</div>
                            {opciones.length === 0 ? (
                              <div className="muted">Sin opciones disponibles.</div>
                            ) : (
                              <div className="data-list">
                                {opciones.map((opt) => (
                                  <div key={opt.id_opcion} className="data-row">
                                    <div>
                                      <strong>{opt.lugar_texto}</strong>
                                      <div className="muted">
                                        {opt.fecha} {opt.hora_inicio} - {opt.hora_fin}
                                      </div>
                                    </div>
                                    <div className="muted">
                                      <a href={opt.maps_url} target="_blank" rel="noopener noreferrer">
                                        Ver mapa
                                      </a>
                                    </div>
                                    <button
                                      type="button"
                                      className="primary-button"
                                      onClick={() => handleSeleccionar(pedido, opt.id_opcion)}
                                    >
                                      Elegir
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div className="card" style={{ boxShadow: "none" }}>
                          <div className="form-title">Tu entrega</div>
                          {seleccion ? (
                            <div className="muted">
                              {seleccion.fecha} {seleccion.hora_inicio} - {seleccion.hora_fin} - {seleccion.lugar_texto} (
                              <a href={seleccion.maps_url} target="_blank" rel="noopener noreferrer">
                                Ver mapa
                              </a>
                              )
                            </div>
                          ) : (
                            <div className="muted">Opcion seleccionada.</div>
                          )}
                          {seleccion && (
                            <iframe
                              title={`map-entrega-${pedido.id_venta}`}
                              src={buildEmbedSrcFromQuery(seleccion.maps_url, seleccion.lugar_texto)}
                              width="100%"
                              height="200"
                              style={{ border: 0, borderRadius: 10, marginTop: 8 }}
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                            />
                          )}
                          {ready ? (
                            <button type="button" className="primary-button" onClick={() => handleEntregar(pedido)}>
                              Marcar entregado
                            </button>
                          ) : (
                            <span className="muted">
                              El boton se habilita en {remainingMin ?? 5} min.
                            </span>
                          )}
                          {canCancel && (
                            <button type="button" className="ghost-button" onClick={() => handleCancelar(pedido)}>
                              Cancelar pedido
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="pedido-actions" style={{ marginTop: 10 }}>
                    {pedido.comprobante_url ? (
                      <button type="button" className="link-button" onClick={() => handleVerComprobante(pedido.id_venta)}>
                        Ver comprobante
                      </button>
                    ) : (
                      <span className="muted">Comprobante pendiente</span>
                    )}
                  </div>

                    <div className="card" style={{ boxShadow: "none", marginTop: 10 }}>
                      <div className="form-title">Contacto de la microempresa</div>
                      <div className="muted">Email: {pedido.microempresa_email || "-"}</div>
                      <div className="muted">Celular: {pedido.microempresa_telefono || "-"}</div>
                      <div className="muted">
                        Direccion: {isPhysicalStore(pedido)
                          ? pedido.microempresa_direccion || "-"
                          : "Tienda virtual"}
                      </div>
                      {isPhysicalStore(pedido) && pedido.microempresa_horario && (
                        <div className="muted">Horario: {pedido.microempresa_horario}</div>
                      )}
                      {shouldShowLocalMap(pedido) ? (
                        <iframe
                          title={`map-${pedido.id_venta}`}
                          src={buildEmbedSrcFromQuery(pedido.microempresa_direccion)}
                          width="100%"
                          height="200"
                          style={{ border: 0, borderRadius: 10, marginTop: 8 }}
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      ) : null}
                      {isPhysicalStore(pedido) && (
                        <div className="muted" style={{ marginTop: 8 }}>
                          Puedes elegir un lugar y horario de entrega (segun las opciones asignadas por la microempresa o empleado)
                          o pasar a recoger al local en el horario y lugar establecidos.
                        </div>
                      )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortalPedidos;
