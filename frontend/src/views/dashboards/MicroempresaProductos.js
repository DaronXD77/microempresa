import React, { useEffect, useState } from "react";
import SectionCard from "../SectionCard";
import {
  activateProducto,
  createProducto,
  deactivateProducto,
  deleteProductoFoto,
  fetchProductos,
  fetchStockAlerts,
  updateProducto,
  uploadProductoFoto,
} from "../../controllers/productoController";
import { fetchCategoriasActivas } from "../../controllers/categoriaController";
import { fetchProveedores } from "../../controllers/proveedorController";
import ToastModal from "../ToastModal";
import { resolveAssetUrl } from "../utils/url";

const emptyForm = {
  nombre: "",
  descripcion: "",
  precio_unitario: "",
  precio_compra: "",
  proveedor_id: "",
  stock: "0",
  stock_minimo: "0",
  estado: "activo",
  categoria_ids: [],
};

const MicroempresaProductos = () => {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState({ open: false, message: "", variant: "success" });
  const [confirm, setConfirm] = useState({ open: false, message: "", actionLabel: "", onAction: null });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [stockAlerts, setStockAlerts] = useState([]);
  const [newFotos, setNewFotos] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [fullText, setFullText] = useState(null);
  const [proveedorSearch, setProveedorSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [productosRes, categoriasRes, alertsRes, proveedoresRes] = await Promise.all([
        fetchProductos(),
        fetchCategoriasActivas(),
        fetchStockAlerts(),
        fetchProveedores(),
      ]);

      if (productosRes.response.ok) {
        setProductos(productosRes.data.productos || []);
      }
      if (categoriasRes.response.ok) {
        setCategorias(categoriasRes.data.categorias || []);
      }
      if (alertsRes.response.ok) {
        setStockAlerts(alertsRes.data.alerts || []);
      }
      if (proveedoresRes.response.ok) {
        setProveedores(proveedoresRes.data.proveedores || []);
      }
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

  const openConfirm = (messageText, actionLabel, onAction) => {
    setConfirm({ open: true, message: messageText, actionLabel, onAction });
  };
  const closeConfirm = () => setConfirm({ open: false, message: "", actionLabel: "", onAction: null });

  const handleCreate = async (event) => {
    event.preventDefault();
    setMessage("");
    const payload = {
      ...form,
      nombre: (form.nombre || "").trim(),
      descripcion: (form.descripcion || "").trim(),
      precio_unitario: form.precio_unitario,
      precio_compra: form.precio_compra,
      proveedor_id: form.proveedor_id ? Number(form.proveedor_id) : null,
      stock: Number(form.stock || 0),
      stock_minimo: Number(form.stock_minimo || 0),
      categoria_ids: form.categoria_ids.map((id) => Number(id)),
    };
    if (!payload.nombre) {
      setMessage("Nombre requerido");
      return;
    }
    if (
      payload.precio_compra !== "" &&
      payload.precio_compra !== null &&
      Number(payload.precio_compra) >= Number(payload.precio_unitario || 0)
    ) {
      setMessage("El precio de compra debe ser menor al precio de venta.");
      return;
    }
    const { response, data } = await createProducto(payload);
    if (!response.ok) {
      setMessage(data.error || "No se pudo crear.");
      return;
    }
    const productId = data.producto?.id_producto;
    if (productId && newFotos.length > 0) {
      for (const foto of newFotos) {
        if (foto?.file) {
          const formData = new FormData();
          formData.append("file", foto.file);
          await uploadProductoFoto(productId, formData);
        }
      }
    }
    setMessage("Producto creado.");
    setForm(emptyForm);
    setProveedorSearch("");
    newFotos.forEach((foto) => URL.revokeObjectURL(foto.preview));
    setNewFotos([]);
    await load();
  };

  const startEdit = (producto) => {
    setEditingId(producto.id_producto);
    setEditForm({
      nombre: producto.nombre || "",
      descripcion: producto.descripcion || "",
      precio_unitario: String(producto.precio_unitario ?? ""),
      precio_compra: producto.precio_compra != null ? String(producto.precio_compra) : "",
      proveedor_id: producto.proveedor_id ? String(producto.proveedor_id) : "",
      stock: String(producto.stock ?? 0),
      stock_minimo: String(producto.stock_minimo ?? 0),
      estado: producto.estado || "activo",
      categoria_ids: (producto.categorias || []).map((c) => c.id_categoria),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyForm);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const payload = {
      ...editForm,
      nombre: (editForm.nombre || "").trim(),
      descripcion: (editForm.descripcion || "").trim(),
      precio_unitario: editForm.precio_unitario,
      precio_compra: editForm.precio_compra,
      proveedor_id: editForm.proveedor_id ? Number(editForm.proveedor_id) : null,
      stock: Number(editForm.stock || 0),
      stock_minimo: Number(editForm.stock_minimo || 0),
      categoria_ids: editForm.categoria_ids.map((id) => Number(id)),
    };
    if (
      payload.precio_compra !== "" &&
      payload.precio_compra !== null &&
      Number(payload.precio_compra) >= Number(payload.precio_unitario || 0)
    ) {
      setMessage("El precio de compra debe ser menor al precio de venta.");
      return;
    }
    const { response, data } = await updateProducto(editingId, payload);
    if (!response.ok) {
      setMessage(data.error || "No se pudo actualizar.");
      return;
    }
    setMessage("Producto actualizado.");
    cancelEdit();
    await load();
  };

  const deactivate = async (id) => {
    const { response, data } = await deactivateProducto(id);
    if (!response.ok) {
      setMessage(data.error || "No se pudo inactivar.");
      return;
    }
    setMessage("Producto inactivado.");
    await load();
  };

  const activate = async (id) => {
    const { response, data } = await activateProducto(id);
    if (!response.ok) {
      setMessage(data.error || "No se pudo activar.");
      return;
    }
    setMessage("Producto activado.");
    await load();
  };

  const handleFotoUpload = async (productoId, files) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;
    setMessage("");
    for (const file of list) {
      if (!file) continue;
      const formData = new FormData();
      formData.append("file", file);
      const { response, data } = await uploadProductoFoto(productoId, formData);
      if (!response.ok) {
        setMessage(data.error || "No se pudo subir la foto.");
        return;
      }
    }
    setMessage(list.length === 1 ? "Foto agregada." : "Fotos agregadas.");
    await load();
  };

  const handleDeleteFoto = async (productoId, fotoId) => {
    const { response, data } = await deleteProductoFoto(productoId, fotoId);
    if (!response.ok) {
      setMessage(data.error || "No se pudo eliminar la foto.");
      return;
    }
    await load();
  };

  const addNewFotos = (files) => {
    const list = Array.from(files || []).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setNewFotos((prev) => [...prev, ...list]);
  };

  const removeNewFoto = (index) => {
    setNewFotos((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return next;
    });
  };

  const toggleCategoria = (current, id) => {
    if (current.includes(id)) {
      return current.filter((item) => item !== id);
    }
    return [...current, id];
  };

  const filteredProductos = productos.filter((producto) =>
    String(producto.nombre || "")
      .toLowerCase()
      .includes(searchTerm.trim().toLowerCase())
  );

  const shouldTruncate = (value, limit = 28) => String(value || "").length > limit;

  const openFullText = (title, value) => {
    if (!value) return;
    setFullText({ title, value });
  };

  const closeFullText = () => setFullText(null);

  const renderTruncated = (value, title, extraClass = "") => {
    const text = String(value || "");
    if (!text) return <span className={extraClass}>-</span>;
    const showButton = shouldTruncate(text);
    return (
      <div className={`truncate-row ${extraClass}`.trim()}>
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

  const filteredProveedores = proveedores.filter((p) => {
    if ((p.estado || "").toLowerCase() !== "activo") return false;
    const term = proveedorSearch.trim().toLowerCase();
    if (!term) return true;
    return (
      String(p.nombre || "").toLowerCase().includes(term) ||
      String(p.email || "").toLowerCase().includes(term)
    );
  });
  const proveedorMap = new Map();
  proveedores.forEach((p) => proveedorMap.set(String(p.id_proveedor), p));

  return (
    <SectionCard title="Productos" description="Gestiona productos, categorias y fotos.">
      <div className="card">
        {stockAlerts.length > 0 && (
          <div className="stock-alert" style={{ marginBottom: 16 }}>
            <strong>Notificacion:</strong> Productos con stock insuficiente.
            <ul>
              {stockAlerts.map((alert) => (
                <li key={alert.id_producto}>
                  {alert.nombre} (stock {alert.stock})
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div className="form-title">Agregar nuevo producto</div>
          <button type="button" className="ghost-button" onClick={() => setShowCreateForm((prev) => !prev)}>
            {showCreateForm ? "Ocultar formulario" : "Agregar producto"}
          </button>
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreate} style={{ display: "grid", gap: 12, marginBottom: 20 }}>
            <label>
              <span className="form-title">Nombre</span>
              <input
                value={form.nombre}
                onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
                placeholder="Nombre del producto"
              />
            </label>
            <label>
              <span className="form-title">Descripcion</span>
              <input
                value={form.descripcion}
                onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                placeholder="Descripcion breve"
              />
            </label>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <label style={{ minWidth: 180 }}>
                <span className="form-title">Precio venta</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.precio_unitario}
                  onChange={(e) => setForm((prev) => ({ ...prev, precio_unitario: e.target.value }))}
                />
              </label>
              <label style={{ minWidth: 180 }}>
                <span className="form-title">Precio compra</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.precio_compra}
                  onChange={(e) => setForm((prev) => ({ ...prev, precio_compra: e.target.value }))}
                />
              </label>
              <label style={{ minWidth: 160 }}>
                <span className="form-title">Stock</span>
                <input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => setForm((prev) => ({ ...prev, stock: e.target.value }))}
                />
              </label>
              <label style={{ minWidth: 160 }}>
                <span className="form-title">Stock minimo</span>
                <input
                  type="number"
                  min="0"
                  value={form.stock_minimo}
                  onChange={(e) => setForm((prev) => ({ ...prev, stock_minimo: e.target.value }))}
                />
              </label>
            </div>

            <div>
              <div className="form-title">Proveedor</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                <input
                  placeholder="Buscar proveedor"
                  value={proveedorSearch}
                  onChange={(e) => setProveedorSearch(e.target.value)}
                  style={{ minWidth: 220 }}
                />
                <select
                  value={form.proveedor_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, proveedor_id: e.target.value }))}
                >
                  <option value="">Sin proveedor</option>
                  {filteredProveedores.map((p) => (
                    <option key={p.id_proveedor} value={p.id_proveedor}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="form-title">Categorias</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                {categorias.map((categoria) => (
                  <label key={categoria.id_categoria} className="radio-option">
                    <input
                      type="checkbox"
                      checked={form.categoria_ids.includes(categoria.id_categoria)}
                      onChange={() =>
                        setForm((prev) => ({
                          ...prev,
                          categoria_ids: toggleCategoria(prev.categoria_ids, categoria.id_categoria),
                        }))
                      }
                    />
                    <span>{categoria.nombre}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="form-title">Fotos</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                {newFotos.map((foto, index) => (
                  <div key={foto.preview} className="producto-foto-chip">
                    <img src={foto.preview} alt="Nueva foto" />
                    <button type="button" onClick={() => removeNewFoto(index)}>
                      Quitar
                    </button>
                  </div>
                ))}
                <label className="upload-button">
                  <span>Agregar foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      addNewFotos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>

            <button type="submit" disabled={loading}>
              Crear producto
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
        <ToastModal
          open={confirm.open}
          message={confirm.message}
          variant="warning"
          actionLabel={confirm.actionLabel || "Confirmar"}
          duration={10000}
          onClose={closeConfirm}
          onAction={() => {
            if (confirm.onAction) confirm.onAction();
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <label style={{ minWidth: 240 }}>
            <span className="form-title">Buscar</span>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar producto"
            />
          </label>
        </div>

        <div className="producto-table" style={{ marginTop: 16 }}>
          {filteredProductos.length === 0 ? (
            <p className="muted">No hay productos.</p>
          ) : (
            <>
              <div className="producto-table-head">
                <div>Producto</div>
                <div>Proveedor</div>
                <div>Precio venta</div>
                <div>Precio compra</div>
                <div>Stock (Inicial / Actual / Vendidas)</div>
                <div>Stock minimo</div>
                <div>Estado</div>
                <div>Categorias</div>
                <div>Fotos</div>
                <div>Acciones</div>
              </div>
              {filteredProductos.map((producto) => {
                const isEditing = editingId === producto.id_producto;
                const categoriaTexto =
                  (producto.categorias || []).map((cat) => cat.nombre).join(", ") || "Sin categoria";
                const fotos = producto.fotos || [];
                const fotoPreview = fotos.slice(0, 3);
                const extraFotos = fotos.length - fotoPreview.length;
                const proveedor = producto.proveedor_id
                  ? proveedorMap.get(String(producto.proveedor_id))
                  : null;
                const productoLabel = producto.descripcion
                  ? `${producto.nombre || "-"} — ${producto.descripcion}`
                  : producto.nombre || "-";
                const stockInicial = producto.stock_inicial ?? producto.stock ?? 0;
                const stockActual = producto.stock ?? 0;
                const vendidas = Math.max(0, stockInicial - stockActual);
                return (
                  <div key={producto.id_producto} className="producto-table-row">
                    <div className="producto-table-cell">
                      {renderTruncated(productoLabel, "Producto", "strong-text")}
                    </div>
                    <div className="producto-table-cell">{proveedor ? proveedor.nombre : "-"}</div>
                    <div className="producto-table-cell">Bs {producto.precio_unitario}</div>
                    <div className="producto-table-cell">Bs {Number(producto.precio_compra || 0).toFixed(2)}</div>
                    <div className="producto-table-cell">
                      {`Ini: ${stockInicial} | Act: ${stockActual} | Vend: ${vendidas}`}
                    </div>
                    <div className="producto-table-cell">{producto.stock_minimo}</div>
                    <div className="producto-table-cell">
                      <span className={producto.estado === "activo" ? "status-pill active" : "status-pill"}>
                        {producto.estado}
                      </span>
                    </div>
                    <div className="producto-table-cell">
                      {renderTruncated(categoriaTexto, "Categorias")}
                    </div>
                    <div className="producto-table-cell">
                      {fotoPreview.length > 0 ? (
                        <div className="producto-table-thumbs">
                            {fotoPreview.map((foto) => (
                              <img key={foto.id_foto} src={resolveAssetUrl(foto.url)} alt={producto.nombre} />
                            ))}
                          {extraFotos > 0 && <span className="producto-table-thumb-count">+{extraFotos}</span>}
                        </div>
                      ) : (
                        <span className="muted">Sin fotos</span>
                      )}
                    </div>
                    <div className="producto-table-cell producto-table-actions">
                      {isEditing ? (
                        <>
                          <button type="button" className="primary-button" onClick={saveEdit}>
                            Guardar
                          </button>
                          <button type="button" className="ghost-button" onClick={cancelEdit}>
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => openConfirm("¿Quieres editar este producto?", "Editar", () => startEdit(producto))}
                          >
                            Editar
                          </button>
                          {producto.estado === "activo" ? (
                            <button
                              type="button"
                              className="danger-button"
                              onClick={() =>
                                openConfirm(
                                  "¿Inactivar este producto?",
                                  "Inactivar",
                                  () => deactivate(producto.id_producto)
                                )
                              }
                            >
                              Inactivar
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() =>
                                openConfirm(
                                  "¿Activar este producto?",
                                  "Activar",
                                  () => activate(producto.id_producto)
                                )
                              }
                            >
                              Activar
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    <div className="producto-table-details">
                      {isEditing && (
                        <div className="producto-table-edit">
                          <label>
                            <span className="form-title">Nombre</span>
                            <input
                              value={editForm.nombre}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, nombre: e.target.value }))}
                              placeholder="Nombre"
                            />
                          </label>
                          <label>
                            <span className="form-title">Descripcion</span>
                            <input
                              value={editForm.descripcion}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                              placeholder="Descripcion"
                            />
                          </label>
                          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                            <label style={{ minWidth: 160 }}>
                              <span className="form-title">Precio venta</span>
                              <input
                                type="number"
                                value={editForm.precio_unitario}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, precio_unitario: e.target.value }))}
                                placeholder="Precio"
                              />
                            </label>
                            <label style={{ minWidth: 160 }}>
                              <span className="form-title">Precio compra</span>
                              <input
                                type="number"
                                value={editForm.precio_compra}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, precio_compra: e.target.value }))}
                                placeholder="Precio compra"
                              />
                            </label>
                            <label style={{ minWidth: 160 }}>
                              <span className="form-title">Stock</span>
                              <input
                                type="number"
                                value={editForm.stock}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, stock: e.target.value }))}
                                placeholder="Stock"
                              />
                            </label>
                            <label style={{ minWidth: 180 }}>
                              <span className="form-title">Stock minimo</span>
                              <input
                                type="number"
                                value={editForm.stock_minimo}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, stock_minimo: e.target.value }))}
                                placeholder="Stock minimo"
                              />
                            </label>
                          </div>

                          <div>
                            <div className="form-title">Proveedor</div>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                              <select
                                value={editForm.proveedor_id}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, proveedor_id: e.target.value }))}
                              >
                                <option value="">Sin proveedor</option>
                                {proveedores.map((p) => (
                                  <option key={p.id_proveedor} value={p.id_proveedor}>
                                    {p.nombre}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <div className="form-title">Categorias</div>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                              {categorias.map((categoria) => (
                                <label key={categoria.id_categoria} className="radio-option">
                                  <input
                                    type="checkbox"
                                    checked={editForm.categoria_ids.includes(categoria.id_categoria)}
                                    onChange={() =>
                                      setEditForm((prev) => ({
                                        ...prev,
                                        categoria_ids: toggleCategoria(prev.categoria_ids, categoria.id_categoria),
                                      }))
                                    }
                                  />
                                  <span>{categoria.nombre}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {isEditing && (
                        <div className="producto-table-fotos">
                          <div className="form-title">Fotos</div>
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                              {(producto.fotos || []).map((foto) => (
                                <div key={foto.id_foto} className="producto-foto-chip">
                                  <img src={resolveAssetUrl(foto.url)} alt={producto.nombre} />
                                  <button type="button" onClick={() => handleDeleteFoto(producto.id_producto, foto.id_foto)}>
                                    Quitar
                                  </button>
                                </div>
                              ))}
                            <label className="upload-button">
                              <span>Agregar foto</span>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => {
                                  handleFotoUpload(producto.id_producto, e.target.files);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
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

export default MicroempresaProductos;
