import DataList from "../DataList";
import SectionCard from "../SectionCard";

const ClienteDashboard = ({ displayName }) => (
  <>
    <SectionCard
      title={`Hola, ${displayName}`}
      description="¿Qué deseas comprar hoy?"
    />
    <SectionCard title="Notificaciones">
      <p className="muted">Sin notificaciones por ahora.</p>
    </SectionCard>
  </>
);

export default ClienteDashboard;
