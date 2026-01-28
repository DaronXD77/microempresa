import React, { useEffect, useState } from "react";
import SectionCard from "../SectionCard";
import {
  fetchPendingMicroempresas,
  approvePendingMicroempresa,
  rejectPendingMicroempresa,
} from "../../controllers/subscriptionController";
import ToastModal from "../ToastModal";

export default function SuperUsuarioPendientes({ reloadDashboard }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState({ open: false, message: "", variant: "success" });

  // Construye link absoluto al backend para abrir comprobante
  const buildProofLink = (proofUrlOrPath) => {
    if (!proofUrlOrPath) return null;

    const base = (process.env.REACT_APP_API_BASE || "http://localhost:5000").replace(
      /\/$/,
      ""
    );

    // ya absoluto
    if (proofUrlOrPath.startsWith("http")) return proofUrlOrPath;

    // si viene como "api/..."
    if (proofUrlOrPath.startsWith("api/")) return `${base}/${proofUrlOrPath}`;

    // si viene como "/api/..."
    if (proofUrlOrPath.startsWith("/")) return `${base}${proofUrlOrPath}`;

    // cualquier otro caso
    return `${base}/${proofUrlOrPath}`;
  };

  const load = async () => {
    setLoading(true);
    setMessage("");

    try {
      const { response, data } = await fetchPendingMicroempresas();

      if (!response.ok) {
        setItems([]);
        setMessage(data.error || "No se pudo cargar la lista de pendientes.");
        return;
      }

      // backend esperado: { pendientes: [...] }
      setItems(data.pendientes || []);
    } finally {
      setLoading(false);
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

  const approve = async (tenantId, nombre) => {
    setMessage("");
    const { response, data } = await approvePendingMicroempresa(tenantId);

    if (!response.ok) {
      setToast({
        open: true,
        message: data.error || "No se pudo aprobar.",
        variant: "warning",
      });
      return;
    }

    const nombreLabel = nombre ? ` (${nombre})` : "";
    setToast({
      open: true,
      message: data.message || `Microempresa aprobada${nombreLabel}.`,
      variant: "success",
    });
    await load();
    if (reloadDashboard) await reloadDashboard();
  };

  const reject = async (tenantId, nombre) => {
    setMessage("");
    const { response, data } = await rejectPendingMicroempresa(tenantId);

    if (!response.ok) {
      setToast({
        open: true,
        message: data.error || "No se pudo rechazar.",
        variant: "warning",
      });
      return;
    }

    const nombreLabel = nombre ? ` (${nombre})` : "";
    setToast({
      open: true,
      message: data.message || `Microempresa rechazada${nombreLabel}.`,
      variant: "success",
    });
    await load();
    if (reloadDashboard) await reloadDashboard();
  };

  return (
    <SectionCard
      title="Microempresas en espera"
      description="Revisa comprobantes y valida cuentas."
    >
      <div className="card">
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <button
            type="button"
            className="ghost-button"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Recargar"}
          </button>
        </div>

        <ToastModal
          open={toast.open}
          message={toast.message}
          variant={toast.variant}
          duration={10000}
          onClose={() => setToast({ open: false, message: "", variant: "success" })}
        />

        {items.length === 0 ? (
          <p className="muted">No hay microempresas en espera.</p>
        ) : (
          <div className="data-list">
            {items.map((it) => {
              const micro = it.microempresa || {};
              const plan = it.plan || null;

              // Probamos varios nombres posibles que podría mandar el backend
              const proofHref = buildProofLink(
                it.proof_url ||
                  it.comprobante_url ||
                  it.comprobante_path ||
                  null
              );

              return (
                <div
                  className="data-row"
                  key={it.suscripcion_id || it.tenant_id}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {micro.nombre || "Microempresa"}
                    </div>
                    <div className="muted">{micro.email || "-"}</div>
                    <div className="muted">
                      Estado: {micro.estado || it.estado || "en_espera"}
                    </div>

                    {plan && (
                      <div className="muted" style={{ marginTop: 6 }}>
                        Plan: <strong>{plan.nombre}</strong> — Monto:{" "}
                        <strong>{plan.precio}</strong>
                      </div>
                    )}

                    {proofHref ? (
                      <div style={{ marginTop: 8 }}>
                        <a href={proofHref} target="_blank" rel="noreferrer">
                          Ver comprobante
                        </a>
                      </div>
                    ) : (
                      <div className="muted" style={{ marginTop: 8 }}>
                        (Sin link de comprobante: el backend debe devolver comprobante_url o proof_url)
                      </div>
                    )}
                  </div>

                  <div className="row-actions" style={{ gap: 8 }}>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => approve(it.tenant_id, micro.nombre)}
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => reject(it.tenant_id, micro.nombre)}
                    >
                      Rechazar
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
}
