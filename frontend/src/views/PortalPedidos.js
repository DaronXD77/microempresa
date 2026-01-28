import React, { useEffect, useState } from "react";
import { fetchMisPedidos, marcarEntregado, seleccionarEntrega } from "../controllers/ventaController";
import ToastModal from "./ToastModal";

const PortalPedidos = () => {
  const [pedidos, setPedidos] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState({ open: false, message: "", variant: "success" });

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

  const renderTracker = (estado) => {
    if (estado === "rechazado") {
      return (
        <div className="status-tracker">
          <div className="tracker-step active">rechazado</div>
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
                        {pedido.created_at ? new Date(pedido.created_at).toLocaleString() : "-"}
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
                      const entrega = pedido.entrega || (pedido.entregas || [])[0];
                      const opciones = entrega?.opciones || [];
                      const seleccionId = entrega?.seleccion_opcion_id;
                      const seleccionAt = entrega?.seleccion_at ? new Date(entrega.seleccion_at).getTime() : null;
                      const seleccion = opciones.find((o) => String(o.id_opcion) === String(seleccionId));
                      if (pedido.estado_envio === "entregado") {
                        return <span className="muted">Pedido terminado</span>;
                      }
                      if (pedido.estado_envio !== "empaquetado") {
                        return <span className="muted">Esperando actualizacion</span>;
                      }
                      const now = Date.now();
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
                          {ready ? (
                            <button type="button" className="primary-button" onClick={() => handleEntregar(pedido)}>
                              Marcar entregado
                            </button>
                          ) : (
                            <span className="muted">
                              El botÃ³n se habilita en {remainingMin ?? 5} min.
                            </span>
                          )}
                        </div>
                      );
                    })()}
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
