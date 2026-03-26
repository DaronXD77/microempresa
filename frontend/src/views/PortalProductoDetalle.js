import React, { useState } from "react";
import { createVenta, fetchQrVenta } from "../controllers/ventaController";

const PortalProductoDetalle = ({ producto, onBack, onVentaCreada }) => {
  const [tallaSeleccionada, setTallaSeleccionada] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [qrData, setQrData] = useState(null);

  const tallasDisponibles = producto.tallas?.filter((t) => t.stock > 0) || [];

  const getImageUrl = () => {
    if (producto.imagenes && producto.imagenes.length > 0) {
      return producto.imagenes[0].url;
    }
    return "https://via.placeholder.com/400x300?text=Sin+Imagen";
  };

  const handleComprar = async () => {
    if (producto.es_textil && !tallaSeleccionada) {
      setError("Selecciona una talla");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const detalles = [
        {
          id_producto_talla: producto.es_textil
            ? tallasDisponibles.find((t) => t.id_talla === parseInt(tallaSeleccionada))?.id_producto_talla
            : producto.tallas?.[0]?.id_producto_talla,
          cantidad: cantidad,
          precio_unitario: producto.precio_venta,
          descuento: 0,
        },
      ];

      const { response, data } = await createVenta({
        tipo_venta: "virtual",
        tipo_comprador: "normal",
        detalles,
      });

      if (!response.ok) {
        setError(data.error || "Error al crear venta");
        return;
      }

      const qrRes = await fetchQrVenta(data.venta.id_venta);
      if (qrRes.response.ok) {
        setQrData(qrRes.data);
      }

      setShowQr(true);
      onVentaCreada && onVentaCreada(data);
    } catch (err) {
      setError("Error de conexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <button onClick={onBack} className="btn btn-secondary mb-4">
        &larr; Volver a productos
      </button>

      <div className="card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <div>
          <img
            src={getImageUrl()}
            alt={producto.nombre}
            style={{ width: "100%", borderRadius: "8px" }}
            onError={(e) => {
              e.target.src = "https://via.placeholder.com/400x300?text=Sin+Imagen";
            }}
          />
        </div>

        <div>
          <h1 style={{ fontSize: "28px", marginBottom: "8px" }}>{producto.nombre}</h1>
          
          {producto.categoria && (
            <span className="badge badge-info mb-4">{producto.categoria.nombre}</span>
          )}

          <div style={{ fontSize: "32px", fontWeight: "bold", color: "#1976d2", marginBottom: "16px" }}>
            Bs. {producto.precio_venta.toFixed(2)}
          </div>

          {producto.descripcion && (
            <p style={{ marginBottom: "16px", color: "#555" }}>{producto.descripcion}</p>
          )}

          {producto.es_textil && (
            <div className="form-group">
              <label>Talla</label>
              <div className="flex gap-2 flex-wrap">
                {tallasDisponibles.map((t) => (
                  <button
                    key={t.id_talla}
                    onClick={() => setTallaSeleccionada(t.id_talla)}
                    className={`btn ${tallaSeleccionada == t.id_talla ? "btn-primary" : "btn-secondary"}`}
                  >
                    {t.talla?.nombre || "Talla"}
                    <span style={{ marginLeft: "4px", fontSize: "12px" }}>
                      ({t.stock})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Cantidad</label>
            <input
              type="number"
              min="1"
              max={tallaSeleccionada
                ? tallasDisponibles.find((t) => t.id_talla === parseInt(tallaSeleccionada))?.stock
                : producto.tallas?.[0]?.stock || 10
              }
              value={cantidad}
              onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
              style={{ width: "100px" }}
            />
          </div>

          {error && <p className="error mb-4">{error}</p>}

          <button
            onClick={handleComprar}
            className="btn btn-primary"
            disabled={loading || (producto.es_textil && !tallaSeleccionada)}
            style={{ width: "100%", padding: "14px", fontSize: "16px" }}
          >
            {loading ? "Procesando..." : "Comprar ahora"}
          </button>
        </div>
      </div>

      {showQr && qrData && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowQr(false)}
        >
          <div
            className="card"
            style={{ textAlign: "center", maxWidth: "400px", width: "90%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: "16px" }}>Pago por QR</h2>
            <p style={{ marginBottom: "16px" }}>
              Monto: <strong>Bs. {qrData.monto.toFixed(2)}</strong>
            </p>
            <img
              src={`data:image/png;base64,${qrData.qr}`}
              alt="QR de pago"
              style={{ width: "200px", height: "200px", margin: "0 auto" }}
            />
            <p style={{ marginTop: "16px", fontSize: "14px", color: "#666" }}>
              Referencia: {qrData.referencia}
            </p>
            <button
              onClick={() => setShowQr(false)}
              className="btn btn-primary mt-4"
              style={{ width: "100%" }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortalProductoDetalle;
