import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { confirmPasswordReset } from "../controllers/authController";

export default function ResetPasswordView() {
  const location = useLocation();
  const navigate = useNavigate();

  const initialEmail =
    location.state?.email || localStorage.getItem("pwreset_email") || "";
  const initialRole =
    location.state?.role || localStorage.getItem("pwreset_role") || "";

  const [email, setEmail] = useState(initialEmail);
  const [role, setRole] = useState(initialRole);
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    if (!email.trim()) return false;
    if (!token.trim()) return false;
    if (!newPassword) return false;
    if (newPassword !== confirm) return false;
    return true;
  }, [email, token, newPassword, confirm]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (newPassword !== confirm) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const { response, data } = await confirmPasswordReset({
        email: email.trim(),
        role: role || undefined,
        token: token.trim(),
        new_password: newPassword,
      });

      if (!response.ok) {
        setMessage(data.error || "Ocurrió un error");
        return;
      }

      setMessage(data.message || "Contraseña actualizada correctamente.");

      // limpiamos cache
      localStorage.removeItem("pwreset_email");
      localStorage.removeItem("pwreset_role");

      // te mando al login
      setTimeout(() => navigate("/"), 700);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Restablecer contraseña</h1>

      <form className="card" onSubmit={handleSubmit}>
        <label>
          Correo
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          Rol (si aplica)
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="microempresa / cliente / super_usuario"
          />
        </label>

        <label>
          Token
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Código recibido por correo"
            required
          />
        </label>

        <label>
          Nueva contraseña
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </label>

        <label>
          Confirmar nueva contraseña
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </label>

        <button type="submit" disabled={!canSubmit || loading}>
          {loading ? "Guardando..." : "Cambiar contraseña"}
        </button>

        {message && <p className={message.toLowerCase().includes("error") ? "error" : "muted"}>{message}</p>}

        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <Link className="link-button" to="/">
            Ir a iniciar sesión
          </Link>
          <Link className="link-button" to="/forgot-password">
            Volver
          </Link>
        </div>
      </form>
    </div>
  );
}
