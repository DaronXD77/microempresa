import React, { useEffect, useMemo, useState } from "react";
import SectionCard from "../SectionCard";
import { fetchProductos } from "../../controllers/productoController";
import { crearVentaPos, subirComprobante } from "../../controllers/ventaController";
import { fetchMe } from "../../controllers/authController";
import { fetchClientes } from "../../controllers/clienteController";
import ToastModal from "../ToastModal";
import { resolveAssetUrl } from "../../utils/url";

const emptyCliente = {
  nombre: "",
  apellido_paterno: "",
  apellido_materno: "",
  ci: "",
  email: "",
  es_empresa: false,
  razon_social: "",
};

const MicroempresaPOS = () => {
  const [productos, setProductos] = useState([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState([]);
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [cliente, setCliente] = useState(emptyCliente);
  const [toast, setToast] = useState({ open: false, message: "", variant: "success", onAction: null });
  const [micro, setMicro] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [clienteSearch, setClienteSearch] = useState("");
  const [selectedClienteId, setSelectedClienteId] = useState("");
  const [clienteMode, setClienteMode] = useState("nuevo"); // nuevo | persona | empresa
  const [ciInput, setCiInput] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [qrFile, setQrFile] = useState(null);
  const [pendingVentaId, setPendingVentaId] = useState(null);

  const normalize = (value) => String(value || "").trim().toLowerCase();
  const buildFullName = (c) =>
    [c?.nombre, c?.apellido_paterno, c?.apellido_materno].filter(Boolean).join(" ").trim();

  const findClienteByEmail = (value) => {
    const email = normalize(value);
    if (!email) return null;
    return clientes.find((c) => normalize(c.email) === email) || null;
  };

  const findClienteByCi = (value) => {
    const ci = normalize(value);
    if (!ci) return null;
    return clientes.find((c) => normalize(c.ci) === ci) || null;
  };

  const findClienteByName = (value) => {
    const name = normalize(value);
    if (!name) return null;
    return (
      clientes.find((c) => normalize(buildFullName(c)) === name) ||
      clientes.find((c) => normalize(buildFullName(c)).includes(name)) ||
      clientes.find((c) => normalize(c.nombre).startsWith(name)) ||
      null
    );
  };

  const load = async () => {
    const [productosRes, meRes, clientesRes] = await Promise.all([
      fetchProductos(),
      fetchMe(),
      fetchClientes(),
    ]);
    if (productosRes.response.ok) {
      setProductos(productosRes.data.productos || []);
    }
    if (meRes.response.ok) {
      setMicro(meRes.data.user || null);
    }
    if (clientesRes.response.ok) {
      setClientes(clientesRes.data.clientes || []);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setPreviewImage(null);
        setPreviewTitle("");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const visibleProductos = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return productos;
    return productos.filter((p) => String(p.nombre || "").toLowerCase().includes(term));
  }, [productos, search]);

  const resolveImageUrl = (producto) =>
    resolveAssetUrl(producto?.fotos?.[0]?.url || producto?.microempresa?.logo_url || "");

  const addToCart = (producto) => {
    setCart((prev) => {
      const stock = producto?.stock;
      if (typeof stock === "number" && stock >= 0) {
        const existing = prev.find((item) => item.id_producto === producto.id_producto);
        const nextQty = (existing?.cantidad || 0) + 1;
        if (nextQty > stock) {
          setToast({ open: true, message: "Stock insuficiente para este producto.", variant: "warning", onAction: null });
          return prev;
        }
      }
      const next = [...prev];
      const existing = next.find((item) => item.id_producto === producto.id_producto);
      if (existing) {
        existing.cantidad += 1;
      } else {
        next.push({
          id_producto: producto.id_producto,
          nombre: producto.nombre,
          precio_unitario: producto.precio_unitario,
          stock: producto.stock,
          cantidad: 1,
        });
      }
      return [...next];
    });
  };

  const updateCantidad = (id, cantidad) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id_producto !== id) return item;
        const stock = item.stock;
        const nextQty = Math.max(1, Number(cantidad || 1));
        if (typeof stock === "number" && stock >= 0 && nextQty > stock) {
          setToast({ open: true, message: "Stock insuficiente para este producto.", variant: "warning", onAction: null });
          return item;
        }
        return { ...item, cantidad: nextQty };
      })
    );
  };

  const removeItem = (id) => {
    setCart((prev) => prev.filter((item) => item.id_producto !== id));
  };

  const total = cart.reduce((sum, item) => sum + Number(item.precio_unitario || 0) * item.cantidad, 0);

  const handleVenta = async () => {
    if (cart.length === 0) {
      setToast({ open: true, message: "Agrega productos al carrito.", variant: "warning", onAction: null });
      return;
    }
    if (cliente.email && !String(cliente.ci || "").trim()) {
      setToast({ open: true, message: "CI requerido para el cliente.", variant: "warning", onAction: null });
      return;
    }
    if (metodoPago === "qr" && !qrFile) {
      setToast({ open: true, message: "Debes subir el comprobante para continuar.", variant: "warning", onAction: null });
      return;
    }

    const payload = {
      metodo_pago: metodoPago,
      items: cart.map((item) => ({
        id_producto: item.id_producto,
        cantidad: item.cantidad,
      })),
      cliente: cliente.email ? cliente : undefined,
    };

    if (metodoPago === "qr" && pendingVentaId) {
      const formData = new FormData();
      formData.append("file", qrFile);
      const res = await subirComprobante(pendingVentaId, formData);
      if (!res.response.ok) {
        setToast({
          open: true,
          message: res.data.error || "No se pudo subir el comprobante. Intenta nuevamente.",
          variant: "warning",
          onAction: null,
        });
        return;
      }
      setPendingVentaId(null);
      setQrFile(null);
      setToast({ open: true, message: "Venta registrada correctamente.", variant: "success", onAction: null });
    } else {
      const { response, data } = await crearVentaPos(payload);
      if (!response.ok) {
        setToast({
          open: true,
          message: data.error || "No se pudo procesar la venta.",
          variant: "warning",
          onAction: null,
        });
        return;
      }

      if (metodoPago === "qr") {
        const formData = new FormData();
        formData.append("file", qrFile);
        const res = await subirComprobante(data.venta?.id_venta, formData);
        if (!res.response.ok) {
          setPendingVentaId(data.venta?.id_venta || null);
          setToast({
            open: true,
            message: res.data.error || "No se pudo subir el comprobante. Intenta nuevamente.",
            variant: "warning",
            onAction: null,
          });
          return;
        }
        setQrFile(null);
      }

      if (data.cliente_credentials?.email) {
        setToast({
          open: true,
          message: `Venta registrada correctamente. Cliente creado: ${data.cliente_credentials.email} | Contraseña: 123456 (debe cambiarla al iniciar sesión).`,
          variant: "success",
          onAction: null,
        });
      } else {
        setToast({ open: true, message: "Venta registrada correctamente.", variant: "success", onAction: null });
      }
    }

    setCart([]);
    setCliente(emptyCliente);
    setSelectedClienteId("");
    setClienteSearch("");
    setClienteMode("nuevo");
    setCiInput("");
    window.dispatchEvent(new Event("ventasUpdated"));
    await load();
  };

  const handleClienteEmail = (value) => {
    const email = value.trim();
    const match = findClienteByEmail(email);
    if (match) {
      setSelectedClienteId(String(match.id || match.id_cliente || ""));
      setClienteMode(match.razon_social ? "empresa" : "persona");
      setCliente({
        nombre: match.nombre || "",
        apellido_paterno: match.apellido_paterno || "",
        apellido_materno: match.apellido_materno || "",
        ci: match.ci || "",
        email: match.email || email,
        es_empresa: Boolean(match.razon_social),
        razon_social: match.razon_social || "",
      });
      setCiInput(match.ci || "");
      return;
    }
    setCliente((prev) => ({ ...prev, email }));
  };

  const handleClienteCi = (value) => {
    setCiInput(value);
    const ci = value.trim();
    setCliente((prev) => ({ ...prev, ci }));
    if (!ci) return;
    const match = findClienteByCi(ci);
    if (match) {
      setSelectedClienteId(String(match.id || match.id_cliente || ""));
      setClienteMode(match.razon_social ? "empresa" : "persona");
      setCliente({
        nombre: match.nombre || "",
        apellido_paterno: match.apellido_paterno || "",
        apellido_materno: match.apellido_materno || "",
        ci: match.ci || ci,
        email: match.email || "",
        es_empresa: Boolean(match.razon_social),
        razon_social: match.razon_social || "",
      });
      return;
    }
  };

  const handleCiKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const ci = ciInput.trim();
    if (!ci) return;
    const match = findClienteByCi(ci);
    if (match) {
      setSelectedClienteId(String(match.id || match.id_cliente || ""));
      setClienteMode(match.razon_social ? "empresa" : "persona");
      setCliente({
        nombre: match.nombre || "",
        apellido_paterno: match.apellido_paterno || "",
        apellido_materno: match.apellido_materno || "",
        ci: match.ci || ci,
        email: match.email || "",
        es_empresa: Boolean(match.razon_social),
        razon_social: match.razon_social || "",
      });
      return;
    }
    setToast({
      open: true,
      message: "No hay cliente con ese CI.",
      variant: "warning",
      onAction: null,
    });
    setSelectedClienteId("");
    setClienteMode("nuevo");
    setCliente((prev) => ({ ...prev, ci }));
  };

  const handleClienteNombre = (value) => {
    const nombre = value.trim();
    const match = findClienteByName(nombre);
    if (match) {
      setSelectedClienteId(String(match.id || match.id_cliente || ""));
      setClienteMode(match.razon_social ? "empresa" : "persona");
      setCliente({
        nombre: match.nombre || nombre,
        apellido_paterno: match.apellido_paterno || "",
        apellido_materno: match.apellido_materno || "",
        ci: match.ci || "",
        email: match.email || "",
        es_empresa: Boolean(match.razon_social),
        razon_social: match.razon_social || "",
      });
      setCiInput(match.ci || "");
      return;
    }
    setCliente((prev) => ({ ...prev, nombre }));
  };

  const filteredClientes = clientes.filter((c) => {
    const term = normalize(clienteSearch);
    if (!term) return true;
    return (
      normalize(buildFullName(c)).includes(term)
      || normalize(c.email).includes(term)
      || normalize(c.ci).includes(term)
    );
  });

  const selectedCliente = selectedClienteId
    ? clientes.find((c) => String(c.id || c.id_cliente) === String(selectedClienteId))
    : null;

  const handleSelectCliente = (value) => {
    setSelectedClienteId(value);
    if (!value) {
      setCliente(emptyCliente);
      setClienteMode("nuevo");
      setCiInput("");
      return;
    }
    const match = clientes.find((c) => String(c.id || c.id_cliente) === String(value));
    if (match) {
      setClienteMode(match.razon_social ? "empresa" : "persona");
      setCliente({
        nombre: match.nombre || "",
        apellido_paterno: match.apellido_paterno || "",
        apellido_materno: match.apellido_materno || "",
        ci: match.ci || "",
        email: match.email || "",
        es_empresa: Boolean(match.razon_social),
        razon_social: match.razon_social || "",
      });
      setCiInput(match.ci || "");
    }
  };

  return (
    <SectionCard title="Punto de venta" description="Registra ventas fisicas en tienda.">
      <div className="card pos-grid">
        <div>
          <div className="form-title">Productos</div>
          <div className="pos-search">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto"
            />
          </div>
          <div className="pos-product-list">
            {visibleProductos.map((producto) => (
              <div key={producto.id_producto} className="pos-product-item">
                <div className="pos-product-info">
                  <button
                    type="button"
                    className="pos-thumb"
                    onClick={() => {
                      const url = resolveImageUrl(producto);
                      if (!url) return;
                      setPreviewImage(url);
                      setPreviewTitle(producto.nombre || "Producto");
                    }}
                  >
                    {resolveImageUrl(producto) ? (
                      <img src={resolveImageUrl(producto)} alt={producto.nombre} />
                    ) : (
                      <span className="pos-thumb-placeholder">Sin imagen</span>
                    )}
                  </button>
                  <strong>{producto.nombre}</strong>
                  <div className="muted">
                    Bs {producto.precio_unitario} | Stock {producto.stock}
                  </div>
                </div>
                <button type="button" className="ghost-button" onClick={() => addToCart(producto)}>
                  Agregar
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="pos-cart">
          <div className="form-title">Carrito</div>
          {cart.length === 0 ? (
            <p className="muted">Sin productos seleccionados.</p>
          ) : (
            cart.map((item) => (
              <div key={item.id_producto} className="pos-cart-item">
                <div>
                  <strong>{item.nombre}</strong>
                  <div className="muted">Bs {item.precio_unitario}</div>
                </div>
                <div className="pos-cart-actions">
                  <input
                    type="number"
                    min="1"
                    value={item.cantidad}
                    onChange={(e) => updateCantidad(item.id_producto, e.target.value)}
                  />
                  <button type="button" className="link-button" onClick={() => removeItem(item.id_producto)}>
                    Quitar
                  </button>
                </div>
              </div>
            ))
          )}
          <div className="pos-total">
            <span>Total</span>
            <strong>Bs {total.toFixed(2)}</strong>
          </div>

          <div className="pos-section">
            <div className="form-title">Metodo de pago</div>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="metodoPago"
                  value="efectivo"
                  checked={metodoPago === "efectivo"}
                  onChange={() => setMetodoPago("efectivo")}
                />
                Efectivo
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="metodoPago"
                  value="qr"
                  checked={metodoPago === "qr"}
                  onChange={() => setMetodoPago("qr")}
                />
                QR
              </label>
            </div>
            {metodoPago === "qr" && (
              <div className="pos-qr-preview">
                {micro?.qr_url ? (
                  <img
                    src={resolveAssetUrl(micro.qr_url)}
                    alt="QR de pago"
                    role="button"
                    onClick={() => {
                      setPreviewImage(resolveAssetUrl(micro.qr_url));
                      setPreviewTitle("QR de pago");
                    }}
                  />
                ) : (
                  <span className="muted">Sin QR</span>
                )}
              </div>
            )}
            {metodoPago === "qr" && (
              <label style={{ marginTop: 8 }}>
                Subir comprobante
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setQrFile(e.target.files?.[0] || null)}
                />
              </label>
            )}
          </div>

          <div className="pos-section">
            <div className="form-title">Cliente</div>
            <div className="pos-client-tools">
              <select
                value={clienteMode}
                onChange={(e) => {
                  const next = e.target.value;
                  setClienteMode(next);
                  setSelectedClienteId("");
                  setCliente((prev) => ({
                    ...prev,
                    es_empresa: next === "empresa",
                    razon_social: next === "empresa" ? prev.razon_social : "",
                  }));
                }}
              >
                <option value="nuevo">Nuevo cliente</option>
                <option value="persona">Persona</option>
                <option value="empresa">Empresa</option>
              </select>
              <input
                placeholder="Buscar por CI o email"
                value={clienteSearch}
                onChange={(e) => setClienteSearch(e.target.value)}
              />
              <select
                value={selectedClienteId}
                onChange={(e) => handleSelectCliente(e.target.value)}
              >
                <option value="">Cliente existente</option>
                {filteredClientes.map((c) => (
                  <option key={c.id || c.id_cliente} value={c.id || c.id_cliente}>
                    {(buildFullName(c) || c.nombre) + ` | CI: ${c.ci || "-"} | ${c.email || "-"}`}
                  </option>
                ))}
              </select>
            </div>
            {selectedCliente && (
              <div className="muted" style={{ marginTop: 6 }}>
                Seleccionado: {(buildFullName(selectedCliente) || selectedCliente.nombre)} · CI: {selectedCliente.ci || "-"} · {selectedCliente.email || "-"}
              </div>
            )}
            <div className="pos-client-grid">
              <input
                placeholder="CI (presiona Enter)"
                value={ciInput}
                onChange={(e) => handleClienteCi(e.target.value)}
                onKeyDown={handleCiKeyDown}
              />
              <input
                placeholder="Nombre"
                value={cliente.nombre}
                onChange={(e) => handleClienteNombre(e.target.value)}
                list="cliente-nombres"
              />
              <input
                placeholder="Apellido paterno"
                value={cliente.apellido_paterno}
                onChange={(e) => setCliente((prev) => ({ ...prev, apellido_paterno: e.target.value }))}
              />
              <input
                placeholder="Apellido materno"
                value={cliente.apellido_materno}
                onChange={(e) => setCliente((prev) => ({ ...prev, apellido_materno: e.target.value }))}
              />
              {clienteMode === "empresa" && (
                <input
                  placeholder="Razon social"
                  value={cliente.razon_social}
                  onChange={(e) => setCliente((prev) => ({ ...prev, razon_social: e.target.value }))}
                />
              )}
              <input
                placeholder="Email"
                value={cliente.email}
                onChange={(e) => handleClienteEmail(e.target.value)}
                list="cliente-emails"
              />
              <datalist id="cliente-emails">
                {clientes.map((c) => (
                  <option key={c.id} value={c.email} />
                ))}
              </datalist>
              <datalist id="cliente-nombres">
                {clientes.map((c) => (
                  <option key={c.id} value={buildFullName(c) || c.nombre} />
                ))}
              </datalist>
            </div>
          </div>

          <button type="button" className="primary-button" onClick={handleVenta}>
            Registrar venta
          </button>
        </div>
      </div>
      <ToastModal
        open={toast.open}
        message={toast.message}
        variant={toast.variant}
        duration={10000}
        onAction={toast.onAction}
        onClose={() => setToast({ open: false, message: "", variant: "success", onAction: null })}
      />
      {previewImage && (
        <div
          className="image-modal"
          onClick={() => {
            setPreviewImage(null);
            setPreviewTitle("");
          }}
        >
          <div className="image-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="image-modal-title">{previewTitle}</div>
            <button
              type="button"
              className="image-modal-close"
              onClick={() => {
                setPreviewImage(null);
                setPreviewTitle("");
              }}
              aria-label="Cerrar"
            >
              ×
            </button>
            <img src={previewImage} alt={previewTitle} />
          </div>
        </div>
      )}
    </SectionCard>
  );
};

export default MicroempresaPOS;
