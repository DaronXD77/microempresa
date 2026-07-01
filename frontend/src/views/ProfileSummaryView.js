import { NavLink } from "react-router-dom";

const buildFullName = (item) =>
  [item?.nombre, item?.apellido_paterno, item?.apellido_materno]
    .filter(Boolean)
    .join(" ");

const buildOwnerName = (item) =>
  [
    item?.nombre_propietario,
    item?.apellido_paterno_propietario,
    item?.apellido_materno_propietario,
  ]
    .filter(Boolean)
    .join(" ");

const formatHorario = (h) => {
  const s = String(h || "").trim();
  const timeRangeRe = /^\s*\d{2}:\d{2}\s*-\s*\d{2}:\d{2}\s*$/;
  if (timeRangeRe.test(s)) return s;
  return "Atención online";
};


const ProfileSummaryView = ({ role, user, canEdit }) => (
  <div className="content-card">
    <h2>Perfil</h2>
    {role === "super_usuario" && (
      <div className="data-list">
        <div className="data-row">
          <span>Nombre completo</span>
          <span className="muted">{buildFullName(user)}</span>
        </div>
        <div className="data-row">
          <span>Email</span>
          <span className="muted">{user?.email}</span>
        </div>
        <div className="data-row">
          <span>Estado</span>
          <span className="muted">{user?.estado}</span>
        </div>
      </div>
    )}
    {role === "microempresa" && (
      <div className="data-list">
        <div className="data-row">
          <span>Nombre</span>
          <span className="muted">{user?.nombre}</span>
        </div>
        <div className="data-row">
          <span>Propietario</span>
          <span className="muted">{buildOwnerName(user)}</span>
        </div>
        <div className="data-row">
          <span>Horario</span>
          <span className="muted">{formatHorario(user?.horario_atencion)}</span>
        </div>
        <div className="data-row">
          <span>Email</span>
          <span className="muted">{user?.email}</span>
        </div>
        <div className="data-row">
          <span>Estado</span>
          <span className="muted">{user?.estado}</span>
        </div>
      </div>
    )}
    {role === "cliente" && (
      <div className="data-list">
        <div className="data-row">
          <span>Nombre</span>
          <span className="muted">{buildFullName(user)}</span>
        </div>
        <div className="data-row">
          <span>Razón social</span>
          <span className="muted">{user?.razon_social || "-"}</span>
        </div>
        <div className="data-row">
          <span>Email</span>
          <span className="muted">{user?.email}</span>
        </div>
        <div className="data-row">
          <span>Estado</span>
          <span className="muted">{user?.estado}</span>
        </div>
      </div>
    )}
    {role === "empleado" && (
      <div className="data-list">
        <div className="data-row">
          <span>Nombre</span>
          <span className="muted">{buildFullName(user)}</span>
        </div>
        <div className="data-row">
          <span>Email</span>
          <span className="muted">{user?.email}</span>
        </div>
        <div className="data-row">
          <span>Permisos</span>
          <span className="muted">{(user?.permisos || []).join(", ") || "-"}</span>
        </div>
        <div className="data-row">
          <span>Estado</span>
          <span className="muted">{user?.estado}</span>
        </div>
      </div>
    )}
    {canEdit && (
      <NavLink className="primary-link" to="/perfil/editar">
        Editar perfil
      </NavLink>
    )}
  </div>
);

export default ProfileSummaryView;
