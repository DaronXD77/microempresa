import SectionCard from "../SectionCard";

const buildOwnerName = (microempresa) =>
  [
    microempresa?.nombre_propietario,
    microempresa?.apellido_paterno_propietario,
    microempresa?.apellido_materno_propietario,
  ]
    .filter(Boolean)
    .join(" ");
const formatHorario = (h) => {
  const s = String(h || "").trim();
  const timeRangeRe = /^\s*\d{2}:\d{2}\s*-\s*\d{2}:\d{2}\s*$/;
  if (timeRangeRe.test(s)) return s;
  return "Atención online";
};

const MicroempresaDashboard = ({ displayName, dashboardData }) => (
  <>
    {dashboardData?.stock_alerts?.length > 0 && (
      <SectionCard title="Alertas de stock" description="Atiende estos productos primero.">
        <div className="alert-grid">
          {dashboardData.stock_alerts.map((alert) => (
            <div key={alert.id_producto} className="alert-item warning">
              <strong>{alert.nombre}</strong>
              <span>Stock {alert.stock}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    )}
    <SectionCard
      title={`Bienvenido, ${displayName}`}
      description="Información general de tu empresa."
    >
      <div className="summary-grid">
        <div className="summary-card">
          <span>Productos</span>
          <strong>{dashboardData?.counts?.productos ?? 0}</strong>
        </div>
        <div className="summary-card">
          <span>Alertas de stock</span>
          <strong>{dashboardData?.stock_alerts?.length ?? 0}</strong>
        </div>
      </div>
    </SectionCard>
    <SectionCard title="Mi empresa">
      <div className="data-list">
        <div className="data-row">
          <span>Nombre</span>
          <span className="muted">{dashboardData?.microempresa?.nombre}</span>
        </div>
        <div className="data-row">
          <span>Propietario</span>
          <span className="muted">
            {buildOwnerName(dashboardData?.microempresa)}
          </span>
        </div>
        <div className="data-row">
          <span>Horario</span>
          <span className="muted">
            {formatHorario(dashboardData?.microempresa?.horario_atencion)}
          </span>
        </div>
        <div className="data-row">
          <span>Email</span>
          <span className="muted">{dashboardData?.microempresa?.email}</span>
        </div>
        <div className="data-row">
          <span>Estado</span>
          <span className="muted">{dashboardData?.microempresa?.estado}</span>
        </div>
      </div>
    </SectionCard>
  </>
);

export default MicroempresaDashboard;
