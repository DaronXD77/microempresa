import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SectionCard from "../SectionCard";
import {
  fetchAllPlansAdmin,
  updatePlanAdmin,
  deletePlanAdmin,
  fetchSystemQrAdmin,
  uploadSystemQrAdmin,
} from "../../controllers/subscriptionController";
import ToastModal from "../ToastModal";
import { resolveAssetUrl } from "../../utils/url";

export default function SuperUsuarioPlanes() {
  const navigate = useNavigate();
  const location = useLocation();

  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(location.state?.flash || "");
  const [toast, setToast] = useState({ open: false, message: "", variant: "success" });
  const [systemQrUrl, setSystemQrUrl] = useState("");
  const [qrUploading, setQrUploading] = useState(false);
  const [qrPreviewOpen, setQrPreviewOpen] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    nombre: "",
    precio: "",
    estado: "activo",
    caracteristicas: ["", ""],
  });

  const load = async () => {
    setLoading(true);
    try {
      const { response, data } = await fetchAllPlansAdmin();
      if (!response.ok) {
        setMsg(data.error || "No se pudo cargar planes.");
        setPlans([]);
        return;
      }
      setPlans(data.plans || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // limpia flash al volver
    if (location.state?.flash) {
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchSystemQrAdmin()
      .then(({ response, data }) => {
        if (response.ok) setSystemQrUrl(data.qr_url || "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") setQrPreviewOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!msg) return;
    const lower = String(msg || "").toLowerCase();
    const variant = lower.includes("no") || lower.includes("error") ? "warning" : "success";
    setToast({ open: true, message: msg, variant });
  }, [msg]);

  const handleQrUpload = async (file) => {
    if (!file) return;
    setQrUploading(true);
    const { response, data } = await uploadSystemQrAdmin(file);
    setQrUploading(false);
    if (!response.ok) {
      setMsg(data.error || "No se pudo subir el QR.");
      return;
    }
    setSystemQrUrl(data.qr_url || "");
    setMsg("QR actualizado.");
  };

  const startEdit = (p) => {
    const feats = Array.isArray(p.caracteristicas) ? p.caracteristicas : [];
    setEditingId(p.id_plan);
    setEditForm({
      nombre: p.nombre || "",
      precio: String(p.precio ?? ""),
      estado: p.estado || "activo",
      caracteristicas: feats.length ? feats : ["", ""],
    });
    setMsg("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ nombre: "", precio: "", estado: "activo", caracteristicas: ["", ""] });
  };

  const setEditFeature = (idx, value) => {
    setEditForm((p) => {
      const next = [...p.caracteristicas];
      next[idx] = value;
      return { ...p, caracteristicas: next };
    });
  };

  const addEditFeature = () => {
    setEditForm((p) => ({ ...p, caracteristicas: [...p.caracteristicas, ""] }));
  };

  const removeEditFeature = (idx) => {
    setEditForm((p) => {
      const next = p.caracteristicas.filter((_, i) => i !== idx);
      return { ...p, caracteristicas: next.length ? next : ["", ""] };
    });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setMsg("");

    const payload = {
      nombre: (editForm.nombre || "").trim(),
      precio: editForm.precio,
      estado: editForm.estado,
      caracteristicas: (editForm.caracteristicas || [])
        .map((x) => (x || "").trim())
        .filter(Boolean),
    };

    const { response, data } = await updatePlanAdmin(editingId, payload);
    if (!response.ok) {
      setMsg(data.error || "No se pudo actualizar.");
      return;
    }

    setMsg(data.message || "Actualizado.");
    cancelEdit();
    await load();
  };

  const deactivateLogical = async (planId) => {
    setMsg("");
    const { response, data } = await deletePlanAdmin(planId);
    if (!response.ok) {
      setMsg(data.error || "No se pudo desactivar.");
      return;
    }
    setMsg(data.message || "Plan desactivado.");
    await load();
  };

  const activate = async (planId) => {
    setMsg("");
    const { response, data } = await updatePlanAdmin(planId, { estado: "activo" });
    if (!response.ok) {
      setMsg(data.error || "No se pudo activar.");
      return;
    }
    setMsg(data.message || "Plan activado.");
    await load();
  };

  return (
    <SectionCard title="Planes" description="Crea, edita y desactiva planes del sistema.">
      <div className="card">
        <div className="form-title">QR para registro de microempresas</div>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          {systemQrUrl ? (
            <img
              src={resolveAssetUrl(systemQrUrl)}
              alt="QR del sistema"
              style={{ width: 140, height: 140, objectFit: "contain", borderRadius: 12, border: "1px solid #e5e7eb", cursor: "zoom-in" }}
              onClick={() => setQrPreviewOpen(true)}
            />
          ) : (
            <div className="muted">Sin QR cargado</div>
          )}
          <label className="upload-button">
            <span>{qrUploading ? "Subiendo..." : "Agregar QR"}</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                handleQrUpload(e.target.files?.[0] || null);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {qrPreviewOpen && systemQrUrl && (
          <div className="image-modal" onClick={() => setQrPreviewOpen(false)}>
            <div className="image-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="image-modal-title">QR del sistema</div>
              <img src={resolveAssetUrl(systemQrUrl)} alt="QR del sistema" />
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <button type="button" className="ghost-button" onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Recargar"}
          </button>
          <button type="button" className="link-button" onClick={() => navigate("/planes/nuevo")}>
            Crear plan
          </button>
        </div>

        <ToastModal
          open={toast.open}
          message={toast.message}
          variant={toast.variant}
          duration={10000}
          onClose={() => setToast({ open: false, message: "", variant: "success" })}
        />

        {plans.length === 0 ? (
          <p className="muted">No hay planes.</p>
        ) : (
          <div className="data-list" style={{ display: "grid", gap: 12 }}>
            {plans.map((p) => {
              const isEditing = editingId === p.id_plan;
              const isActive = (p.estado || "").toLowerCase() === "activo";
              const feats = Array.isArray(p.caracteristicas) ? p.caracteristicas : [];

              return (
                <div className="plan-card" key={p.id_plan}>
                  <div className="plan-card-header">
                    <div style={{ fontWeight: 800, fontSize: 22 }}>{p.nombre}</div>
                    <div style={{ fontSize: 16, opacity: 0.95 }}>Bs {p.precio}</div>
                  </div>

                  <div className="plan-card-body">
                    {!isEditing ? (
                      <>
                        <div className="muted">Estado: {p.estado}</div>

                        {feats.length > 0 && (
                          <ul className="plan-features">
                            {feats.map((f, idx) => (
                              <li key={idx}>{f}</li>
                            ))}
                          </ul>
                        )}
                      </>
                    ) : (
                      <div style={{ display: "grid", gap: 10 }}>
                        <div>
                          <div className="muted" style={{ marginBottom: 6 }}>Nombre</div>
                          <input
                            value={editForm.nombre}
                            onChange={(e) => setEditForm((s) => ({ ...s, nombre: e.target.value }))}
                          />
                        </div>

                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <div style={{ width: 180 }}>
                            <div className="muted" style={{ marginBottom: 6 }}>Precio</div>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editForm.precio}
                              onChange={(e) => setEditForm((s) => ({ ...s, precio: e.target.value }))}
                            />
                          </div>

                          <div style={{ width: 180 }}>
                            <div className="muted" style={{ marginBottom: 6 }}>Estado</div>
                            <select
                              value={editForm.estado}
                              onChange={(e) => setEditForm((s) => ({ ...s, estado: e.target.value }))}
                            >
                              <option value="activo">activo</option>
                              <option value="inactivo">inactivo</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <div className="muted" style={{ marginBottom: 6 }}>Características</div>
                          <div style={{ display: "grid", gap: 8 }}>
                            {editForm.caracteristicas.map((val, idx) => (
                              <div key={idx} style={{ display: "flex", gap: 8 }}>
                                <input
                                  value={val}
                                  onChange={(e) => setEditFeature(idx, e.target.value)}
                                  placeholder={`Característica ${idx + 1}`}
                                  style={{ flex: 1 }}
                                />
                                <button
                                  type="button"
                                  className="ghost-button"
                                  onClick={() => removeEditFeature(idx)}
                                >
                                  Quitar
                                </button>
                              </div>
                            ))}
                          </div>

                          <div style={{ marginTop: 10 }}>
                            <button type="button" className="link-button" onClick={addEditFeature}>
                              + Agregar característica
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="row-actions" style={{ gap: 8, marginTop: 12 }}>
                      {!isEditing ? (
                        <>
                          <button type="button" className="ghost-button" onClick={() => startEdit(p)}>
                            Editar
                          </button>

                          {isActive ? (
                            <button type="button" className="danger-button" onClick={() => deactivateLogical(p.id_plan)}>
                              Desactivar
                            </button>
                          ) : (
                            <button type="button" className="ghost-button" onClick={() => activate(p.id_plan)}>
                              Activar
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <button type="button" className="link-button" onClick={saveEdit}>
                            Guardar
                          </button>
                          <button type="button" className="ghost-button" onClick={cancelEdit}>
                            Cancelar
                          </button>
                        </>
                      )}
                    </div>
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
