import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SectionCard from "../SectionCard";
import { createPlanAdmin } from "../../controllers/subscriptionController";
import ToastModal from "../ToastModal";

export default function SuperUsuarioPlanCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [toast, setToast] = useState({ open: false, message: "", variant: "success" });

  const [form, setForm] = useState({
    nombre: "",
    precio: "",
    estado: "activo",
    caracteristicas: ["", ""], // ✅ inicia con 2
  });

  const setFeature = (idx, value) => {
    setForm((p) => {
      const next = [...p.caracteristicas];
      next[idx] = value;
      return { ...p, caracteristicas: next };
    });
  };

  const addFeature = () => {
    setForm((p) => ({ ...p, caracteristicas: [...p.caracteristicas, ""] }));
  };

  const removeFeature = (idx) => {
    setForm((p) => {
      const next = p.caracteristicas.filter((_, i) => i !== idx);
      return { ...p, caracteristicas: next.length ? next : ["", ""] };
    });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");

    const payload = {
      nombre: (form.nombre || "").trim(),
      precio: form.precio,
      estado: form.estado || "activo",
      caracteristicas: (form.caracteristicas || [])
        .map((x) => (x || "").trim())
        .filter(Boolean),
    };

    setLoading(true);
    try {
      const { response, data } = await createPlanAdmin(payload);
      if (!response.ok) {
        setMsg(data.error || "No se pudo crear el plan.");
        return;
      }
      navigate("/planes", { state: { flash: data.message || "Plan creado." } });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!msg) return;
    const lower = String(msg || "").toLowerCase();
    const variant = lower.includes("no") || lower.includes("error") ? "warning" : "success";
    setToast({ open: true, message: msg, variant });
  }, [msg]);

  return (
    <SectionCard title="Crear plan" description="Crea un plan del sistema.">
      <div className="card">
        <ToastModal
          open={toast.open}
          message={toast.message}
          variant={toast.variant}
          duration={10000}
          onClose={() => setToast({ open: false, message: "", variant: "success" })}
        />

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <label>
            Nombre
            <input
              value={form.nombre}
              onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
              required
            />
          </label>

          <label>
            Precio
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.precio}
              onChange={(e) => setForm((p) => ({ ...p, precio: e.target.value }))}
              required
            />
          </label>

          <label>
            Estado
            <select
              value={form.estado}
              onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value }))}
            >
              <option value="activo">activo</option>
              <option value="inactivo">inactivo</option>
            </select>
          </label>

          <div>
            <div className="muted" style={{ marginBottom: 8 }}>
              Características del plan
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              {form.caracteristicas.map((val, idx) => (
                <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    value={val}
                    onChange={(e) => setFeature(idx, e.target.value)}
                    placeholder={`Característica ${idx + 1}`}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => removeFeature(idx)}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 10 }}>
              <button type="button" className="link-button" onClick={addFeature}>
                + Agregar característica
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" className="link-button" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => navigate("/planes")}
              disabled={loading}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </SectionCard>
  );
}
