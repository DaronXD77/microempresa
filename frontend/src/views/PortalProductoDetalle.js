import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchPublicProductoDetalle } from "../controllers/productoController";
import { addToCart, getCart } from "../utils/cartStorage";
import ToastModal from "./ToastModal";
import { resolveAssetUrl } from "../utils/url";

const PortalProductoDetalle = () => {
  const { productoId } = useParams();
  const navigate = useNavigate();
  const [producto, setProducto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [toast, setToast] = useState({ open: false, message: "", variant: "success" });
  const [cartCount, setCartCount] = useState(0);
  const [showCartFloat, setShowCartFloat] = useState(false);
  const cartTimerRef = useRef(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setMessage("");
      const { response, data } = await fetchPublicProductoDetalle(productoId);
      if (!active) return;
      if (!response.ok) {
        setMessage(data.error || "No se pudo cargar el producto.");
        setLoading(false);
        return;
      }
      setProducto(data.producto || null);
      setLoading(false);
    };

    load();
    return () => {
      active = false;
    };
  }, [productoId]);

  const images = useMemo(() => {
    const fotos = producto?.fotos || [];
    if (fotos.length > 0) return fotos.map((foto) => resolveAssetUrl(foto.url)).filter(Boolean);
    if (producto?.microempresa?.logo_url) return [resolveAssetUrl(producto.microempresa.logo_url)];
    return [];
  }, [producto]);

  const imageUrl = images[activeIndex] || "";
  const categorias = (producto?.categorias || []).map((cat) => cat.nombre).filter(Boolean);

  useEffect(() => {
    setActiveIndex(0);
  }, [productoId]);

  useEffect(() => () => {
    if (cartTimerRef.current) {
      clearTimeout(cartTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const update = () => {
      const cart = getCart();
      const count = cart?.items?.reduce((sum, item) => sum + item.cantidad, 0) || 0;
      setCartCount(count);
    };
    update();
    window.addEventListener("storage", update);
    window.addEventListener("cartUpdated", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("cartUpdated", update);
    };
  }, []);

  const goPrev = () => {
    if (!images.length) return;
    setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const goNext = () => {
    if (!images.length) return;
    setActiveIndex((prev) => (prev + 1) % images.length);
  };

  const handleAddToCart = (redirect) => {
    if (!producto) return;
    const result = addToCart(producto, 1);
    if (result.error) {
      setToast({ open: true, message: result.error, variant: "warning" });
      return;
    }
    setToast({ open: true, message: "Producto agregado al carrito.", variant: "success" });
    setShowCartFloat(true);
    if (cartTimerRef.current) {
      clearTimeout(cartTimerRef.current);
    }
    cartTimerRef.current = setTimeout(() => setShowCartFloat(false), 3500);
    if (redirect) {
      navigate("/portal/carrito");
    }
  };

  return (
    <div className="portal-page">
      <div className="portal-container">
        <header className="portal-header detail-header">
          <Link to="/" className="portal-back" onClick={(e) => {
            e.preventDefault();
            navigate(-1);
          }}>
            Volver
          </Link>
          <div className="portal-brand">Sistema SaaS</div>
          <div className="portal-icons">
            <Link to="/portal/carrito" className="portal-icon cart-icon" aria-label="Carrito">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="5" y="7" width="14" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </Link>
          </div>
        </header>

        <div className="portal-breadcrumb">Inicio / Producto</div>

        <div className="product-detail">
          {loading ? (
            <p className="muted">Cargando...</p>
          ) : message ? (
            <p className="error">{message}</p>
          ) : producto ? (
            <div className="product-detail-grid">
              <div className="product-detail-media">
                <div className="product-carousel">
                  {imageUrl ? (
                    <img src={imageUrl} alt={producto.nombre} />
                  ) : (
                    <div className="product-placeholder">Sin imagen</div>
                  )}
                  {images.length > 1 && (
                    <>
                      <button type="button" className="carousel-arrow left" onClick={goPrev}>
                        ‹
                      </button>
                      <button type="button" className="carousel-arrow right" onClick={goNext}>
                        ›
                      </button>
                    </>
                  )}
                </div>
                {images.length > 1 && (
                  <div className="product-thumbs">
                    {images.map((url, index) => (
                      <button
                        key={url}
                        type="button"
                        className={index === activeIndex ? "thumb active" : "thumb"}
                        onClick={() => setActiveIndex(index)}
                      >
                        <img src={url} alt={producto.nombre} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="product-detail-info">
                <div className="detail-label">Producto</div>
                <h2>{producto.nombre}</h2>
                <div className="detail-price">Bs {producto.precio_unitario}</div>

                {producto.microempresa?.nombre && (
                  <Link
                    to={`/microempresa/${producto.microempresa.tenant_id}`}
                    className="detail-brand"
                  >
                    {producto.microempresa.logo_url && (
                      <img
                        src={resolveAssetUrl(producto.microempresa.logo_url)}
                        alt={producto.microempresa.nombre}
                      />
                    )}
                    <span>{producto.microempresa.nombre}</span>
                  </Link>
                )}

                {producto.descripcion && <p className="detail-desc">{producto.descripcion}</p>}

                <div className="detail-meta">
                  <div>
                    <span className="detail-label">Categorias</span>
                    <p>{categorias.length ? categorias.join(", ") : "Sin categoria"}</p>
                  </div>
                  <div>
                    <span className="detail-label">Stock</span>
                    <p>{producto.stock}</p>
                  </div>
                </div>

                <div className="detail-actions">
                  <button type="button" className="primary-button" onClick={() => handleAddToCart(false)}>
                    Agregar al carrito
                  </button>
                  <button type="button" className="ghost-button" onClick={() => handleAddToCart(true)}>
                    Comprar ahora
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <ToastModal
        open={toast.open}
        message={toast.message}
        variant={toast.variant}
        duration={10000}
        onClose={() => setToast({ open: false, message: "", variant: "success" })}
      />
      {showCartFloat && cartCount > 0 && (
        <Link to="/portal/carrito" className="cart-float" aria-label="Ver carrito">
          <span>Carrito</span>
          <span className="cart-float-count">{cartCount}</span>
        </Link>
      )}
    </div>
  );
};

export default PortalProductoDetalle;
