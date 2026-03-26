import React, { useState } from "react";
import { Link } from "react-router-dom";
import { login, registerCliente } from "../controllers/authController";

const LoginView = ({ onLogin, onRegister }) => {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { response, data } = await login(email, password);
      if (!response.ok) {
        setError(data.error || "Error al iniciar sesion");
        return;
      }
      onLogin(data.user, data.role);
    } catch (err) {
      setError("Error de conexion");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (!nombre.trim()) {
      setError("Nombre es requerido");
      return;
    }
    if (!email.trim()) {
      setError("Email es requerido");
      return;
    }
    if (password.length < 8) {
      setError("Password debe tener al menos 8 caracteres");
      return;
    }

    setLoading(true);

    try {
      const { response, data } = await registerCliente({
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        telefono: telefono.trim(),
        password,
      });

      if (!response.ok) {
        setError(data.error || "Error al registrarse");
        return;
      }

      onLogin(data.user, data.role);
    } catch (err) {
      setError("Error de conexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="auth-hero">
          <span className="auth-badge">Tienda Virtual</span>
          <h1 className="auth-title">UMSA Somos Todos</h1>
          <p className="auth-subtitle">
            Tu tienda universitaria de confianza. Compra productos de calidad.
          </p>
          <div className="auth-highlights">
            <div className="auth-highlight">
              <strong>Productos de Calidad</strong>
              <span>Insumos verificados para la comunidad UMSA</span>
            </div>
            <div className="auth-highlight">
              <strong>Compras Seguras</strong>
              <span>Pagos por QR de manera segura</span>
            </div>
            <div className="auth-highlight">
              <strong>Entregas Rapidas</strong>
              <span>Recoge en campus o recibe en tu direccion</span>
            </div>
          </div>
        </section>

        <section className="auth-panel">
          <div className="card auth-card">
            {mode === "login" ? (
              <>
                <div className="auth-card-title">Iniciar Sesion</div>
                <form onSubmit={handleLogin}>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Tu password"
                      required
                    />
                  </div>
                  {error && <p className="error">{error}</p>}
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Cargando..." : "Entrar"}
                  </button>
                </form>
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => setMode("register")}
                >
                  No tienes cuenta? Registrate
                </button>
              </>
            ) : (
              <>
                <div className="auth-card-title">Registrarse</div>
                <form onSubmit={handleRegister}>
                  <div className="form-group">
                    <label>Nombre completo</label>
                    <input
                      type="text"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Tu nombre"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Telefono (opcional)</label>
                    <input
                      type="tel"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="77712345"
                    />
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimo 8 caracteres"
                      required
                    />
                  </div>
                  {error && <p className="error">{error}</p>}
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Registrando..." : "Registrarse"}
                  </button>
                </form>
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => setMode("login")}
                >
                  Ya tienes cuenta? Inicia sesion
                </button>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default LoginView;
