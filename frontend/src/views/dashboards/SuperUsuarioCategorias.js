import React, { useEffect, useState } from "react";
import SectionCard from "../SectionCard";
import {
  activateCategoria,
  createCategoria,
  deactivateCategoria,
  fetchCategorias,
  updateCategoria,
} from "../../controllers/categoriaController";
import ToastModal from "../ToastModal";

const emptyForm = { nombre: "" };

const SuperUsuarioCategorias = () => {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState({ open: false, message: "", variant: "success" });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editNombre, setEditNombre] = useState("");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { response, data } = await fetchCategorias();
      if (!response.ok) {
        setMessage(data.error || "No se pudo cargar categorias.");
        setCategorias([]);
        return;
      }
      setCategorias(data.categorias || []);
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

  const handleCreate = async (event) => {
    event.preventDefault();
    setMessage("");
    const payload = { nombre: (form.nombre || "").trim() };
    if (!payload.nombre) {
      setMessage("Nombre requerido");
      return;
    }
    const { response, data } = await createCategoria(payload);
    if (!response.ok) {
      setMessage(data.error || "No se pudo crear.");
      return;
    }
    setForm(emptyForm);
    setMessage("Categoria creada.");
    await load();
  };

  const startEdit = (categoria) => {
    setEditingId(categoria.id_categoria);
    setEditNombre(categoria.nombre || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditNombre("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const payload = { nombre: (editNombre || "").trim() };
    if (!payload.nombre) {
      setMessage("Nombre requerido");
      return;
    }
    const { response, data } = await updateCategoria(editingId, payload);
    if (!response.ok) {
      setMessage(data.error || "No se pudo actualizar.");
      return;
    }
    setMessage("Categoria actualizada.");
    cancelEdit();
    await load();
  };

  const deactivate = async (id) => {
    const { response, data } = await deactivateCategoria(id);
    if (!response.ok) {
      setMessage(data.error || "No se pudo inactivar.");
      return;
    }
    setMessage("Categoria inactivada.");
    await load();
  };

  const activate = async (id) => {
    const { response, data } = await activateCategoria(id);
    if (!response.ok) {
      setMessage(data.error || "No se pudo activar.");
      return;
    }
    setMessage("Categoria activada.");
    await load();
  };

  return (
    <SectionCard title="Categorias" description="Crea, edita y da de baja las categorias globales.">
      <div className="card">
        <form onSubmit={handleCreate} style={{ display: "grid", gap: 12, marginBottom: 16 }}>
          <label>
            <span className="form-title">Nueva categoria</span>
            <input
              value={form.nombre}
              onChange={(e) => setForm({ nombre: e.target.value })}
              placeholder="Nombre de categoria"
            />
          </label>
          <button type="submit" disabled={loading}>
            Crear categoria
          </button>
        </form>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <input
            placeholder="Buscar categoria"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 220 }}
          />
          <button type="button" className="ghost-button" onClick={load} disabled={loading}>
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

        <div className="data-list" style={{ marginTop: 16 }}>
          {categorias.length === 0 ? (
            <p className="muted">No hay categorias.</p>
          ) : (
            categorias
              .filter((categoria) => {
                const term = String(search || "").trim().toLowerCase();
                if (!term) return true;
                return String(categoria.nombre || "").toLowerCase().includes(term);
              })
              .map((categoria) => {
              const isEditing = editingId === categoria.id_categoria;
              return (
                <div key={categoria.id_categoria} className="data-row" style={{ alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <strong>{categoria.nombre}</strong>
                    <div className="muted">Estado: {categoria.estado}</div>
                  </div>
                  <div className="row-actions">
                    {isEditing ? (
                      <>
                        <input
                          value={editNombre}
                          onChange={(e) => setEditNombre(e.target.value)}
                          style={{ maxWidth: 220 }}
                        />
                        <button type="button" className="link-button" onClick={saveEdit}>
                          Guardar
                        </button>
                        <button type="button" className="ghost-button" onClick={cancelEdit}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="ghost-button" onClick={() => startEdit(categoria)}>
                          Editar
                        </button>
                        {categoria.estado === "activo" ? (
                          <button type="button" className="danger-button" onClick={() => deactivate(categoria.id_categoria)}>
                            Inactivar
                          </button>
                        ) : (
                          <button type="button" className="ghost-button" onClick={() => activate(categoria.id_categoria)}>
                            Activar
                          </button>
                        )}
                      </>
                    )}
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

export default SuperUsuarioCategorias;
