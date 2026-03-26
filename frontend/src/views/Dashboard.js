import React, { useEffect, useState } from "react";
import { fetchDashboard } from "../controllers/ventaController";

const Dashboard = ({ user, role, onLogout }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const { response, data: dashData } = await fetchDashboard();
      if (response.ok) {
        setData(dashData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getNombre = () => {
    if (role === "superadmin") return user.nombre;
    if (role === "vendedor") return user.nombre;
    return user.nombre;
  };

  if (loading) {
    return (
      <div className="container text-center">
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="navbar">
        <div className="navbar-brand">Tienda UMSA - {role === "superadmin" ? "Administrador" : "Vendedor"}</div>
        <div className="navbar-menu">
          <span>Bienvenido, {getNombre()}</span>
          <button onClick={onLogout} className="btn btn-secondary">
            Cerrar sesion
          </button>
        </div>
      </div>

      <h1 className="page-title">Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Ventas del dia</div>
          <div className="stat-value">Bs. {data?.ventas_dia?.toFixed(2) || "0.00"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Ventas del mes</div>
          <div className="stat-value">Bs. {data?.ventas_mes?.toFixed(2) || "0.00"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cant. ventas hoy</div>
          <div className="stat-value">{data?.ventas_count_dia || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Cant. ventas mes</div>
          <div className="stat-value">{data?.ventas_count_mes || 0}</div>
        </div>
      </div>

      {role === "superadmin" && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Compras del mes</div>
              <div className="stat-value">Bs. {data?.compras_mes?.toFixed(2) || "0.00"}</div>
            </div>
          </div>

          {data?.alertas_stock && data.alertas_stock.length > 0 && (
            <div className="card mt-4">
              <h3 style={{ marginBottom: "16px", color: "#d32f2f" }}>
                Alertas de Stock Bajo
              </h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Stock Actual</th>
                    <th>Stock Minimo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.alertas_stock.map((item) => (
                    <tr key={item.id_producto}>
                      <td>Producto #{item.id_producto}</td>
                      <td style={{ color: "#d32f2f" }}>{item.stock_total}</td>
                      <td>{item.stock_minimo_total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <div className="grid grid-3 mt-4">
        <a href="#/productos" className="card" style={{ textAlign: "center", cursor: "pointer" }}>
          <h3>Productos</h3>
          <p className="muted">Gestionar productos y stock</p>
        </a>
        <a href="#/ventas" className="card" style={{ textAlign: "center", cursor: "pointer" }}>
          <h3>Ventas</h3>
          <p className="muted">Ver y registrar ventas</p>
        </a>
        {role === "superadmin" && (
          <>
            <a href="#/compras" className="card" style={{ textAlign: "center", cursor: "pointer" }}>
              <h3>Compras</h3>
              <p className="muted">Registrar compras a proveedores</p>
            </a>
            <a href="#/proveedores" className="card" style={{ textAlign: "center", cursor: "pointer" }}>
              <h3>Proveedores</h3>
              <p className="muted">Gestionar proveedores</p>
            </a>
            <a href="#/vendedores" className="card" style={{ textAlign: "center", cursor: "pointer" }}>
              <h3>Vendedores</h3>
              <p className="muted">Gestionar vendedores</p>
            </a>
            <a href="#/categorias" className="card" style={{ textAlign: "center", cursor: "pointer" }}>
              <h3>Categorias</h3>
              <p className="muted">Gestionar categorias</p>
            </a>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
