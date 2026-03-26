import React, { useEffect, useState } from "react";
import { fetchProductos, fetchCategorias } from "../controllers/productoController";

const PortalProductos = ({ onViewProducto }) => {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [prodRes, catRes] = await Promise.all([
        fetchProductos("disponible"),
        fetchCategorias(),
      ]);

      if (prodRes.response.ok) {
        setProductos(prodRes.data.productos || []);
      }

      if (catRes.response.ok) {
        setCategorias(catRes.data.categorias || []);
      }
    } catch (err) {
      setError("Error al cargar productos");
    } finally {
      setLoading(false);
    }
  };

  const productosFiltrados = categoriaSeleccionada
    ? productos.filter((p) => p.id_categoria === parseInt(categoriaSeleccionada))
    : productos;

  const getStockTotal = (producto) => {
    if (!producto.tallas) return 0;
    return producto.tallas.reduce((sum, t) => sum + (t.stock || 0), 0);
  };

  const getImageUrl = (producto) => {
    if (producto.imagenes && producto.imagenes.length > 0) {
      return producto.imagenes[0].url;
    }
    return "https://via.placeholder.com/300x200?text=Sin+Imagen";
  };

  if (loading) {
    return (
      <div className="container text-center">
        <p>Cargando productos...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title">Nuestros Productos</h1>
        <select
          value={categoriaSeleccionada}
          onChange={(e) => setCategoriaSeleccionada(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #ddd" }}
        >
          <option value="">Todas las categorias</option>
          {categorias.map((cat) => (
            <option key={cat.id_categoria} value={cat.id_categoria}>
              {cat.nombre}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error mb-4">{error}</p>}

      {productosFiltrados.length === 0 ? (
        <div className="text-center">
          <p className="muted">No hay productos disponibles</p>
        </div>
      ) : (
        <div className="portal-grid">
          {productosFiltrados.map((producto) => (
            <div
              key={producto.id_producto}
              className="product-card"
              onClick={() => onViewProducto(producto)}
            >
              <img
                src={getImageUrl(producto)}
                alt={producto.nombre}
                className="product-image"
                onError={(e) => {
                  e.target.src = "https://via.placeholder.com/300x200?text=Sin+Imagen";
                }}
              />
              <div className="product-info">
                <div className="product-name">{producto.nombre}</div>
                <div className="product-price">
                  Bs. {producto.precio_venta.toFixed(2)}
                </div>
                <div className={`product-stock ${getStockTotal(producto) <= 5 ? "low" : ""}`}>
                  Stock: {getStockTotal(producto)} unidades
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PortalProductos;
