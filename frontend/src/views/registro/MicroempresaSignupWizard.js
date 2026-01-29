import React, { useCallback, useEffect, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import SectionCard from "../SectionCard";
import {
  fetchPlans,
  fetchSystemQrPublic,
  getOnboardingStatus,
  startMicroempresaOnboarding,
  submitMicroempresaPayment,
} from "../../controllers/subscriptionController";
import ToastModal from "../ToastModal";
import { resolveAssetUrl } from "../../utils/url";

const storage = {
  get: (k, fallback = "") => localStorage.getItem(k) || fallback,
  set: (k, v) => localStorage.setItem(k, String(v ?? "")),
  del: (k) => localStorage.removeItem(k),
};

// keys onboarding
const KEY_SIGNUP_ID = "onb_signup_id";
const KEY_TENANT_ID = "onb_tenant_id";
const KEY_EMAIL = "onb_email";
const KEY_PLAN_ID = "onb_plan_id";
const KEY_PLAN_NAME = "onb_plan_name";
const KEY_PLAN_PRICE = "onb_plan_price";

// tipo tienda + draft
const KEY_TIPO_TIENDA = "onb_tipo_tienda";
const KEY_FORM_DRAFT = "onb_form_draft";

// placeholders para “virtual”
const VIRTUAL_DIRECCION = "Sin tienda física (virtual)";
const VIRTUAL_HORARIO = "Atención online";

// helpers
const getInt = (key) => {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : null;
};

const clearOnboardingStorage = () => {
  [
    KEY_SIGNUP_ID,
    KEY_TENANT_ID,
    KEY_EMAIL,
    KEY_PLAN_ID,
    KEY_PLAN_NAME,
    KEY_PLAN_PRICE,
    KEY_TIPO_TIENDA,
    KEY_FORM_DRAFT,
  ].forEach((k) => localStorage.removeItem(k));
};

const initialForm = {
  tipo_tienda: "fisica", // "fisica" | "virtual"
  nombre: "",
  logo_url: "",
  direccion: "", // IMPORTANTE: se mantiene como 'direccion' (se usará para link maps)
  horario_inicio: "",
  horario_fin: "",
  nombre_propietario: "",
  apellido_paterno_propietario: "",
  apellido_materno_propietario: "",
  email: "",
  password: "",
};

// Validación password: 8+ y al menos 1 mayúscula
function validarPassword(pw) {
  const value = String(pw || "");
  if (value.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (!/[A-Z]/.test(value)) return "La contraseña debe incluir al menos una letra mayúscula.";
  return "";
}

export default function MicroempresaSignupWizard() {
  const navigate = useNavigate();
  const location = useLocation();
  const isNewSignup = new URLSearchParams(location.search).get("new") === "1";

  const signupIdNum = getInt(KEY_SIGNUP_ID);

  const [selectedPlanId, setSelectedPlanId] = useState(() => storage.get(KEY_PLAN_ID, ""));
  const [selectedPlanName, setSelectedPlanName] = useState(() => storage.get(KEY_PLAN_NAME, ""));
  const [selectedPlanPrice, setSelectedPlanPrice] = useState(() => storage.get(KEY_PLAN_PRICE, ""));

  const isEditMode = Boolean(signupIdNum);

  const [form, setForm] = useState(() => {
    const savedEmail = storage.get(KEY_EMAIL, "");
    const savedTipo = storage.get(KEY_TIPO_TIENDA, "fisica");

    let draft = {};
    try {
      const raw = storage.get(KEY_FORM_DRAFT, "");
      draft = raw ? JSON.parse(raw) : {};
    } catch {
      draft = {};
    }

    return {
      ...initialForm,
      ...draft,
      password: "",
      tipo_tienda: draft.tipo_tienda || savedTipo || "fisica",
      email: draft.email || savedEmail || "",
    };
  });

  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [statusLoading, setStatusLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [toast, setToast] = useState({ open: false, message: "", variant: "success" });
  const [systemQrUrl, setSystemQrUrl] = useState("");
  const [qrPreviewError, setQrPreviewError] = useState(false);
  const [qrReloadKey, setQrReloadKey] = useState(0);
  const [qrPreviewOpen, setQrPreviewOpen] = useState(false);

  const onChange = (e) => {
    const { name, value } = e.target;

    setForm((p) => {
      const next = { ...p, [name]: value };

      if (name === "tipo_tienda" && value === "virtual") {
        next.direccion = "";
        next.horario_inicio = "";
        next.horario_fin = "";
      }

      // Guardamos draft pero nunca password
      const draftToStore = { ...next, password: "" };
      storage.set(KEY_FORM_DRAFT, JSON.stringify(draftToStore));
      storage.set(KEY_TIPO_TIENDA, next.tipo_tienda);

      // Email se guarda en minúsculas para evitar problemas de case-sensitive
      if (name === "email") storage.set(KEY_EMAIL, String(value || "").trim().toLowerCase());

      return next;
    });
  };

  const validateSchedule = () => {
    if (!form.horario_inicio || !form.horario_fin) return false;
    return form.horario_inicio < form.horario_fin;
  };

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    setMessage("");
    try {
      const { response, data } = await fetchPlans();
      if (!response.ok) {
        setMessage(data.error || "No se pudo cargar planes.");
        return;
      }
      setPlans(data.plans || []);
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    const isPlanStep = location.pathname.includes("/registro/microempresa/plan");
    if (isPlanStep && plans.length === 0 && !plansLoading) {
      loadPlans();
    }
  }, [location.pathname, plans.length, plansLoading, loadPlans]);

  useEffect(() => {
    if (!message) return;
    const lower = String(message || "").toLowerCase();
    const variant = lower.includes("no") || lower.includes("error") ? "warning" : "success";
    setToast({ open: true, message, variant });
  }, [message]);

  useEffect(() => {
    const isPaymentStep = location.pathname.includes("/registro/microempresa/pago");
    if (!isPaymentStep) return;
    fetchSystemQrPublic()
      .then(({ response, data }) => {
        if (response.ok) setSystemQrUrl(data.qr_url || "");
      })
      .catch(() => {});
  }, [location.pathname]);

  const qrSrc = systemQrUrl
    ? `${resolveAssetUrl(systemQrUrl)}${resolveAssetUrl(systemQrUrl).includes("?") ? "&" : "?"}t=${qrReloadKey}`
    : "";

  useEffect(() => {
    if (!isNewSignup) return;

    clearOnboardingStorage();
    setForm({ ...initialForm, email: "" });
    setPlans([]);
    setStatus(null);
    setMessage("");
    setSelectedPlanId("");
    setSelectedPlanName("");
    setSelectedPlanPrice("");
    navigate("/registro/microempresa/datos", { replace: true });
  }, [isNewSignup, navigate]);

  useEffect(() => {
    if (!signupIdNum && location.pathname.includes("/registro/microempresa")) {
      clearOnboardingStorage();
      setForm({ ...initialForm, email: "" });
      setPlans([]);
      setStatus(null);
      setMessage("");
      setSelectedPlanId("");
      setSelectedPlanName("");
      setSelectedPlanPrice("");
    }
  }, [location.pathname, signupIdNum]);

  const refreshStatus = async () => {
    if (!signupIdNum) return;
    setStatusLoading(true);
    try {
      const { response, data } = await getOnboardingStatus(signupIdNum);
      if (response.ok) setStatus(data);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    const isWait = location.pathname.includes("/registro/microempresa/espera");
    if (!isWait) return;

    if (!signupIdNum) {
      navigate("/registro/microempresa/datos", { replace: true });
      return;
    }

    (async () => {
      setStatusLoading(true);
      setMessage("");
      try {
        const { response, data } = await getOnboardingStatus(signupIdNum);
        if (!response.ok) {
          const err = (data?.error || "").toLowerCase();
          if (err.includes("signup_id no encontrado")) {
            clearOnboardingStorage();
            navigate("/registro/microempresa/datos", { replace: true });
            return;
          }

          setMessage(data.error || "No se pudo consultar el estado.");
          navigate("/registro/microempresa/datos", { replace: true });
          return;
        }

        setStatus(data);

        const tienePlan = Boolean(data.id_plan);
        const tieneComprobante = Boolean(data.tiene_comprobante);
        const estado = (data.estado || "").toLowerCase();

        if (!tieneComprobante || estado === "borrador" || estado === "plan_seleccionado") {
          if (!tienePlan) navigate("/registro/microempresa/plan", { replace: true });
          else navigate("/registro/microempresa/pago", { replace: true });
        }
      } finally {
        setStatusLoading(false);
      }
    })();
  }, [location.pathname, signupIdNum, navigate]);

  // PASO 1
  const handleStart = async (e) => {
    e.preventDefault();
    setMessage("");

    const tipo = form.tipo_tienda;

    if (tipo === "fisica") {
      if (!form.direccion.trim()) {
        // Solo cambia el mensaje acorde al label
        setMessage("Link de maps requerido para tienda física.");
        return;
      }
      if (!validateSchedule()) {
        setMessage("Horario inválido: el fin debe ser mayor al inicio.");
        return;
      }
    }

    if (!isEditMode && !form.password) {
      setMessage("Password requerido.");
      return;
    }

    if (!isEditMode && form.password) {
      const errPw = validarPassword(form.password);
      if (errPw) {
        setMessage(errPw);
        return;
      }
    }

    setLoading(true);
    try {
      const direccionFinal = tipo === "virtual" ? VIRTUAL_DIRECCION : form.direccion.trim();
      const horarioFinal =
        tipo === "virtual"
          ? VIRTUAL_HORARIO
          : `${form.horario_inicio} - ${form.horario_fin}`;

      const payloadBase = {
        tipo_tienda: tipo,
        nombre: form.nombre.trim(),
        logo_url: (form.logo_url || "").trim(),
        direccion: direccionFinal, // IMPORTANTE: se mantiene 'direccion'
        horario_atencion: horarioFinal,
        nombre_propietario: form.nombre_propietario.trim(),
        apellido_paterno_propietario: (form.apellido_paterno_propietario || "").trim(),
        apellido_materno_propietario: form.apellido_materno_propietario.trim(),
        email: String(form.email || "").trim().toLowerCase(), // email en minúsculas
        password: form.password || "",
      };

      const payload = {
        ...(signupIdNum ? { signup_id: signupIdNum } : {}),
        ...payloadBase,
      };

      const first = await startMicroempresaOnboarding(payload);

      if (!first.response.ok) {
        const err = (first.data?.error || "").toLowerCase();
        if (err.includes("signup_id no encontrado")) {
          storage.del(KEY_SIGNUP_ID);
          storage.del(KEY_TENANT_ID);
          storage.del(KEY_PLAN_ID);
          storage.del(KEY_PLAN_NAME);
          storage.del(KEY_PLAN_PRICE);

          const retry = await startMicroempresaOnboarding(payloadBase);
          if (!retry.response.ok) {
            setMessage(retry.data.error || "No se pudo guardar los datos.");
            return;
          }

          storage.set(KEY_SIGNUP_ID, retry.data.signup_id || "");
          storage.set(KEY_TENANT_ID, retry.data.tenant_id || "");
          storage.set(KEY_EMAIL, payloadBase.email);
          storage.set(KEY_TIPO_TIENDA, tipo);
          storage.set(KEY_FORM_DRAFT, JSON.stringify({ ...form, password: "" }));

          setMessage(retry.data.message || "Listo. Ahora selecciona un plan.");
          navigate("/registro/microempresa/plan");
          return;
        }

        setMessage(first.data.error || "No se pudo guardar los datos.");
        return;
      }

      const { data } = first;

      storage.set(KEY_SIGNUP_ID, data.signup_id || "");
      storage.set(KEY_TENANT_ID, data.tenant_id || "");
      storage.set(KEY_EMAIL, payloadBase.email);
      storage.set(KEY_TIPO_TIENDA, tipo);
      storage.set(KEY_FORM_DRAFT, JSON.stringify({ ...form, password: "" }));

      setMessage(data.message || "Listo. Ahora selecciona un plan.");
      navigate("/registro/microempresa/plan");
    } finally {
      setLoading(false);
    }
  };

  // PASO 2
  const selectPlan = (plan) => {
    storage.set(KEY_PLAN_ID, plan.id_plan);
    storage.set(KEY_PLAN_NAME, plan.nombre);
    storage.set(KEY_PLAN_PRICE, plan.precio);
    setMessage("");
    setSelectedPlanId(String(plan.id_plan));
    setSelectedPlanName(plan.nombre);
    setSelectedPlanPrice(plan.precio);
  };

  const continueToPayment = () => {
    if (!storage.get(KEY_PLAN_ID, "")) {
      setMessage("Selecciona un plan para continuar.");
      return;
    }
    navigate("/registro/microempresa/pago");
  };

  // PASO 3
  const [file, setFile] = useState(null);

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!signupIdNum) {
      setMessage("No hay registro iniciado (signup_id). Vuelve al paso 1.");
      return;
    }
    if (!selectedPlanId) {
      setMessage("Selecciona un plan (paso 2).");
      return;
    }
    if (!file) {
      setMessage("Sube un comprobante (PDF/JPG/PNG).");
      return;
    }

    setLoading(true);
    try {
      const { response, data } = await submitMicroempresaPayment({
        signup_id: signupIdNum,
        id_plan: selectedPlanId,
        file,
      });

      if (!response.ok) {
        const err = (data?.error || "").toLowerCase();
        if (err.includes("signup_id no encontrado")) {
          setMessage("Tu registro expiró o se reinició la base de datos. Vuelve a empezar.");
          return;
        }
        setMessage(data.error || "No se pudo enviar el comprobante.");
        return;
      }

      setMessage(data.message || "Enviado. Tu cuenta quedará en espera de validación.");
      navigate("/registro/microempresa/espera");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="datos" replace />} />

        {/* PASO 1 */}
        <Route
          path="datos"
          element={
            <div className="container microempresa-signup">
              <SectionCard
                title={`Registro Microempresa - Paso 1${isEditMode ? " (editar)" : ""}`}
                description="Completa los datos básicos de la microempresa."
              >
                <form className="card microempresa-form" onSubmit={handleStart}>
                  <div className="radio-group microempresa-radio" style={{ marginBottom: 10 }}>
                    <span className="microempresa-label">Tipo de tienda</span>
                    <label className="radio-option microempresa-radio-option">
                      <input
                        type="radio"
                        name="tipo_tienda"
                        value="fisica"
                        checked={form.tipo_tienda === "fisica"}
                        onChange={onChange}
                      />
                      Física
                    </label>
                    <label className="radio-option microempresa-radio-option">
                      <input
                        type="radio"
                        name="tipo_tienda"
                        value="virtual"
                        checked={form.tipo_tienda === "virtual"}
                        onChange={onChange}
                      />
                      Virtual
                    </label>
                  </div>

                  <label>
                    Nombre de microempresa
                    <input name="nombre" value={form.nombre} onChange={onChange} required />
                  </label>

                  <label>
                    Logo URL (opcional)
                    <input name="logo_url" type="url" value={form.logo_url} onChange={onChange} />
                  </label>

                  {form.tipo_tienda === "fisica" ? (
                    <>
                      {/* SOLO CAMBIO DE LABEL: sigue siendo "direccion" */}
                      <label>
                        Link de Maps
                        <input
                          name="direccion"
                          value={form.direccion}
                          onChange={onChange}
                          required
                          placeholder="https://maps.google.com/..."
                        />
                      </label>

                      <label>
                        Horario inicio
                        <input
                          name="horario_inicio"
                          type="time"
                          value={form.horario_inicio}
                          onChange={onChange}
                          required
                        />
                      </label>

                      <label>
                        Horario fin
                        <input
                          name="horario_fin"
                          type="time"
                          value={form.horario_fin}
                          onChange={onChange}
                          required
                        />
                      </label>
                    </>
                  ) : (
                    <p className="muted" style={{ marginTop: 0 }}>
                      Como tu tienda es <strong>virtual</strong>, no necesitas link de maps ni horarios.
                      Luego podrás añadir una tienda física desde tu perfil.
                    </p>
                  )}

                  <label>
                    Nombre del propietario
                    <input name="nombre_propietario" value={form.nombre_propietario} onChange={onChange} required />
                  </label>

                  <label>
                    Apellido paterno del propietario
                    <input
                      name="apellido_paterno_propietario"
                      value={form.apellido_paterno_propietario}
                      onChange={onChange}
                      required
                    />
                  </label>

                  <label>
                    Apellido materno del propietario (opcional)
                    <input
                      name="apellido_materno_propietario"
                      value={form.apellido_materno_propietario}
                      onChange={onChange}
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
                      required={!isEditMode}
                    />
                  </label>

                  <button type="submit" className="primary-button" disabled={loading}>
                    {loading
                      ? "Guardando..."
                      : isEditMode
                      ? "Guardar cambios y continuar"
                      : "Continuar (elegir plan)"}
                  </button>

                  {message && (
                    <p
                      className={
                        message.toLowerCase().includes("no") ||
                        message.toLowerCase().includes("error")
                          ? "error"
                          : "muted"
                      }
                    >
                      {message}
                    </p>
                  )}

                  <div style={{ marginTop: 12 }}>
                    <Link className="link-button secondary-link" to="/">
                      Volver al login
                    </Link>
                  </div>
                </form>
              </SectionCard>
            </div>
          }
        />

        {/* PASO 2 */}
        <Route
          path="plan"
          element={
            <div className="container microempresa-signup">
              <SectionCard title="Registro Microempresa - Paso 2" description="Selecciona el plan.">
                <div className="card">
                  {!signupIdNum && (
                    <p className="error">
                      No hay registro iniciado. Vuelve al paso 1.
                      <div style={{ marginTop: 10 }}>
                        <Link className="link-button secondary-link" to="/registro/microempresa/datos">
                          Ir al paso 1
                        </Link>
                      </div>
                    </p>
                  )}

                  <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                    <Link className="link-button secondary-link" to="/registro/microempresa/datos">
                      Volver
                    </Link>
                  </div>

                  {plans.length === 0 ? (
                    <p className="muted">{plansLoading ? "Cargando..." : "No hay planes activos."}</p>
                  ) : (
                    <div className="plan-grid">
                      {plans
                        .filter((p) => (p.estado || "").toLowerCase() === "activo")
                        .map((p) => {
                          const active = String(p.id_plan) === String(selectedPlanId);
                          const feats = Array.isArray(p.caracteristicas)
                            ? p.caracteristicas
                            : Array.isArray(p.features)
                            ? p.features
                            : [];

                          return (
                            <div key={p.id_plan} className={`plan-card ${active ? "is-active" : ""}`}>
                              <div className="plan-card-header">
                                <div className="plan-card-title">{p.nombre}</div>
                                <div className="plan-card-price">
                                  Bs <strong>{p.precio}</strong>
                                </div>
                              </div>

                              <div className="plan-card-body">
                                {feats.length > 0 ? (
                                  <ul className="plan-features">
                                    {feats.map((f, idx) => (
                                      <li key={idx}>{f}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="muted" style={{ marginTop: 0 }}>
                                    Sin características registradas.
                                  </p>
                                )}

                                <div className="plan-card-actions">
                                  <button
                                    type="button"
                                    className={active ? "ghost-button plan-select-active" : "link-button plan-select"}
                                    onClick={() => selectPlan(p)}
                                  >
                                    {active ? "Seleccionado" : "Elegir"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  <button
                    type="button"
                    className="primary-button"
                    style={{ marginTop: 12 }}
                    onClick={continueToPayment}
                    disabled={!signupIdNum}
                  >
                    Continuar (pago + comprobante)
                  </button>

                  {message && <p className="error">{message}</p>}
                </div>
              </SectionCard>
            </div>
          }
        />

        {/* PASO 3 */}
        <Route
          path="pago"
          element={
            <div className="container microempresa-signup">
              <SectionCard title="Registro Microempresa - Paso 3" description="Escanea el QR y sube tu comprobante.">
                <div className="card">
                  {!signupIdNum || !selectedPlanId ? (
                    <p className="error">
                      Falta información. Vuelve al paso 1 y 2.
                      <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                        <Link className="link-button secondary-link" to="/registro/microempresa/datos">
                          Paso 1
                        </Link>
                        <Link className="link-button secondary-link" to="/registro/microempresa/plan">
                          Paso 2
                        </Link>
                      </div>
                    </p>
                  ) : (
                    <>
                      <div className="muted plan-summary">
                        Plan: <strong>{selectedPlanName}</strong> — Monto: <strong>{selectedPlanPrice}</strong>
                      </div>

                      <div className="qr-panel">
                        <div className="qr-card">
                          {systemQrUrl ? (
                            <img
                              src={qrSrc}
                              alt="QR de pago"
                              className="qr-image"
                              onClick={() => setQrPreviewOpen(true)}
                              onError={(e) => {
                                setQrPreviewError(true);
                                e.currentTarget.alt = "QR no disponible";
                              }}
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="muted qr-placeholder">QR no disponible</div>
                          )}
                        </div>
                      </div>

                      {qrPreviewOpen && systemQrUrl && (
                        <div className="image-modal" onClick={() => setQrPreviewOpen(false)}>
                          <div className="image-modal-card" onClick={(event) => event.stopPropagation()}>
                            <div className="image-modal-title">QR de pago</div>
                            <button
                              type="button"
                              className="image-modal-close"
                              onClick={() => setQrPreviewOpen(false)}
                              aria-label="Cerrar"
                            >
                              ×
                            </button>
                            <img src={qrSrc} alt="QR de pago" />
                          </div>
                        </div>
                      )}

                      <form className="microempresa-form" onSubmit={handleSubmitPayment}>
                        <label>
                          Subir comprobante (PDF/JPG/PNG)
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                          />
                        </label>

                        <button type="submit" className="primary-button" disabled={loading}>
                          {loading ? "Enviando..." : "Enviar comprobante"}
                        </button>

                        {message && (
                          <p
                            className={
                              message.toLowerCase().includes("no") ||
                              message.toLowerCase().includes("error")
                                ? "error"
                                : "muted"
                            }
                          >
                            {message}
                          </p>
                        )}
                      </form>

                      <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                        <Link className="link-button secondary-link" to="/registro/microempresa/plan">
                          Volver a planes
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </SectionCard>
            </div>
          }
        />

        {qrPreviewError && (
          <div className="muted" style={{ marginTop: 10, display: "grid", gap: 8 }}>
            <span>No se pudo cargar el QR.</span>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                setQrPreviewError(false);
                setQrReloadKey((v) => v + 1);
              }}
            >
              Reintentar
            </button>
          </div>
        )}

        {/* PASO 4 */}
        <Route
          path="espera"
          element={
            <div className="container microempresa-signup">
              <SectionCard title="Cuenta en espera" description="Tu comprobante fue enviado. Un superusuario debe validar la cuenta.">
                <div className="card">
                  {!signupIdNum ? (
                    <p className="error">No hay registro iniciado (signup_id).</p>
                  ) : (
                    <>
                      <button type="button" className="ghost-button secondary-link" onClick={refreshStatus} disabled={statusLoading}>
                        {statusLoading ? "Consultando..." : "Consultar estado"}
                      </button>

                      {status && (
                        <div style={{ marginTop: 10 }}>
                          <div className="muted">
                            Estado: <strong>{status.estado || "pendiente"}</strong>
                          </div>
                          {status.message && <div className="muted">{status.message}</div>}
                        </div>
                      )}

                      {message && <p className="error">{message}</p>}

                      <div style={{ marginTop: 12 }}>
                        <Link className="link-button secondary-link" to="/">
                          Ir al login
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </SectionCard>
            </div>
          }
        />
      </Routes>

      <ToastModal
        open={toast.open}
        message={toast.message}
        variant={toast.variant}
        duration={10000}
        onClose={() => setToast({ open: false, message: "", variant: "success" })}
      />
    </>
  );
}
