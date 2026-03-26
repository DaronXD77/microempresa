import React, { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { Dialog } from "@capacitor/dialog";

import LoginView from "./views/LoginView";
import PortalProductos from "./views/PortalProductos";
import PortalProductoDetalle from "./views/PortalProductoDetalle";
import Dashboard from "./views/Dashboard";
import { fetchMe, logout } from "./controllers/authController";

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!window.Capacitor) return;
    let handler;
    (async () => {
      handler = await CapacitorApp.addListener("backButton", async () => {
        const hash = window.location.hash || "";
        if (hash && hash !== "#/" && hash !== "#/") {
          window.history.back();
          return;
        }
        const res = await Dialog.confirm({
          title: "Salir",
          message: "¿Deseas salir de la aplicación?",
          okButtonTitle: "Salir",
          cancelButtonTitle: "Cancelar",
        });
        if (res.value) CapacitorApp.exitApp();
      });
    })();
    return () => {
      if (handler) handler.remove();
    };
  }, []);

  const checkAuth = async () => {
    try {
      const { response, data } = await fetchMe();
      if (response.ok && data.user) {
        setUser(data.user);
        setRole(data.role);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData, userRole) => {
    setUser(userData);
    setRole(userRole);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error(err);
    }
    setUser(null);
    setRole(null);
  };

  const handleViewProducto = (producto) => {
    setProductoSeleccionado(producto);
    window.location.hash = `#/producto/${producto.id_producto}`;
  };

  const handleBackProductos = () => {
    setProductoSeleccionado(null);
    window.location.hash = "#/";
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <p>Cargando...</p>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route
          path="/"
          element={
            user ? (
              <Dashboard user={user} role={role} onLogout={handleLogout} />
            ) : (
              <LoginView onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/portal"
          element={
            user ? (
              <Dashboard user={user} role={role} onLogout={handleLogout} />
            ) : (
              <LoginView onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/productos"
          element={
            user ? (
              <Dashboard user={user} role={role} onLogout={handleLogout} />
            ) : (
              <LoginView onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/producto/:id"
          element={
            user ? (
              <Dashboard user={user} role={role} onLogout={handleLogout} />
            ) : (
              <LoginView onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </HashRouter>
  );
}

export default App;
