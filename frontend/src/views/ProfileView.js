import React, { useEffect, useState } from "react";
import ToastModal from "./ToastModal";

const ProfileView = ({ role, form, message, onChange, onSubmit, isSaving, forcePasswordReset }) => {
  const [toast, setToast] = useState({ open: false, message: "", variant: "success" });

  useEffect(() => {
    if (!message) return;
    const lower = String(message || "").toLowerCase();
    const variant = lower.includes("no") || lower.includes("error") ? "warning" : "success";
    setToast({ open: true, message, variant });
  }, [message]);

  return (
    <form className="content-card" onSubmit={onSubmit}>
    <h2>Perfil</h2>
    {forcePasswordReset && (
      <p className="error">
        Debes cambiar tu contraseña antes de continuar.
        {role === "empleado" ? " Tu contraseña temporal es tu CI." : " Tu usuario es tu correo."}
      </p>
    )}

    {role === "super_usuario" && (
      <>
        <label>
          Nombre
          <input name="nombre" value={form.nombre} onChange={onChange} required />
        </label>
        <label>
          Apellido paterno
          <input name="apellido_paterno" value={form.apellido_paterno} onChange={onChange} required />
        </label>
        <label>
          Apellido materno
          <input name="apellido_materno" value={form.apellido_materno} onChange={onChange} required />
        </label>
        <label>
          Email
          <input name="email" type="email" value={form.email} onChange={onChange} required disabled />
        </label>
      </>
    )}

    {role === "microempresa" && (
      <>
        {/* ✅ tipo tienda */}
        <div className="radio-group">
          <span>Tipo de tienda</span>
          <label className="radio-option">
            <input
              type="radio"
              name="tipo_tienda"
              value="fisica"
              checked={form.tipo_tienda === "fisica"}
              onChange={onChange}
            />
            Física
          </label>
          <label className="radio-option">
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
          Logo URL
          <input name="logo_url" type="url" value={form.logo_url} onChange={onChange} />
        </label>

        <label>
          Celular de contacto
          <input
            name="telefono_contacto"
            value={form.telefono_contacto}
            onChange={onChange}
            placeholder="8 digitos"
          />
        </label>

        {/* ✅ solo si es física */}
        {form.tipo_tienda === "fisica" ? (
          <>
            <label>
              Dirección
              <input name="direccion" value={form.direccion} onChange={onChange} />
            </label>

            <label>
              Horario inicio
              <input name="horario_inicio" type="time" value={form.horario_inicio} onChange={onChange} required />
            </label>

            <label>
              Horario fin
              <input name="horario_fin" type="time" value={form.horario_fin} onChange={onChange} required />
            </label>
          </>
        ) : (
          <p className="muted" style={{ marginTop: 0 }}>
            Tu tienda es <strong>virtual</strong>. Si quieres agregar una tienda física,
            selecciona <strong>Física</strong> y completa Dirección/Horarios.
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
          Apellido materno del propietario
          <input
            name="apellido_materno_propietario"
            value={form.apellido_materno_propietario}
            onChange={onChange}
            required
          />
        </label>
        <label>
          Email
          <input name="email" type="email" value={form.email} onChange={onChange} required disabled />
        </label>
      </>
    )}

    {role === "cliente" && (
      <>
        <label>
          Nombre
          <input name="nombre" value={form.nombre} onChange={onChange} required />
        </label>
        <label>
          Apellido paterno
          <input name="apellido_paterno" value={form.apellido_paterno} onChange={onChange} required />
        </label>
        <label>
          Apellido materno
          <input name="apellido_materno" value={form.apellido_materno} onChange={onChange} required />
        </label>
        <label>
          CI
          <input name="ci" value={form.ci} onChange={onChange} required />
        </label>

        <div className="radio-group">
          <span>Tipo de cliente</span>
          <label className="radio-option">
            <input type="radio" name="es_empresa" value="false" checked={form.es_empresa === "false"} onChange={onChange} disabled />
            Persona
          </label>
          <label className="radio-option">
            <input type="radio" name="es_empresa" value="true" checked={form.es_empresa === "true"} onChange={onChange} disabled />
            Empresa
          </label>
        </div>

        {form.es_empresa === "true" && (
          <label>
            Razón social
            <input name="razon_social" value={form.razon_social} onChange={onChange} required />
          </label>
        )}

        <label>
          Email
          <input name="email" type="email" value={form.email} onChange={onChange} required disabled />
        </label>
      </>
    )}

    {role === "empleado" && (
      <>
        <label>
          Nombre
          <input name="nombre" value={form.nombre} onChange={onChange} required />
        </label>
        <label>
          Apellido paterno
          <input name="apellido_paterno" value={form.apellido_paterno} onChange={onChange} required />
        </label>
        <label>
          Apellido materno
          <input name="apellido_materno" value={form.apellido_materno} onChange={onChange} required />
        </label>
        <label>
          CI
          <input name="ci" value={form.ci} onChange={onChange} required />
        </label>
        <label>
          Email
          <input name="email" type="email" value={form.email} onChange={onChange} required disabled />
        </label>
      </>
    )}

    <label>
      {forcePasswordReset ? "Nueva contraseña (obligatoria)" : "Password (opcional)"}
      <input
        name="password"
        type="password"
        value={form.password}
        onChange={onChange}
        required={Boolean(forcePasswordReset)}
      />
    </label>

    <button type="submit" disabled={isSaving}>
      {isSaving ? "Guardando..." : "Guardar cambios"}
    </button>

    <ToastModal
      open={toast.open}
      message={toast.message}
      variant={toast.variant}
      duration={10000}
      onClose={() => setToast({ open: false, message: "", variant: "success" })}
    />
  </form>
  );
};

export default ProfileView;
