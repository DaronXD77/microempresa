import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { requestPasswordReset } from "../controllers/authController";

const roleLabels = {
  super_usuario: "Super usuario",
  microempresa: "Microempresa",
  cliente: "Cliente",
};

export default function ForgotPasswordView() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [roleOptions, setRoleOptions] = useState([]);

  const sendRequest = async (role) => {
    setLoading(true);
    setMessage("");
    setRoleOptions([]);

    try {
      const { response, data } = await requestPasswordReset({
        email: email.trim(),
        role,
      });

      if (!response.ok) {
        setMessage(
          data?.error ||
            "Ocurrió un error. Verifica el correo o que el backend esté corriendo."
        );
        return;
      }

      // Si el correo existe en varios roles -> seleccionar
      if (data?.select_role) {
        setRoleOptions(data.roles || []);
        setMessage(
          "Este correo existe en más de un tipo de usuario. Selecciona tu rol."
        );
        return;
      }

      // Guardamos para sobrevivir recarga
      localStorage.setItem("pwreset_email", email.trim());
      localStorage.setItem("pwreset_role", role || data?.role || "");

      setMessage(data?.message || "Se envió el token a tu correo.");

      // Pasamos a pantalla de reset
      navigate("/reset-password", {
        state: { email: email.trim(), role: role || data?.role || null },
      });
    } catch (err) {
      setMessage(
        "No se pudo conectar con el backend. Verifica que esté corriendo en http://localhost:5000"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setRoleOptions([]);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setMessage("Ingresa un correo válido.");
      return;
    }

    // role undefined -> backend decide o pide seleccionar rol
    await sendRequest(undefined);
  };

  return (
    <div className="container">
      <h1>Recuperar contraseña</h1>

      <form className="card" onSubmit={handleSubmit}>
        <label>
          Ingresa tu correo
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu_correo@ejemplo.com"
            required
            disabled={loading}
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Enviando..." : "Enviar token"}
        </button>

        {message && (
          <p className={message.toLowerCase().includes("error") ? "error" : "muted"}>
            {message}
          </p>
        )}

        {roleOptions.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <p className="muted">Selecciona el tipo de usuario:</p>
            <div className="role-options">
              {roleOptions.map((role) => (
                <button
                  key={role}
                  type="button"
                  disabled={loading}
                  onClick={() => sendRequest(role)}
                >
                  {roleLabels[role] || role}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <Link className="link-button" to="/">
            Volver al login
          </Link>
        </div>
      </form>
    </div>
  );
}
