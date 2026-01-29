import React, { useEffect, useMemo, useState } from "react";
import SectionCard from "../SectionCard";
import ToastModal from "../ToastModal";
import { fetchProductos, createProducto, updateProducto } from "../../controllers/productoController";
import { fetchProveedores, createProveedor } from "../../controllers/proveedorController";
import { createCompra } from "../../controllers/compraController";
import { fetchCategoriasActivas } from "../../controllers/categoriaController";
import { resolveAssetUrl } from "../../utils/url";

const API_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:5000").replace(/\/$/, "");

const emptyProducto = {
  nombre: "",
  descripcion: "",
  precio_unitario: "",
  precio_compra: "",
  stock: "0",
  stock_minimo: "",
  categoria_ids: [],
};
const emptyProveedor = { nombre: "", direccion: "", contactos: "" };

const MicroempresaCompras = () => {
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [proveedorSearch, setProveedorSearch] = useState("");
  const [productoSearch, setProductoSearch] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [precioCompra, setPrecioCompra] = useState("");
  const [lote, setLote] = useState("");
  const [cart, setCart] = useState([]);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState({ open: false, message: "", variant: "success" });
  const [showProveedorForm, setShowProveedorForm] = useState(false);
  const [showProductoForm, setShowProductoForm] = useState(false);
  const [proveedorForm, setProveedorForm] = useState(emptyProveedor);
  const [productoForm, setProductoForm] = useState(emptyProducto);
  const [categorias, setCategorias] = useState([]);
  const [newFotos, setNewFotos] = useState([]);
  const [priceEditOpen, setPriceEditOpen] = useState(false);
  const [priceEditLoading, setPriceEditLoading] = useState(false);
  const [priceEdit, setPriceEdit] = useState({ precio_compra: "", precio_venta: "" });
  const [creatingProducto, setCreatingProducto] = useState(false);


  const load = async () => {
    const [pRes, provRes, catRes] = await Promise.all([
      fetchProductos(),
      fetchProveedores(),
      fetchCategoriasActivas(),
    ]);
    if (pRes.response.ok) setProductos(pRes.data.productos || []);
    if (provRes.response.ok) setProveedores(provRes.data.proveedores || []);
    if (catRes.response.ok) setCategorias(catRes.data.categorias || []);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!message) return;
    const lower = String(message).toLowerCase();
    const variant = lower.includes("no") || lower.includes("error") ? "warning" : "success";
    setToast({ open: true, message, variant });
  }, [message]);

  const filteredProveedores = useMemo(() => {
    const term = proveedorSearch.trim().toLowerCase();
    return proveedores.filter((p) => {
      if ((p.estado || "").toLowerCase() !== "activo") return false;
      if (!term) return true;
      return String(p.nombre || "").toLowerCase().includes(term);
    });
  }, [proveedores, proveedorSearch]);

  const filteredProductos = useMemo(() => {
    const term = productoSearch.trim().toLowerCase();
    return productos.filter((p) => {
      if (proveedorId && String(p.proveedor_id) !== String(proveedorId)) return false;
      if (!term) return true;
      return String(p.nombre || "").toLowerCase().includes(term);
    });
  }, [productos, productoSearch, proveedorId]);

  useEffect(() => {
    if (!proveedorId) return;
    if (productoId) {
      const selected = productos.find((p) => String(p.id_producto) === String(productoId));
      if (selected && String(selected.proveedor_id) !== String(proveedorId)) {
        setProductoId("");
      }
    }
  }, [proveedorId, productoId, productos]);


  const selectedProducto = productos.find((p) => String(p.id_producto) === String(productoId));

  useEffect(() => {
    if (!selectedProducto) {
      setPriceEditOpen(false);
      return;
    }
    const compra = selectedProducto.precio_compra ?? "";
    const venta = selectedProducto.precio_unitario ?? "";
    setPrecioCompra(compra === 0 ? "0" : String(compra || ""));
    setPriceEdit({
      precio_compra: compra === 0 ? "0" : String(compra || ""),
      precio_venta: venta === 0 ? "0" : String(venta || ""),
    });
    setPriceEditOpen(false);
  }, [selectedProducto?.id_producto]);

  const total = cart.reduce((sum, item) => sum + item.subtotal, 0);

  const resetItemForm = () => {
    setProductoId("");
    setCantidad(1);
    setPrecioCompra("");
    setLote("");
  };

  const addItem = () => {
    if (!proveedorId) {
      setMessage("Selecciona un proveedor.");
      return;
    }
    if (!productoId) {
      setMessage("Selecciona un producto.");
      return;
    }
    const qty = Number(cantidad);
    const price = Number(precioCompra);
    if (!qty || qty <= 0) {
      setMessage("Cantidad invalida.");
      return;
    }
    if (!price || price <= 0) {
      setMessage("Precio de compra invalido.");
      return;
    }
    const producto = productos.find((p) => String(p.id_producto) === String(productoId));
    if (!producto) {
      setMessage("Producto no encontrado.");
      return;
    }

    const existing = cart.find((c) => String(c.id_producto) === String(productoId));
    const subtotal = qty * price;
    if (existing) {
      const next = cart.map((c) =>
        String(c.id_producto) === String(productoId)
          ? {
              ...c,
              cantidad: c.cantidad + qty,
              precio_unitario: price,
              subtotal: (c.cantidad + qty) * price,
              lote: lote || c.lote,
            }
          : c
      );
      setCart(next);
    } else {
      setCart([
        ...cart,
        {
          id_producto: producto.id_producto,
          nombre: producto.nombre,
          cantidad: qty,
          precio_unitario: price,
          subtotal,
          lote: lote || "",
        },
      ]);
    }
    resetItemForm();
  };

  const removeItem = (id) => setCart(cart.filter((c) => String(c.id_producto) !== String(id)));
  const updateItemCantidad = (id, nextCantidad) => {
    const qty = Number(nextCantidad);
    if (!qty || qty <= 0) {
      removeItem(id);
      return;
    }
    setCart((prev) =>
      prev.map((c) =>
        String(c.id_producto) === String(id)
          ? { ...c, cantidad: qty, subtotal: qty * Number(c.precio_unitario || 0) }
          : c
      )
    );
  };
  const bumpItemCantidad = (id, delta) => {
    const item = cart.find((c) => String(c.id_producto) === String(id));
    if (!item) return;
    updateItemCantidad(id, Number(item.cantidad || 0) + delta);
  };

  const handleCreateProveedor = async () => {
    if (!proveedorForm.nombre.trim()) {
      setMessage("Nombre de proveedor requerido.");
      return;
    }
    const payload = {
      nombre: proveedorForm.nombre.trim(),
      direccion: proveedorForm.direccion.trim(),
      email: proveedorForm.contactos.trim(),
    };
    const { response, data } = await createProveedor(payload);
    if (!response.ok) {
      setMessage(data.error || "No se pudo crear el proveedor.");
      return;
    }
    const proveedor = data.proveedor;
    setProveedores((prev) => [...prev, proveedor]);
    setProveedorId(String(proveedor.id_proveedor));
    setProveedorForm(emptyProveedor);
    setShowProveedorForm(false);
    setMessage("Proveedor registrado.");
  };

  const handleCreateProducto = async () => {
  // Evita múltiples envíos por doble click/lag
  if (creatingProducto) return;

  setMessage("");
  if (!proveedorId) {
    setMessage("Selecciona un proveedor para crear el producto.");
    return;
  }
  if (!productoForm.nombre.trim()) {
    setMessage("Nombre de producto requerido.");
    return;
  }

  const precioVenta = Number(productoForm.precio_unitario);
  if (!precioVenta || precioVenta <= 0) {
    setMessage("Precio de venta invalido.");
    return;
  }
  const precioCompraProducto = Number(productoForm.precio_compra);
  if (!precioCompraProducto || precioCompraProducto <= 0) {
    setMessage("Precio de compra invalido.");
    return;
  }
  if (precioCompraProducto >= precioVenta) {
    setMessage("El precio de compra debe ser menor al precio de venta.");
    return;
  }
  const stockMinimoValue = Number(productoForm.stock_minimo || 0);
  if (Number.isNaN(stockMinimoValue) || stockMinimoValue < 0) {
    setMessage("Stock minimo invalido.");
    return;
  }

  const payload = {
    nombre: productoForm.nombre.trim(),
    descripcion: (productoForm.descripcion || "").trim(),
    precio_unitario: precioVenta,
    precio_compra: precioCompraProducto,
    stock: 0,
    stock_minimo: stockMinimoValue,
    estado: "activo",
    proveedor_id: Number(proveedorId),
    categoria_ids: productoForm.categoria_ids.map((id) => Number(id)),
  };

  setCreatingProducto(true);
  try {
    const { response, data } = await createProducto(payload);
    if (!response.ok) {
      setMessage(data.error || "No se pudo crear el producto.");
      return;
    }

    const producto = data.producto;

    // Subir fotos si hay (no crea duplicados)
    if (producto?.id_producto && newFotos.length > 0) {
      for (const foto of newFotos) {
        if (!foto?.file) continue;
        const formData = new FormData();
        formData.append("file", foto.file);
        await fetch(`${API_BASE}/api/productos/${producto.id_producto}/fotos`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });
      }
    }

    // En lugar de "insertar a mano" (que puede duplicar),
    // recargamos desde el backend para mantener una sola fuente de verdad
    await load();

    // Selecciona el producto recién creado
    if (producto?.id_producto) {
      setProductoId(String(producto.id_producto));
      setCantidad(1);
      setPrecioCompra(String(precioCompraProducto));
    }

    setProductoForm(emptyProducto);
    newFotos.forEach((foto) => URL.revokeObjectURL(foto.preview));
    setNewFotos([]);
    setShowProductoForm(false);
    setMessage("Producto registrado.");
  } finally {
    setCreatingProducto(false);
  }
};


  const handleUpdatePrecios = async () => {
    if (!selectedProducto) return;
    const precioVenta = Number(priceEdit.precio_venta);
    const precioCompraNuevo = Number(priceEdit.precio_compra);
    if (!precioVenta || precioVenta <= 0) {
      setMessage("Precio de venta invalido.");
      return;
    }
    if (!precioCompraNuevo || precioCompraNuevo <= 0) {
      setMessage("Precio de compra invalido.");
      return;
    }
    if (precioCompraNuevo >= precioVenta) {
      setMessage("El precio de compra debe ser menor al precio de venta.");
      return;
    }
    setPriceEditLoading(true);
    const { response, data } = await updateProducto(selectedProducto.id_producto, {
      precio_unitario: precioVenta,
      precio_compra: precioCompraNuevo,
    });
    setPriceEditLoading(false);
    if (!response.ok) {
      setMessage(data.error || "No se pudo actualizar los precios.");
      return;
    }
    setProductos((prev) =>
      prev.map((p) =>
        String(p.id_producto) === String(selectedProducto.id_producto)
          ? { ...p, precio_unitario: precioVenta, precio_compra: precioCompraNuevo }
          : p
      )
    );
    setPrecioCompra(String(precioCompraNuevo));
    setPriceEditOpen(false);
    setMessage("Precios actualizados.");
  };

  const toggleCategoria = (current, id) => {
    if (current.includes(id)) {
      return current.filter((item) => item !== id);
    }
    return [...current, id];
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

  const confirmCompra = async () => {
    if (!proveedorId) {
      setMessage("Selecciona un proveedor.");
      return;
    }
    if (cart.length === 0) {
      setMessage("Agrega productos al carrito.");
      return;
    }

    const payload = {
      proveedor_id: Number(proveedorId),
      items: cart.map((c) => ({
        id_producto: c.id_producto,
        cantidad: c.cantidad,
        precio_unitario: c.precio_unitario,
        subtotal: c.subtotal,
        lote: c.lote || "",
      })),
    };

    const { response, data } = await createCompra(payload);
    if (!response.ok) {
      setMessage(data.error || "No se pudo registrar la compra.");
      return;
    }

    setMessage("Compra registrada.");
    setCart([]);
    resetItemForm();
    setProveedorId("");
    setProveedorSearch("");
    await load();

    const compra = data.compra;
    if (compra && compra.pdf_url) {
      const url = compra.pdf_url.startsWith("http") ? compra.pdf_url : `${API_BASE}${compra.pdf_url}`;
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <SectionCard title="Compras" description="Registra nuevas compras con proveedor y carrito.">
      <div className="card" style={{ display: "grid", gap: 18 }}>
        <div className="pos-grid">
          <div className="card" style={{ boxShadow: "none" }}>
            <div className="form-title">Nueva compra</div>

            <label>
              Buscar proveedor
              <input
                value={proveedorSearch}
                onChange={(e) => setProveedorSearch(e.target.value)}
                placeholder="Buscar proveedor"
              />
            </label>
            <label>
              Seleccionar proveedor
              <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
                <option value="">Seleccionar</option>
                {filteredProveedores.map((p) => (
                  <option key={p.id_proveedor} value={p.id_proveedor}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="ghost-button" onClick={() => setShowProveedorForm((s) => !s)}>
              {showProveedorForm ? "Ocultar proveedor" : "Registrar proveedor"}
            </button>
            {showProveedorForm && (
              <div className="card" style={{ boxShadow: "none" }}>
                <label>
                  Nombre
                  <input
                    value={proveedorForm.nombre}
                    onChange={(e) => setProveedorForm({ ...proveedorForm, nombre: e.target.value })}
                  />
                </label>
                <label>
                  Direccion
                  <input
                    value={proveedorForm.direccion}
                    onChange={(e) => setProveedorForm({ ...proveedorForm, direccion: e.target.value })}
                  />
                </label>
                <label>
                  Contactos
                  <input
                    value={proveedorForm.contactos}
                    onChange={(e) => setProveedorForm({ ...proveedorForm, contactos: e.target.value })}
                  />
                </label>
                <button type="button" onClick={handleCreateProveedor}>Crear proveedor</button>
              </div>
            )}

            <hr style={{ border: "none", borderTop: "1px solid #eef0f3" }} />

            <label>
              Buscar producto
              <input
                value={productoSearch}
                onChange={(e) => setProductoSearch(e.target.value)}
                placeholder="Buscar producto"
              />
            </label>
            <label>
              Seleccionar producto
              <select value={productoId} onChange={(e) => setProductoId(e.target.value)}>
                <option value="">Seleccionar</option>
                {filteredProductos.map((p) => (
                  <option key={p.id_producto} value={p.id_producto}>
                    {`${p.nombre} | Bs ${Number(p.precio_unitario || 0).toFixed(2)}`}
                  </option>
                ))}
              </select>
            </label>
            {selectedProducto && (
              <div className="selected-product-card">
                <div className="selected-product-media">
                  {selectedProducto.fotos?.[0]?.url ? (
                    <img
                      src={resolveAssetUrl(selectedProducto.fotos[0].url)}
                      alt={selectedProducto.nombre}
                      className="selected-product-image"
                    />
                  ) : (
                    <div className="selected-product-placeholder">Sin foto</div>
                  )}
                </div>
                <div className="selected-product-info">
                  <div className="form-title">{selectedProducto.nombre}</div>
                  <div className="selected-product-prices">
                    <div>Venta: Bs {Number(selectedProducto.precio_unitario || 0).toFixed(2)}</div>
                    <div>Compra: Bs {Number(selectedProducto.precio_compra || 0).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            )}
            {selectedProducto && !priceEditOpen && (
              <div className="selected-product-actions">
                <button type="button" className="link-button" onClick={() => setPriceEditOpen(true)}>
                  Cambiar precios
                </button>
              </div>
            )}
            {selectedProducto && priceEditOpen && (
              <div className="card" style={{ boxShadow: "none" }}>
                <div className="form-title">Actualizar precios</div>
                <div className="pos-client-grid">
                  <label>
                    Precio venta
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={priceEdit.precio_venta}
                      onChange={(e) => setPriceEdit({ ...priceEdit, precio_venta: e.target.value })}
                    />
                  </label>
                  <label>
                    Precio compra
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={priceEdit.precio_compra}
                      onChange={(e) => setPriceEdit({ ...priceEdit, precio_compra: e.target.value })}
                    />
                  </label>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" className="primary-button" onClick={handleUpdatePrecios} disabled={priceEditLoading}>
                    {priceEditLoading ? "Guardando..." : "Guardar precios"}
                  </button>
                  <button type="button" className="ghost-button" onClick={() => setPriceEditOpen(false)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
            <button type="button" className="ghost-button" onClick={() => setShowProductoForm((s) => !s)}>
              {showProductoForm ? "Ocultar producto" : "Registrar producto"}
            </button>
            {showProductoForm && (
              <div className="card" style={{ boxShadow: "none" }}>
                <label>
                  Nombre
                  <input
                    value={productoForm.nombre}
                    onChange={(e) => setProductoForm({ ...productoForm, nombre: e.target.value })}
                  />
                </label>
                <label>
                  Descripcion
                  <input
                    value={productoForm.descripcion}
                    onChange={(e) => setProductoForm({ ...productoForm, descripcion: e.target.value })}
                  />
                </label>
                <label>
                  Precio venta
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={productoForm.precio_unitario}
                    onChange={(e) => setProductoForm({ ...productoForm, precio_unitario: e.target.value })}
                  />
                </label>
                <label>
                  Precio compra
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={productoForm.precio_compra}
                    onChange={(e) => {
                      const value = e.target.value;
                      setProductoForm({ ...productoForm, precio_compra: value });
                    }}
                  />
                </label>
                <label>
                  Stock minimo
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={productoForm.stock_minimo}
                    onChange={(e) => setProductoForm({ ...productoForm, stock_minimo: e.target.value })}
                  />
                </label>
                {categorias.length > 0 && (
                  <div>
                    <div className="form-title">Categorias</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                      {categorias.map((categoria) => (
                        <label key={categoria.id_categoria} className="radio-option">
                          <input
                            type="checkbox"
                            checked={productoForm.categoria_ids.includes(categoria.id_categoria)}
                            onChange={() =>
                              setProductoForm((prev) => ({
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
                )}
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
                <button type="button" onClick={handleCreateProducto}>Crear producto</button>
              </div>
            )}

            <div className="pos-client-grid" style={{ marginTop: 8 }}>
              <label>
                Cantidad
                <input type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
              </label>
              <label>
                Precio compra
                <input
                  type="number"
                  value={precioCompra}
                  disabled={Boolean(selectedProducto)}
                  onChange={(e) => setPrecioCompra(e.target.value)}
                />
              </label>
              <label>
                Lote (opcional)
                <input value={lote} onChange={(e) => setLote(e.target.value)} />
              </label>
            </div>

            <button type="button" className="primary-button" onClick={addItem}>
              Agregar al carrito
            </button>
          </div>

          <div className="card" style={{ boxShadow: "none" }}>
            <div className="form-title">Carrito de compras</div>
            {cart.length === 0 ? (
              <p className="muted">No hay productos agregados.</p>
            ) : (
              <div className="data-list">
                {cart.map((item) => (
                  <div key={item.id_producto} className="data-row">
                    <div>
                      <strong>{item.nombre}</strong>
                      <div className="muted">
                        Cantidad: {item.cantidad}
                        <div style={{ display: "inline-flex", gap: 6, marginLeft: 8 }}>
                          <button type="button" className="ghost-button" onClick={() => bumpItemCantidad(item.id_producto, -1)}>
                            -
                          </button>
                          <button type="button" className="ghost-button" onClick={() => bumpItemCantidad(item.id_producto, 1)}>
                            +
                          </button>
                        </div>
                      </div>
                      <div className="muted">Precio: Bs {Number(item.precio_unitario).toFixed(2)}</div>
                      {item.lote ? <div className="muted">Lote: {item.lote}</div> : null}
                    </div>
                    <div>
                      <div>Bs {Number(item.subtotal).toFixed(2)}</div>
                      <button type="button" className="link-button" onClick={() => removeItem(item.id_producto)}>
                        Quitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="pos-total">
              <span>Total</span>
              <span>Bs {Number(total || 0).toFixed(2)}</span>
            </div>
            <button type="button" className="primary-button" onClick={confirmCompra}>
              Confirmar compra
            </button>
          </div>
        </div>
      </div>

      <ToastModal
        open={toast.open}
        message={toast.message}
        variant={toast.variant}
        duration={10000}
        onClose={() => setToast({ open: false, message: "", variant: "success" })}
      />
    </SectionCard>
  );
};

export default MicroempresaCompras;
