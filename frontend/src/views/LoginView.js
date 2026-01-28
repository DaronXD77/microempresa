import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const roleLabels = {
  super_usuario: "Super usuario",
  microempresa: "Microempresa",
  cliente: "Cliente",
  empleado: "Empleado",
};

async function apiGet(path) {
  const res = await fetch(path, { method: "GET", credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error");
  return data;
}

// Validación: mínimo 8 caracteres y al menos 1 mayúscula
function validarPassword(pw) {
  const value = String(pw || "");
  if (value.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (!/[A-Z]/.test(value)) return "La contraseña debe incluir al menos una letra mayúscula.";
  return "";
}

const LoginView = ({
  form,
  mode,
  registerRole,
  roleOptions,
  message,
  onChange,
  onBulkChange,
  onSubmit,
  onSelectRole,
  onBackFromRoleSelect,
  onOpenRegister,
  onBackToLogin,
  onGuestLogin,
}) => {
  const isEmpresa = String(form.es_empresa) === "true";

  const [microempresas, setMicroempresas] = useState([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);
  const [empresasError, setEmpresasError] = useState("");
  const [empresaSearch, setEmpresaSearch] = useState("");
  const [empresaOpen, setEmpresaOpen] = useState(false);

  const shouldLoadEmpresas = mode === "register" && registerRole === "cliente";

  useEffect(() => {
    let alive = true;

    async function loadEmpresas() {
      setLoadingEmpresas(true);
      setEmpresasError("");
      try {
        const data = await apiGet("/api/public/microempresas");
        const list = data.microempresas || [];
        if (alive) setMicroempresas(list);
      } catch (e) {
        if (alive) {
          setMicroempresas([]);
          setEmpresasError(e.message);
        }
      } finally {
        if (alive) setLoadingEmpresas(false);
      }
    }

    if (shouldLoadEmpresas) loadEmpresas();
    return () => {
      alive = false;
    };
  }, [shouldLoadEmpresas]);

  const empresaOptions = useMemo(() => {
    const term = String(empresaSearch || "").trim().toLowerCase();
    const filtered = term
      ? (microempresas || []).filter((m) =>
          String(m.nombre || "").toLowerCase().includes(term)
        )
      : microempresas || [];

    return filtered.map((m) => ({
      tenant_id: m.tenant_id,
      nombre: m.nombre,
    }));
  }, [microempresas, empresaSearch]);

  const selectedEmpresa = useMemo(() => {
    if (!form.tenant_id) return null;
    return (microempresas || []).find(
      (m) => String(m.tenant_id) === String(form.tenant_id)
    );
  }, [microempresas, form.tenant_id]);

  useEffect(() => {
    if (!selectedEmpresa) return;
    if (empresaOpen) return;
    if (empresaSearch) return;
    setEmpresaSearch(selectedEmpresa.nombre || "");
  }, [selectedEmpresa, empresaOpen, empresaSearch]);

  const handleEmpresaInput = (value) => {
    setEmpresaSearch(value);
    setEmpresaOpen(true);
    if (!value.trim()) {
      onChange({ target: { name: "tenant_id", value: "" } });
    }
  };

  const matchEmpresa = (value) => {
    const term = String(value || "").trim().toLowerCase();
    if (!term) return null;
    return (
      (microempresas || []).find(
        (m) => String(m.nombre || "").toLowerCase() === term
      ) || null
    );
  };

  const handleEmpresaKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const exact = matchEmpresa(empresaSearch);
    if (exact) {
      selectEmpresa(exact);
      return;
    }
    if (empresaOptions.length === 1) {
      selectEmpresa(empresaOptions[0]);
    }
  };

  const selectEmpresa = (empresa) => {
    setEmpresaSearch(empresa?.nombre || "");
    onChange({
      target: { name: "tenant_id", value: String(empresa?.tenant_id || "") },
    });
    setEmpresaOpen(false);
  };

  const onClienteTipoChange = (e) => {
    const { name, value } = e.target;
    const razonSocial = value === "false" ? "" : form.razon_social || "";

    if (onBulkChange) {
      onBulkChange({ [name]: value, razon_social: razonSocial });
      return;
    }

    onChange({ target: { name, value } });
    onChange({ target: { name: "razon_social", value: razonSocial } });
  };

  // Wrapper para: exigir microempresa en registro cliente + normalizar email a minúsculas + validar password
  const handleSubmitWithValidation = (e) => {
    // Normalizar emails (registro y login) antes de enviar
    // - registro: form.email
    // - login: form.username
    const normalizeEmailField = (fieldName) => {
      const raw = String(form?.[fieldName] || "");
      const next = raw.trim().toLowerCase();
      if (raw !== next) {
        onChange({ target: { name: fieldName, value: next } });
      }
    };

    if (mode === "register") {
      // Exigir microempresa en registro cliente (opción A)
      if (registerRole === "cliente") {
        if (!form.tenant_id) {
          e.preventDefault();
          alert("Selecciona una microempresa para registrarte.");
          return;
        }
      }

      // Email en minúsculas en registro
      normalizeEmailField("email");

      // Validar password en registro
      const errPw = validarPassword(form.password);
      if (errPw) {
        e.preventDefault();
        alert(errPw);
        return;
      }
    }

    // Login: username (email) en minúsculas
    if (mode !== "register") {
      normalizeEmailField("username");
    }

    onSubmit(e);
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="auth-hero">
          <span className="auth-badge">Microempresas</span>
          <h1 className="auth-title">Acceso al sistema</h1>
          <p className="auth-subtitle">
            Gestiona ventas, inventario, clientes y compras en un solo lugar.
          </p>
          <div className="auth-highlights">
            <div className="auth-highlight">
              <strong>Control total</strong>
              <span>Ventas, pedidos y reportes claros.</span>
            </div>
            <div className="auth-highlight">
              <strong>Inventario vivo</strong>
              <span>Alertas, proveedores y costos en linea.</span>
            </div>
            <div className="auth-highlight">
              <strong>Clientes felices</strong>
              <span>Seguimiento rapido y pedidos ordenados.</span>
            </div>
          </div>
        </section>

        <section className="auth-panel">
          {roleOptions.length > 0 ? (
            <div className="card auth-card role-picker">
              <div className="auth-card-title">Selecciona el tipo de usuario</div>
              <div className="role-options">
                {roleOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="auth-role-button"
                    onClick={() => onSelectRole(option)}
                  >
                    {roleLabels[option] || option}
                  </button>
                ))}
              </div>
              {message && <p className="error">{message}</p>}
              <button
                type="button"
                className="auth-link"
                onClick={onBackFromRoleSelect}
              >
                Volver
              </button>
            </div>
          ) : mode === "register" ? (
            <form className="card auth-card auth-form" onSubmit={handleSubmitWithValidation}>
              <div className="auth-card-title">Registro {roleLabels[registerRole] || ""}</div>

              {registerRole === "microempresa" && (
                <div className="muted" style={{ marginBottom: 10 }}>
                  El registro de microempresa ahora es por pasos (plan + QR + comprobante).
                  <div style={{ marginTop: 10 }}>
                    <Link className="auth-pill" to="/registro/microempresa?new=1">
                      Ir al registro de microempresa
                    </Link>
                  </div>
                </div>
              )}

              {registerRole === "super_usuario" && (
                <>
                  <label>
                    Nombre
                    <input name="nombre" value={form.nombre} onChange={onChange} required />
                  </label>
                  <label>
                    Apellido paterno
                    <input
                      name="apellido_paterno"
                      value={form.apellido_paterno}
                      onChange={onChange}
                      required
                    />
                  </label>
                  <label>
                    Apellido materno
                    <input
                      name="apellido_materno"
                      value={form.apellido_materno}
                      onChange={onChange}
                      required
                    />
                  </label>
                  <label>
                    Email
                    <input
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        onChange({
                          target: {
                            name: "email",
                            value: String(e.target.value || "").toLowerCase(),
                          },
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    Password
                    <input
                      name="password"
                      type="password"
                      value={form.password}
                      onChange={onChange}
                      required
                    />
                  </label>
                  <button type="submit" className="auth-primary">
                    Registrar
                  </button>
                </>
              )}

              {registerRole === "cliente" && (
                <>
                  <label>
                    Nombre
                    <input name="nombre" value={form.nombre} onChange={onChange} required />
                  </label>

                  <label>
                    Apellido paterno (opcional)
                    <input
                      name="apellido_paterno"
                      value={form.apellido_paterno}
                      onChange={onChange}
                    />
                  </label>

                  <label>
                    Apellido materno
                    <input
                      name="apellido_materno"
                      value={form.apellido_materno}
                      onChange={onChange}
                      required
                    />
                  </label>

                  <label>
                    CI
                    <input name="ci" value={form.ci} onChange={onChange} required />
                  </label>

                  <label>
                    Microempresa
                    <div className="select-search">
                      <input
                        placeholder="Buscar microempresa"
                        value={empresaSearch || ""}
                        onChange={(e) => handleEmpresaInput(e.target.value)}
                        onKeyDown={handleEmpresaKeyDown}
                        onFocus={() => setEmpresaOpen(true)}
                        onBlur={() => {
                          const exact = matchEmpresa(empresaSearch);
                          if (exact) {
                            selectEmpresa(exact);
                          } else {
                            // Exigimos selección: si no coincide, limpiamos
                            setEmpresaSearch("");
                            onChange({ target: { name: "tenant_id", value: "" } });
                          }
                          setTimeout(() => setEmpresaOpen(false), 120);
                        }}
                        disabled={loadingEmpresas}
                      />
                      {empresaOpen && (
                        <div className="select-dropdown">
                          {empresaOptions.length === 0 ? (
                            <div className="select-empty">Sin resultados</div>
                          ) : (
                            empresaOptions.map((m) => (
                              <button
                                key={m.tenant_id}
                                type="button"
                                className="select-item"
                                onMouseDown={() => selectEmpresa(m)}
                              >
                                {m.nombre}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </label>

                  {empresasError ? (
                    <p className="error" style={{ marginTop: 8 }}>
                      {empresasError}
                    </p>
                  ) : null}

                  <div className="radio-group">
                    <span>Tipo de cliente</span>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="es_empresa"
                        value="false"
                        checked={!isEmpresa}
                        onChange={onClienteTipoChange}
                      />
                      Persona
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="es_empresa"
                        value="true"
                        checked={isEmpresa}
                        onChange={onClienteTipoChange}
                      />
                      Empresa
                    </label>
                  </div>

                  {isEmpresa && (
                    <label>
                      Razon social
                      <input
                        name="razon_social"
                        value={form.razon_social}
                        onChange={onChange}
                        required
                      />
                    </label>
                  )}

                  <label>
                    Email
                    <input
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        onChange({
                          target: {
                            name: "email",
                            value: String(e.target.value || "").toLowerCase(),
                          },
                        })
                      }
                      required
                    />
                  </label>

                  <label>
                    Password
                    <input
                      name="password"
                      type="password"
                      value={form.password}
                      onChange={onChange}
                      required
                    />
                  </label>

                  <button type="submit" className="auth-primary">
                    Registrar
                  </button>
                </>
              )}

              {message && <p className="error">{message}</p>}

              <button type="button" className="auth-link" onClick={onBackToLogin}>
                Volver al login
              </button>
            </form>
          ) : (
            <form className="card auth-card auth-form" onSubmit={handleSubmitWithValidation}>
              <div className="auth-card-title">Inicia sesion</div>
              <label>
                Email
                <input
                  name="username"
                  value={form.username}
                  onChange={(e) =>
                    onChange({
                      target: {
                        name: "username",
                        value: String(e.target.value || "").toLowerCase(),
                      },
                    })
                  }
                  required
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={onChange}
                  required
                />
              </label>

              <div style={{ marginTop: 8, marginBottom: 8 }}>
                <Link className="auth-link" to="/forgot-password">
                  Olvidaste tu contrasena?
                </Link>
              </div>

              <button type="submit" className="auth-primary">
                Entrar
              </button>

              <button type="button" className="auth-secondary" onClick={onGuestLogin}>
                Ingresar como invitado
              </button>

              {message && <p className="error">{message}</p>}

              <p className="register-text">No tienes cuenta? Registrate:</p>
              <div className="register-links auth-link-list">
                <button
                  type="button"
                  className="auth-pill"
                  onClick={() => onOpenRegister("super_usuario")}
                >
                  Superusuarios
                </button>

                <Link className="auth-pill" to="/registro/microempresa?new=1">
                  Microempresa (por plan)
                </Link>

                <button
                  type="button"
                  className="auth-pill"
                  onClick={() => onOpenRegister("cliente")}
                >
                  Clientes
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
};

export default LoginView;
