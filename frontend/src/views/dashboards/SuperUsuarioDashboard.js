import DataList from "../DataList";
import SectionCard from "../SectionCard";

const buildFullName = (item) =>
  [item?.nombre, item?.apellido_paterno, item?.apellido_materno]
    .filter(Boolean)
    .join(" ");

const filterInactive = (items = []) => items.filter((item) => item.estado === "inactivo");

const countPending = (items = []) =>
  items.filter((m) => m.estado && m.estado !== "activo").length;

const SuperUsuarioDashboard = ({ displayName, dashboardData }) => {
  const inactiveAdmins = filterInactive(dashboardData?.admins);
  const inactiveMicroempresas = filterInactive(dashboardData?.microempresas);
  const inactiveClientes = filterInactive(dashboardData?.clientes);

  const pendingMicroempresas = countPending(dashboardData?.microempresas || []);

  return (
    <>
      <SectionCard
        title={`Hola, ${displayName}`}
        description="Administración de microempresas y clientes."
      >
        <div className="summary-grid">
          <div className="summary-card">
            <span>Microempresas</span>
            <strong>{dashboardData?.counts?.microempresas ?? 0}</strong>
          </div>
          <div className="summary-card">
            <span>Clientes</span>
            <strong>{dashboardData?.counts?.clientes ?? 0}</strong>
          </div>

          {/* ✅ nuevo */}
          <div className="summary-card">
            <span>En espera</span>
            <strong>{pendingMicroempresas}</strong>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Superusuarios inactivos">
        <DataList
          items={inactiveAdmins.map((item) => ({
            id: item.id_su,
            label: buildFullName(item) || item.email,
            meta: item.email,
          }))}
          emptyLabel="No hay superusuarios inactivos."
        />
      </SectionCard>

      <SectionCard title="Microempresas inactivas">
        <DataList
          items={inactiveMicroempresas.map((item) => ({
            id: item.tenant_id,
            label: item.nombre,
            meta: item.email,
          }))}
          emptyLabel="No hay microempresas inactivas."
        />
      </SectionCard>

      <SectionCard title="Clientes inactivos">
        <DataList
          items={inactiveClientes.map((item) => ({
            id: item.id,
            label: buildFullName(item) || item.email,
            meta: item.email,
          }))}
          emptyLabel="No hay clientes inactivos."
        />
      </SectionCard>
    </>
  );
};

export default SuperUsuarioDashboard;
