import React, { useEffect, useMemo, useState } from "react";
import SectionCard from "../SectionCard";
import ToastModal from "../ToastModal";
import {
  fetchProveedores,
  createProveedor,
  updateProveedor,
  activateProveedor,
  deactivateProveedor,
} from "../../controllers/proveedorController";

const emptyForm = {
  nombre: "",
  direccion: "",
  email: "",
  estado: "activo",
};

const MicroempresaProveedores = () => {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState({ open: false, message: "", variant: "success" });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [fullText, setFullText] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { response, data } = await fetchProveedores();
      if (response.ok) setProveedores(data.proveedores || []);
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

  const shouldTruncate = (value, limit = 28) => String(value || "").length > limit;

  const openFullText = (title, value) => {
    if (!value) return;
    setFullText({ title, value });
  };

  const closeFullText = () => setFullText(null);

  const renderTruncated = (value, title) => {
    const text = String(value || "");
    if (!text) return <span>-</span>;
    const showButton = shouldTruncate(text);
    return (
      <div className="truncate-row">
        <span className="truncate-text">{text}</span>
        {showButton && (
          <button
            type="button"
            className="ellipsis-button"
            aria-label={`Ver ${title}`}
            onClick={() => openFullText(title, text)}
          >
            ...
          </button>
        )}
      </div>
    );
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return proveedores;
    return proveedores.filter((p) =>
      [p.nombre, p.email, p.direccion].filter(Boolean).join(" ").toLowerCase().includes(term)
    );
  }, [proveedores, search]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setMessage("");
    if (!form.nombre.trim()) {
      setMessage("Nombre requerido.");
      return;
    }
    const payload = {
      nombre: form.nombre.trim(),
      direccion: form.direccion.trim(),
      email: form.email.trim(),
      estado: form.estado || "activo",
    };
    const { response, data } = await createProveedor(payload);
    if (!response.ok) {
      setMessage(data.error || "No se pudo crear.");
      return;
    }
    setMessage("Proveedor creado.");
    setForm(emptyForm);
    setShowForm(false);
    await load();
  };

  const startEdit = (proveedor) => {
    setEditingId(proveedor.id_proveedor);
    setEditForm({
      nombre: proveedor.nombre || "",
      direccion: proveedor.direccion || "",
      email: proveedor.email || "",
      estado: proveedor.estado || "activo",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyForm);
  };

  const saveEdit = async (proveedor) => {
    const payload = {
      nombre: (editForm.nombre || "").trim(),
      direccion: (editForm.direccion || "").trim(),
      email: (editForm.email || "").trim(),
      estado: editForm.estado || "activo",
    };
    if (!payload.nombre) {
      setMessage("Nombre requerido.");
      return;
    }
    const { response, data } = await updateProveedor(proveedor.id_proveedor, payload);
    if (!response.ok) {
      setMessage(data.error || "No se pudo actualizar.");
      return;
    }
    setMessage("Proveedor actualizado.");
    cancelEdit();
    await load();
  };

  const toggleEstado = async (proveedor) => {
    const id = proveedor.id_proveedor;
    if (proveedor.estado === "activo") {
      const { response, data } = await deactivateProveedor(id);
      if (!response.ok) {
        setMessage(data.error || "No se pudo inactivar.");
        return;
      }
      setMessage("Proveedor inactivado.");
    } else {
      const { response, data } = await activateProveedor(id);
      if (!response.ok) {
        setMessage(data.error || "No se pudo activar.");
        return;
      }
      setMessage("Proveedor activado.");
    }
    await load();
  };

  return (
    <SectionCard title="Proveedores" description="Registra y gestiona proveedores de tu microempresa.">
      <div className="card">
        <div style={{ display: "flex", gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
          <label style={{ minWidth: 240 }}>
            <span className="form-title">Buscar</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar proveedor"
            />
          </label>
          <button type="button" className="ghost-button" onClick={() => setShowForm((prev) => !prev)}>
            {showForm ? "Ocultar formulario" : "Registrar proveedor"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} style={{ display: "grid", gap: 10, marginTop: 16 }}>
            <input
              placeholder="Nombre"
              value={form.nombre}
              onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
            />
            <input
              placeholder="Direccion"
              value={form.direccion}
              onChange={(e) => setForm((prev) => ({ ...prev, direccion: e.target.value }))}
            />
            <input
              placeholder="Contactos"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
            <button type="submit" disabled={loading}>
              Guardar
            </button>
          </form>
        )}

        <ToastModal
          open={toast.open}
          message={toast.message}
          variant={toast.variant}
          duration={10000}
          onClose={() => setToast({ open: false, message: "", variant: "success" })}
        />

        <div style={{ marginTop: 16 }}>
          {filtered.length === 0 ? (
            <p className="muted">No hay proveedores.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860, tableLayout: "fixed" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "center", padding: "10px 12px" }}>Nombre</th>
                    <th style={{ textAlign: "center", padding: "10px 12px" }}>Direccion</th>
                    <th style={{ textAlign: "center", padding: "10px 12px" }}>Contactos</th>
                    <th style={{ textAlign: "center", padding: "10px 12px" }}>Estado</th>
                    <th style={{ textAlign: "center", padding: "10px 12px" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((proveedor) => {
                    const isEditing = editingId === proveedor.id_proveedor;
                    return (
                      <tr key={proveedor.id_proveedor}>
                        {!isEditing ? (
                          <>
                            <td style={{ textAlign: "center", padding: "10px 12px" }}>
                              {renderTruncated(proveedor.nombre, "Nombre")}
                            </td>
                            <td style={{ textAlign: "center", padding: "10px 12px" }}>
                              {renderTruncated(proveedor.direccion, "Direccion")}
                            </td>
                            <td style={{ textAlign: "center", padding: "10px 12px" }}>
                              {renderTruncated(proveedor.email, "Contactos")}
                            </td>
                            <td style={{ textAlign: "center", padding: "10px 12px" }}>
                              <span className={proveedor.estado === "activo" ? "status-pill active" : "status-pill"}>
                                {proveedor.estado}
                              </span>
                            </td>
                            <td style={{ textAlign: "center", padding: "10px 12px" }}>
                              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                                <button type="button" onClick={() => startEdit(proveedor)}>
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className={proveedor.estado === "activo" ? "danger-button" : "ghost-button"}
                                  onClick={() => toggleEstado(proveedor)}
                                >
                                  {proveedor.estado === "activo" ? "Inactivar" : "Activar"}
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ textAlign: "center", padding: "10px 12px" }}>
                              <input
                                value={editForm.nombre}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, nombre: e.target.value }))}
                              />
                            </td>
                            <td style={{ textAlign: "center", padding: "10px 12px" }}>
                              <input
                                value={editForm.direccion}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, direccion: e.target.value }))}
                              />
                            </td>
                            <td style={{ textAlign: "center", padding: "10px 12px" }}>
                              <input
                                value={editForm.email}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                              />
                            </td>
                            <td style={{ textAlign: "center", padding: "10px 12px" }}>
                              <span className={proveedor.estado === "activo" ? "status-pill active" : "status-pill"}>
                                {proveedor.estado}
                              </span>
                            </td>
                            <td style={{ textAlign: "center", padding: "10px 12px" }}>
                              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                                <button type="button" onClick={() => saveEdit(proveedor)}>
                                  Guardar
                                </button>
                                <button type="button" className="ghost-button" onClick={cancelEdit}>
                                  Cancelar
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {fullText && (
        <div className="text-modal" onClick={closeFullText}>
          <div className="text-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="form-title">{fullText.title}</div>
            <div className="text-modal-body">{fullText.value}</div>
            <button type="button" className="ghost-button" onClick={closeFullText}>
              Volver
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
};

export default MicroempresaProveedores;
