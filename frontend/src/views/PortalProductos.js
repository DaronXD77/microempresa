import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { fetchPublicProductos } from "../controllers/productoController";
import { fetchPublicCategorias, fetchPublicMicroempresas } from "../controllers/publicController";
import { fetchMe } from "../controllers/authController";
import {
  fetchFollowedMicroempresas,
  followMicroempresa,
  unfollowMicroempresa,
} from "../controllers/clienteController";
import { getCart } from "../utils/cartStorage";
import { addToCart } from "../utils/cartStorage";
import ToastModal from "./ToastModal";
import { resolveAssetUrl } from "../utils/url";

const PortalProductos = () => {
  const { tenantId } = useParams();
  const location = useLocation();
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [productos, setProductos] = useState([]);
  const [microempresas, setMicroempresas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(tenantId || "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [followed, setFollowed] = useState([]);
  const [authRole, setAuthRole] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [followMessage, setFollowMessage] = useState("");
  const [followPending, setFollowPending] = useState(null);
  const [toast, setToast] = useState({ open: false, message: "", variant: "success" });

  const load = useCallback(async () => {
    const [productosRes, microsRes, categoriasRes] = await Promise.all([
      fetchPublicProductos({
        tenant_id: selectedTenant || undefined,
        categoria_id: activeCategoryId || undefined,
        q: search || undefined,
      }),
      fetchPublicMicroempresas(),
      fetchPublicCategorias(),
    ]);
    if (productosRes.response.ok) {
      setProductos(productosRes.data.productos || []);
    }
    if (microsRes.response.ok) {
      setMicroempresas(microsRes.data.microempresas || []);
    }
    if (categoriasRes.response.ok) {
      setCategorias(categoriasRes.data.categorias || []);
    }
  }, [activeCategoryId, search, selectedTenant]);

  useEffect(() => {
    let mounted = true;
    fetchMe()
      .then(({ data }) => {
        if (!mounted) return;
        setAuthRole(data.role || null);
        setAuthUser(data.user || null);
      })
      .catch(() => {
        if (!mounted) return;
        setAuthRole(null);
        setAuthUser(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const isCliente = authRole === "cliente" && Boolean(authUser?.id_cliente);
    if (!isCliente) {
      setFollowed([]);
      return;
    }
    fetchFollowedMicroempresas()
      .then(({ response, data }) => {
        if (!response.ok) return;
        setFollowed(data.microempresas || []);
      })
      .catch(() => {});
  }, [authRole, authUser?.id_cliente]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!followMessage) return;
    const lower = String(followMessage || "").toLowerCase();
    const variant = lower.includes("no") || lower.includes("error") ? "warning" : "success";
    setToast({ open: true, message: followMessage, variant });
  }, [followMessage]);

  useEffect(() => {
    const update = () => {
      const cart = getCart();
      setCartCount(cart?.items?.reduce((sum, item) => sum + item.cantidad, 0) || 0);
    };
    update();
    window.addEventListener("storage", update);
    window.addEventListener("cartUpdated", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("cartUpdated", update);
    };
  }, []);

  useEffect(() => {
    if (tenantId) {
      setSelectedTenant(tenantId);
    }
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [selectedTenant, load]);

  useEffect(() => {
    const handler = setTimeout(() => {
      load();
    }, 350);
    return () => clearTimeout(handler);
  }, [search, activeCategoryId, load]);

  const visibleProductos = useMemo(() => productos, [productos]);
  const headerCategorias = categorias.slice(0, 4);
  const activeCategoria = categorias.find((cat) => String(cat.id_categoria) === String(activeCategoryId));
  const detailBase = location.pathname.startsWith("/portal") ? "/portal/producto" : "/producto";
  const selectedMicro = microempresas.find(
    (micro) => String(micro.tenant_id) === String(selectedTenant || "")
  );
  const followedIds = useMemo(
    () => new Set((followed || []).map((micro) => String(micro.tenant_id))),
    [followed]
  );
  const isFollowing = selectedMicro && followedIds.has(String(selectedMicro.tenant_id));
  const canFollow = authRole === "cliente" && Boolean(authUser?.id_cliente);

  const buildEmbedSrcFromQuery = (value, fallbackText = "") => {
    const raw = String(value || "").trim();
    const fallback = String(fallbackText || "").trim();
    const toEmbed = (query) => `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
    if (!raw && fallback) return toEmbed(fallback);
    if (!raw) return "";
    if (raw.startsWith("http")) {
      try {
        const url = new URL(raw);
        const q = url.searchParams.get("q") || url.searchParams.get("query");
        if (q) return toEmbed(q);
        const match = url.pathname.match(/\/maps\/place\/([^/]+)/);
        if (match?.[1]) return toEmbed(decodeURIComponent(match[1].replace(/\+/g, " ")));
        if (url.hostname.includes("google.com") && url.pathname.startsWith("/maps")) {
          const withEmbed = raw.includes("output=embed")
            ? raw
            : `${raw}${raw.includes("?") ? "&" : "?"}output=embed`;
          return withEmbed;
        }
      } catch {
        // ignore
      }
      return fallback ? toEmbed(fallback) : raw;
    }
    return toEmbed(raw);
  };

  const handleFollow = async () => {
    if (!selectedMicro) return;
    if (!canFollow) {
      setFollowMessage("Inicia sesión para seguir la microempresa.");
      return;
    }
    setFollowMessage("");
    setFollowPending(selectedMicro.tenant_id);
    const { response, data } = await followMicroempresa(selectedMicro.tenant_id);
    if (!response.ok) {
      setFollowMessage(data.error || "No se pudo seguir.");
      setFollowPending(null);
      return;
    }
    setFollowMessage("Microempresa seguida.");
    const refreshed = await fetchFollowedMicroempresas();
    if (refreshed.response.ok) {
      setFollowed(refreshed.data.microempresas || []);
    }
    setFollowPending(null);
  };

  const handleUnfollow = async () => {
    if (!selectedMicro) return;
    setFollowMessage("");
    setFollowPending(selectedMicro.tenant_id);
    const { response, data } = await unfollowMicroempresa(selectedMicro.tenant_id);
    if (!response.ok) {
      setFollowMessage(data.error || "No se pudo dejar de seguir.");
      setFollowPending(null);
      return;
    }
    setFollowMessage("Dejaste de seguir la microempresa.");
    const refreshed = await fetchFollowedMicroempresas();
    if (refreshed.response.ok) {
      setFollowed(refreshed.data.microempresas || []);
    }
    setFollowPending(null);
  };

  const handleAddToCart = (producto) => {
    const result = addToCart(producto, 1);
    if (result.error) {
      setToast({ open: true, message: result.error, variant: "warning" });
      return;
    }
    setToast({ open: true, message: "Producto agregado al carrito.", variant: "success" });
  };

  return (
    <div className="portal-page">
      <div className="portal-container">
        <header className="portal-header">
          <nav className="portal-nav">
            <button
              type="button"
              className={`portal-nav-item ${!activeCategoryId ? "active" : ""}`}
              onClick={() => setActiveCategoryId("")}
            >
              TODAS
            </button>
            {headerCategorias.map((cat) => (
              <button
                key={cat.id_categoria}
                type="button"
                className={`portal-nav-item ${String(cat.id_categoria) === String(activeCategoryId) ? "active" : ""}`}
                onClick={() => setActiveCategoryId(String(cat.id_categoria))}
              >
                {String(cat.nombre || "").toUpperCase()}
              </button>
            ))}
          </nav>
          <div className="portal-brand">Sistema SaaS</div>
          <div className="portal-icons">
            <button type="button" className="portal-icon" aria-label="Buscar">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <line x1="16" y1="16" x2="21" y2="21" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            <Link to="/portal/carrito" className="portal-icon cart-icon" aria-label="Carrito">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="5" y="7" width="14" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </Link>
            <button type="button" className="portal-icon" aria-label="Favoritos">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 20s-6-3.5-8-7.5A5 5 0 0 1 12 6a5 5 0 0 1 8 6.5C18 16.5 12 20 12 20z" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            <button type="button" className="portal-icon" aria-label="Perfil">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M4 20c2.5-4 13.5-4 16 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
        </header>

        <div className="portal-breadcrumb">Inicio / {activeCategoria?.nombre || "Todos"}</div>
        {selectedMicro && (
          <div className="portal-microempresa">
            <div className="microempresa-info">
              <div className="microempresa-logo">
                {selectedMicro.logo_url ? (
                  <img src={resolveAssetUrl(selectedMicro.logo_url)} alt={selectedMicro.nombre} />
                ) : (
                  <span>{String(selectedMicro.nombre || "?").slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div>
                <div className="microempresa-name">{selectedMicro.nombre}</div>
                <div className="muted">Productos de esta microempresa</div>
              </div>
            </div>
            <div className="microempresa-actions">
              {isFollowing ? (
                <button
                  type="button"
                  className="microempresa-follow following"
                  onClick={handleUnfollow}
                  disabled={followPending === selectedMicro.tenant_id}
                >
                  Dejar de seguir
                </button>
              ) : (
                <button
                  type="button"
                  className="microempresa-follow"
                  onClick={handleFollow}
                  disabled={followPending === selectedMicro.tenant_id}
                >
                  Seguir
                </button>
              )}
            </div>
          </div>
        )}

        <div className="portal-filterbar">
            <button type="button" className="filter-toggle" onClick={() => setFiltersOpen((prev) => !prev)}>
              {filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
            </button>
            <div className="filter-search">
              <span>Filtros:</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar productos"
              />
              <button type="button" onClick={load}>
                Buscar
              </button>
            </div>
            <div className="filter-count">
              {visibleProductos.length === 0 ? "Sin resultados" : `${visibleProductos.length} resultados`}
            </div>
          </div>

        <div className="portal-body">
          <aside className={`portal-sidebar ${filtersOpen ? "open" : ""}`}>
            <div className="sidebar-section">
              <div className="sidebar-title">CATEGORIAS</div>
              <div className="sidebar-category">
                <button
                  type="button"
                  className={!activeCategoryId ? "active" : ""}
                  onClick={() => setActiveCategoryId("")}
                >
                  Todas las categorias
                </button>
              </div>
              {categorias.map((categoria) => (
                <div key={categoria.id_categoria} className="sidebar-category">
                  <button
                    type="button"
                    className={String(categoria.id_categoria) === String(activeCategoryId) ? "active" : ""}
                    onClick={() => setActiveCategoryId(String(categoria.id_categoria))}
                  >
                    {categoria.nombre}
                  </button>
                </div>
              ))}
            </div>

            <div className="sidebar-section">
              <div className="sidebar-title">TIPO DE PRODUCTO</div>
              <div className="sidebar-accordion">Categorias activas</div>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-title">MICROEMPRESA</div>
              <select
                value={selectedTenant}
                onChange={(e) => setSelectedTenant(e.target.value)}
                className="sidebar-select"
              >
                <option value="">Todas</option>
                {microempresas.map((micro) => (
                  <option key={micro.tenant_id} value={micro.tenant_id}>
                    {micro.nombre}
                  </option>
                ))}
              </select>
            </div>
          </aside>

          <main className="portal-grid">
            {visibleProductos.map((producto) => {
              const imageUrl = resolveAssetUrl(
                producto.fotos?.[0]?.url || producto.microempresa?.logo_url
              );
              const detailPath = `${detailBase}/${producto.id_producto}`;
              const stock = Number(producto.stock ?? 0);
              const isOutOfStock = Number.isFinite(stock) && stock <= 0;

              return (
                <div key={producto.id_producto} className="product-card">
                  <Link to={detailPath} className="product-card-link">
                    <div className="product-image">
                      {imageUrl ? (
                        <img src={imageUrl} alt={producto.nombre} />
                      ) : (
                        <div className="product-placeholder">Sin imagen</div>
                      )}
                    </div>
                    <div className="product-name">{String(producto.nombre || "").toUpperCase()}</div>
                    <div className="product-price">Bs {producto.precio_unitario}</div>
                      {producto.microempresa?.nombre && (
                        <div className="product-brand">
                        {producto.microempresa.logo_url && (
                          <img
                            src={resolveAssetUrl(producto.microempresa.logo_url)}
                            alt={producto.microempresa.nombre}
                          />
                        )}
                        <span>{producto.microempresa.nombre}</span>
                      </div>
                    )}
                    <div className="product-meta">
                      <span>{(producto.categorias || []).map((c) => c.nombre).join(", ") || "Sin categoria"}</span>
                      <span className="product-link">Ver</span>
                    </div>
                    {isOutOfStock && <div className="muted" style={{ marginTop: 6 }}>Agotado</div>}
                  </Link>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => handleAddToCart(producto)}
                    disabled={isOutOfStock}
                  >
                    Agregar al carrito
                  </button>
                </div>
              );
            })}
          </main>

          {selectedMicro && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="form-title">Contacto de la microempresa</div>
              <div className="muted">Email: {selectedMicro.email || "-"}</div>
              <div className="muted">Celular: {selectedMicro.telefono_contacto || "-"}</div>
              <div className="muted">Direccion: {selectedMicro.direccion || "Tienda virtual"}</div>
              {selectedMicro.direccion ? (
                <iframe
                  title="micro-map"
                  src={buildEmbedSrcFromQuery(selectedMicro.direccion)}
                  width="100%"
                  height="240"
                  style={{ border: 0, borderRadius: 10, marginTop: 8 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : null}
            </div>
          )}
        </div>
      </div>
      <ToastModal
        open={toast.open}
        message={toast.message}
        variant={toast.variant}
        duration={10000}
        onClose={() => setToast({ open: false, message: "", variant: "success" })}
      />
    </div>
  );
};

export default PortalProductos;
