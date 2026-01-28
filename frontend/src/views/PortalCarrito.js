import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { clearCart, getCart, removeCartItem, setCartOwner, updateCartItem } from "../utils/cartStorage";
import { crearVentaVirtual, subirComprobante } from "../controllers/ventaController";
import { fetchMe } from "../controllers/authController";
import { lookupPublicCliente, registerPublicCliente } from "../controllers/clienteController";
import ToastModal from "./ToastModal";
import { resolveAssetUrl } from "../utils/url";

const emptyCliente = {
  nombre: "",
  apellido_paterno: "",
  apellido_materno: "",
  email: "",
  es_empresa: false,
  razon_social: "",
};

const emptyRegistro = {
  nombre: "",
  apellido_paterno: "",
  apellido_materno: "",
  ci: "",
  email: "",
  password: "",
  es_empresa: false,
  razon_social: "",
};

const HISTORY_KEY = "portal_client_history_v1";

const readHistory = () => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeHistory = (items) => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
};

const normalize = (value) => String(value || "").trim().toLowerCase();

const buildFullName = (c) =>
  [c?.nombre, c?.apellido_paterno, c?.apellido_materno].filter(Boolean).join(" ").trim();

const PortalCarrito = () => {
  const navigate = useNavigate();
  const [cart, setCart] = useState(getCart());
  const [cliente, setCliente] = useState(emptyCliente);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [clientHistory, setClientHistory] = useState([]);
  const [toast, setToast] = useState({ open: false, message: "", variant: "success", onAction: null });
  const [authUser, setAuthUser] = useState(null);
  const [authRole, setAuthRole] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [registroForm, setRegistroForm] = useState(emptyRegistro);
  const [registroSaving, setRegistroSaving] = useState(false);
  const lookupTimerRef = useRef(null);
  const lookupLastRef = useRef("");

  const isLoggedClient = authRole === "cliente" && Boolean(authUser?.id_cliente);
  const requiresRegistration = authReady && !isLoggedClient;

  useEffect(() => {
    const handler = () => setCart(getCart());
    window.addEventListener("storage", handler);
    window.addEventListener("cartUpdated", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("cartUpdated", handler);
    };
  }, []);

  useEffect(() => {
    setClientHistory(readHistory());
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchMe()
      .then(({ data }) => {
        if (!mounted) return;
        setAuthUser(data.user || null);
        setAuthRole(data.role || null);
        setAuthReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        setAuthUser(null);
        setAuthRole(null);
        setAuthReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoggedClient || !authUser) return;
    setCliente({
      nombre: authUser.nombre || "",
      apellido_paterno: authUser.apellido_paterno || "",
      apellido_materno: authUser.apellido_materno || "",
      email: authUser.email || "",
      es_empresa: Boolean(authUser.razon_social),
      razon_social: authUser.razon_social || "",
    });
    setRegistroForm((prev) => ({
      ...prev,
      nombre: authUser.nombre || "",
      apellido_paterno: authUser.apellido_paterno || "",
      apellido_materno: authUser.apellido_materno || "",
      ci: authUser.ci || "",
      email: authUser.email || "",
      es_empresa: Boolean(authUser.razon_social),
      razon_social: authUser.razon_social || "",
    }));
  }, [authUser, isLoggedClient]);

  useEffect(() => {
    if (!cart?.tenant_id || isLoggedClient) return;

    const email = cliente.email.trim();
    const nombre = cliente.nombre.trim();
    const query = email || nombre;
    if (!query || query.length < 2) return;

    const normalizedQuery = normalize(query);
    if (normalizedQuery === lookupLastRef.current) return;

    if (lookupTimerRef.current) {
      clearTimeout(lookupTimerRef.current);
    }

    lookupTimerRef.current = setTimeout(async () => {
      const { response, data } = await lookupPublicCliente({
        tenant_id: cart.tenant_id,
        q: query,
      });
      if (!response.ok || !data?.cliente) return;

      const match = data.cliente;
      setCliente({
        nombre: match.nombre || nombre,
        apellido_paterno: match.apellido_paterno || "",
        apellido_materno: match.apellido_materno || "",
        email: match.email || email,
        es_empresa: Boolean(match.razon_social),
        razon_social: match.razon_social || "",
      });
      lookupLastRef.current = normalizedQuery;
    }, 300);

    return () => {
      if (lookupTimerRef.current) {
        clearTimeout(lookupTimerRef.current);
      }
    };
  }, [cart?.tenant_id, cliente.email, cliente.nombre]);

  useEffect(() => {
    if (cliente.email) {
      setCartOwner(cliente.email, { migrate: true });
    }
  }, [cliente.email]);

  const total = useMemo(() => {
    if (!cart?.items) return 0;
    return cart.items.reduce((sum, item) => sum + item.cantidad * Number(item.precio_unitario || 0), 0);
  }, [cart]);

  const handleUpdate = (id, qty) => {
    const result = updateCartItem(id, Number(qty || 1));
    if (result.error) {
      setToast({ open: true, message: result.error, variant: "warning", onAction: null });
      return;
    }
    setCart(result.cart);
  };

  const handleRemove = (id) => {
    const { cart: next } = removeCartItem(id);
    setCart(next);
  };

  const handleCheckout = async () => {
    if (!cart?.items?.length) {
      setToast({ open: true, message: "El carrito esta vacio.", variant: "warning", onAction: null });
      return;
    }
    if (!isLoggedClient) {
      setToast({
        open: true,
        message: "Debes registrarte o iniciar sesión para continuar con la compra.",
        variant: "warning",
        onAction: null,
      });
      return;
    }
    if (!file) {
      setToast({ open: true, message: "Debes subir el comprobante.", variant: "warning", onAction: null });
      return;
    }

    const payload = {
      tenant_id: cart.tenant_id,
      items: cart.items.map((item) => ({
        id_producto: item.id_producto,
        cantidad: item.cantidad,
      })),
    };

    if (!isLoggedClient) {
      payload.cliente = cliente;
    }

    const { response, data } = await crearVentaVirtual(payload);
    if (!response.ok) {
      setToast({
        open: true,
        message: data.error || "No se pudo crear la venta.",
        variant: "warning",
        onAction: null,
      });
      return;
    }

    const venta = data.venta;
    const formData = new FormData();
    formData.append("file", file);
    const res = await subirComprobante(venta.id_venta, formData, venta.public_token);
    if (!res.response.ok) {
      setToast({
        open: true,
        message: res.data.error || "No se pudo subir el comprobante.",
        variant: "warning",
        onAction: null,
      });
      return;
    }

    if (data.cliente_credentials?.email) {
      setToast({
        open: true,
        message: `Cuenta creada con éxito. Usuario: ${data.cliente_credentials.email} | Contraseña: 123456.`,
        variant: "success",
        onAction: () => {
          setToast({
            open: true,
            message: "Ve a Perfil > Editar para cambiar tu contraseña.",
            variant: "warning",
            onAction: null,
          });
          return false;
        },
      });
    }

    const historyNext = [
      { ...cliente, email: cliente.email.trim() },
      ...clientHistory.filter((c) => normalize(c.email) !== normalize(cliente.email)),
    ].slice(0, 8);
    writeHistory(historyNext);
    setClientHistory(historyNext);

    clearCart();
    setCart(null);
    setCheckoutOpen(false);
    setCliente(emptyCliente);
    setFile(null);
    if (data.cliente_credentials?.email) {
      setToast({
        open: true,
        message: `Compra finalizada. Usuario: ${data.cliente_credentials.email} | Contraseña: 123456.`,
        variant: "success",
        onAction: null,
      });
    } else {
      setToast({
        open: true,
        message: "Compra finalizada. Puedes ver el estado en Mis pedidos.",
        variant: "success",
        onAction: null,
      });
    }
    setTimeout(() => navigate("/dashboard"), 2500);
  };

  const handleRegistroChange = (event) => {
    const { name, value, type, checked } = event.target;
    setRegistroForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleRegistroSubmit = async () => {
    if (!cart?.tenant_id) {
      setToast({
        open: true,
        message: "Selecciona una microempresa antes de registrarte.",
        variant: "warning",
        onAction: null,
      });
      return;
    }
    if (!registroForm.ci.trim()) {
      setToast({
        open: true,
        message: "CI requerido.",
        variant: "warning",
        onAction: null,
      });
      return;
    }
    if (!registroForm.password) {
      setToast({
        open: true,
        message: "Password requerido.",
        variant: "warning",
        onAction: null,
      });
      return;
    }
    if (registroForm.es_empresa && !registroForm.razon_social.trim()) {
      setToast({
        open: true,
        message: "Razón social requerida.",
        variant: "warning",
        onAction: null,
      });
      return;
    }

    const payload = {
      tenant_id: cart.tenant_id,
      nombre: registroForm.nombre.trim(),
      apellido_paterno: registroForm.apellido_paterno.trim(),
      apellido_materno: registroForm.apellido_materno.trim(),
      ci: registroForm.ci.trim(),
      email: registroForm.email.trim(),
      password: registroForm.password,
      es_empresa: Boolean(registroForm.es_empresa),
      razon_social: registroForm.es_empresa ? registroForm.razon_social.trim() : "",
    };

    setRegistroSaving(true);
    const { response, data } = await registerPublicCliente(payload);
    setRegistroSaving(false);
    if (!response.ok) {
      setToast({
        open: true,
        message: data.error || "No se pudo registrar.",
        variant: "warning",
        onAction: null,
      });
      return;
    }
    setAuthUser(data.user || null);
    setAuthRole(data.role || "cliente");
    setAuthReady(true);
    setCliente({
      nombre: data.user?.nombre || payload.nombre,
      apellido_paterno: data.user?.apellido_paterno || payload.apellido_paterno,
      apellido_materno: data.user?.apellido_materno || payload.apellido_materno,
      email: data.user?.email || payload.email,
      es_empresa: Boolean(data.user?.razon_social || payload.razon_social),
      razon_social: data.user?.razon_social || payload.razon_social,
    });
    setRegistroForm((prev) => ({ ...prev, password: "" }));
    setToast({
      open: true,
      message: "Registro exitoso. Continúa con el pago.",
      variant: "success",
      onAction: null,
    });
  };

  const findByEmail = (value) => {
    const email = normalize(value);
    if (!email) return null;
    return clientHistory.find((c) => normalize(c.email) === email) || null;
  };

  const findByName = (value) => {
    const name = normalize(value);
    if (!name) return null;
    return (
      clientHistory.find((c) => normalize(buildFullName(c)) === name) ||
      clientHistory.find((c) => normalize(c.nombre).startsWith(name)) ||
      null
    );
  };

  const handleNombreChange = (value) => {
    const nombre = value.trim();
    const match = findByName(nombre);
    if (match) {
      setCliente({
        nombre: match.nombre || nombre,
        apellido_paterno: match.apellido_paterno || "",
        apellido_materno: match.apellido_materno || "",
        email: match.email || "",
        es_empresa: Boolean(match.razon_social),
        razon_social: match.razon_social || "",
      });
      return;
    }
    setCliente((prev) => ({ ...prev, nombre }));
    if (cart?.tenant_id && nombre.length >= 2) {
      lookupPublicCliente({ tenant_id: cart.tenant_id, q: nombre })
        .then(({ response, data }) => {
          if (!response.ok || !data?.cliente) return;
          const c = data.cliente;
          setCliente({
            nombre: c.nombre || nombre,
            apellido_paterno: c.apellido_paterno || "",
            apellido_materno: c.apellido_materno || "",
            email: c.email || "",
            es_empresa: Boolean(c.razon_social),
            razon_social: c.razon_social || "",
          });
        })
        .catch(() => {});
    }
  };

  const handleEmailChange = (value) => {
    const email = value.trim();
    const match = findByEmail(email);
    if (match) {
      setCliente({
        nombre: match.nombre || "",
        apellido_paterno: match.apellido_paterno || "",
        apellido_materno: match.apellido_materno || "",
        email: match.email || email,
        es_empresa: Boolean(match.razon_social),
        razon_social: match.razon_social || "",
      });
      return;
    }
    setCliente((prev) => ({ ...prev, email }));
    if (cart?.tenant_id && email.length >= 2) {
      lookupPublicCliente({ tenant_id: cart.tenant_id, q: email })
        .then(({ response, data }) => {
          if (!response.ok || !data?.cliente) return;
          const c = data.cliente;
          setCliente({
            nombre: c.nombre || "",
            apellido_paterno: c.apellido_paterno || "",
            apellido_materno: c.apellido_materno || "",
            email: c.email || email,
            es_empresa: Boolean(c.razon_social),
            razon_social: c.razon_social || "",
          });
        })
        .catch(() => {});
    }
  };

  return (
    <div className="portal-page">
      <div className="portal-container">
        <header className="portal-header detail-header">
          <Link to="/portal" className="portal-back">
            Volver al catalogo
          </Link>
          <div className="portal-brand">Sistema SaaS</div>
          <div className="portal-icons" />
        </header>

        <div className="portal-breadcrumb">Carrito</div>

        {!cart ? (
          <div className="cart-empty">
            <p className="muted">Tu carrito esta vacio.</p>
            <Link to="/portal" className="primary-link">
              Volver a comprar
            </Link>
          </div>
        ) : (
          <div className="cart-grid">
            <div className="cart-items">
              {cart.items.map((item) => (
                <div key={item.id_producto} className="cart-item">
                  <div className="cart-item-info">
                    {item.foto_url ? (
                      <img src={resolveAssetUrl(item.foto_url)} alt={item.nombre} />
                    ) : (
                      <div className="cart-photo" />
                    )}
                    <div>
                      <strong>{item.nombre}</strong>
                      <div className="muted">Bs {item.precio_unitario}</div>
                    </div>
                  </div>
                  <div className="cart-item-actions">
                    <input
                      type="number"
                      min="1"
                      value={item.cantidad}
                      onChange={(e) => handleUpdate(item.id_producto, e.target.value)}
                    />
                    <button type="button" className="link-button" onClick={() => handleRemove(item.id_producto)}>
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-summary">
              <div className="form-title">Resumen</div>
              <p className="muted">{cart.items.length} productos</p>
              <div className="cart-total">
                <span>Total</span>
                <strong>Bs {total.toFixed(2)}</strong>
              </div>
              <button type="button" className="primary-button" onClick={() => setCheckoutOpen((prev) => !prev)}>
                {checkoutOpen ? "Ocultar pago" : "Continuar con el pago"}
              </button>
              <button type="button" className="ghost-button" onClick={() => {
                clearCart();
                setCart(null);
              }}>
                Cancelar compra
              </button>
            </div>
          </div>
        )}

        {checkoutOpen && cart && (
          <div className="checkout-panel">
            <div className="form-title">Datos del cliente</div>
          {requiresRegistration ? (
            <div className="checkout-alert">
              <div className="form-title">Registro rapido</div>
              <div className="checkout-grid">
                <input
                  placeholder="Nombre"
                  name="nombre"
                  value={registroForm.nombre}
                  onChange={handleRegistroChange}
                />
                <input
                  placeholder="Apellido paterno"
                  name="apellido_paterno"
                  value={registroForm.apellido_paterno}
                  onChange={handleRegistroChange}
                />
                <input
                  placeholder="Apellido materno"
                  name="apellido_materno"
                  value={registroForm.apellido_materno}
                  onChange={handleRegistroChange}
                />
                <input
                  placeholder="CI"
                  name="ci"
                  value={registroForm.ci}
                  onChange={handleRegistroChange}
                />
                <input
                  placeholder="Email"
                  name="email"
                  value={registroForm.email}
                  onChange={handleRegistroChange}
                />
                <input
                  type="password"
                  placeholder="Password"
                  name="password"
                  value={registroForm.password}
                  onChange={handleRegistroChange}
                />
              </div>
              <label className="inline-check">
                <input
                  type="checkbox"
                  name="es_empresa"
                  checked={registroForm.es_empresa}
                  onChange={handleRegistroChange}
                />
                Soy empresa
              </label>
              {registroForm.es_empresa && (
                <input
                  placeholder="Razón social"
                  name="razon_social"
                  value={registroForm.razon_social}
                  onChange={handleRegistroChange}
                />
              )}
              <button
                type="button"
                className="primary-button"
                onClick={handleRegistroSubmit}
                disabled={registroSaving}
              >
                {registroSaving ? "Registrando..." : "Registrarme y continuar"}
              </button>
              <Link to="/" className="primary-link">
                Ya tengo cuenta, iniciar sesión
              </Link>
            </div>
          ) : (
            <>
              <div className="checkout-grid">
                <input
                  placeholder="Nombre"
                  value={cliente.nombre}
                  onChange={(e) => handleNombreChange(e.target.value)}
                  list="portal-client-nombres"
                  disabled={isLoggedClient}
                />
                <input
                  placeholder="Apellido paterno"
                  value={cliente.apellido_paterno}
                  onChange={(e) => setCliente((prev) => ({ ...prev, apellido_paterno: e.target.value }))}
                  disabled={isLoggedClient}
                />
                <input
                  placeholder="Apellido materno"
                  value={cliente.apellido_materno}
                  onChange={(e) => setCliente((prev) => ({ ...prev, apellido_materno: e.target.value }))}
                  disabled={isLoggedClient}
                />
                <input
                  placeholder="Email"
                  value={cliente.email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  list="portal-client-emails"
                  disabled={isLoggedClient}
                />
              </div>
              <datalist id="portal-client-nombres">
                {clientHistory.map((c) => (
                  <option key={c.email} value={buildFullName(c) || c.nombre} />
                ))}
              </datalist>
              <datalist id="portal-client-emails">
                {clientHistory.map((c) => (
                  <option key={c.email} value={c.email} />
                ))}
              </datalist>
            </>
          )}

            <div className="checkout-qr">
              <div className="form-title">Pago por QR</div>
              {cart.microempresa?.qr_url ? (
                <div className="checkout-qr-preview">
                  <img
                    src={resolveAssetUrl(cart.microempresa.qr_url)}
                    alt="QR de pago"
                    onClick={() => setQrOpen(true)}
                    role="button"
                  />
                  <button type="button" className="link-button" onClick={() => setQrOpen(true)}>
                    Ver QR de pago
                  </button>
                </div>
              ) : (
                <p className="muted">La microempresa aun no subio QR.</p>
              )}
            </div>

            <div className="checkout-upload">
              <div className="form-title">Subir comprobante</div>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>

          <button type="button" className="primary-button" onClick={handleCheckout}>
            Finalizar compra
          </button>
        </div>
      )}
      {qrOpen && cart?.microempresa?.qr_url && (
        <div className="qr-modal" onClick={() => setQrOpen(false)}>
          <div className="qr-modal-card" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="qr-modal-close" onClick={() => setQrOpen(false)}>
              Cerrar
            </button>
            <img src={resolveAssetUrl(cart.microempresa.qr_url)} alt="QR de pago" />
          </div>
        </div>
      )}
      </div>
      <ToastModal
        open={toast.open}
        message={toast.message}
        variant={toast.variant}
        duration={10000}
        onAction={toast.onAction}
        onClose={() => setToast({ open: false, message: "", variant: "success", onAction: null })}
      />
    </div>
  );
};

export default PortalCarrito;
