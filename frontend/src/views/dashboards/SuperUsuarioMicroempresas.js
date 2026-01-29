import SectionCard from "../SectionCard";

// PDF
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { openPdf } from "../../utils/pdf";
import { formatDateTimeLaPaz } from "../../utils/date";

const prettyTipo = (t) => {
  const v = String(t || "").toLowerCase();
  if (v === "fisica") return "Física";
  if (v === "virtual") return "Virtual";
  return t || "-";
};

const prettyHorario = (h) => {
  const v = String(h || "").trim();
  if (!v) return "-";
  if (v.toLowerCase() === "no aplica" || v.toLowerCase() === "no disponible") return "No aplica";
  return v;
};

const prettyDireccion = (d) => {
  const v = String(d || "").trim();
  if (!v) return "-";
  if (v.toLowerCase() === "no aplica" || v.toLowerCase() === "no disponible") return "No aplica";
  return v;
};

const SuperUsuarioMicroempresas = ({ items, onDeactivate, onActivate }) => {
  // Genera un informe PDF con la lista actual de microempresas
  const generarInformeMicroempresasPDF = () => {
    try {
      const rowsSource = items || [];

      const doc = new jsPDF({
        orientation: "landscape", // horizontal
        unit: "pt",               // puntos (mejor control)
        format: "a3",             // tamaño
      });
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 40;


      const generado = formatDateTimeLaPaz();

      let y = 34;
      doc.setFontSize(16);
      doc.text("Informe de microempresas", marginX, y);

      doc.setFontSize(9);
      doc.text(`Generado: ${generado}`, marginX, y + 16);

      doc.setFontSize(9);
      doc.text(`Microempresas listadas: ${rowsSource.length}`, marginX, y + 32);

      y += 48;

      const body = rowsSource.map((m) => [
        String(m.tenant_id ?? "-"),
        String(m.nombre || "-"),
        String(m.email || "-"),
        prettyTipo(m.tipo_tienda),
        prettyDireccion(m.direccion),
        prettyHorario(m.horario_atencion),
        String(m.estado || "-"),
      ]);

      autoTable(doc, {
        pageBreak: "auto",
        rowPageBreak: "avoid",
        startY: y,
        tableWidth: pageWidth - marginX * 2,
        margin: { left: marginX, right: marginX },
        styles: {
          fontSize: 9,
          cellPadding: 6,
          overflow: "linebreak",
          valign: "middle",
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: 255,
          halign: "center",
          fontSize: 9,
        },
        bodyStyles: {
          halign: "left",
        },
        head: [[
          "Tenant ID",
          "Nombre",
          "Email",
          "Tipo",
          "Dirección",
          "Horario",
        ]],
        body,
        columnStyles: {
          0: { cellWidth: 70, halign: "center" },
          1: { cellWidth: 140 },
          2: { cellWidth: 220 },
          3: { cellWidth: 90, halign: "center" },
          4: { cellWidth: 260 },
          5: { cellWidth: 120, halign: "center" },
        },
      });


      const stamp = new Date().toISOString().slice(0, 10);
      openPdf(doc, `informe_microempresas_${stamp}.pdf`);
    } catch (e) {
      // Este componente no tiene ToastModal propio; si quieres, puedes propagar el error al padre
      console.error(e);
    }
  };

  return (
    <SectionCard title="Microempresas">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button type="button" className="ghost-button" onClick={generarInformeMicroempresasPDF}>
          Generar informe (PDF)
        </button>
      </div>

      <div className="data-list">
        {items.length === 0 && <p className="muted">Sin microempresas registradas.</p>}

        {items.map((item) => (
          <div className="data-row" key={item.tenant_id}>
            <div>
              <div style={{ fontWeight: 700 }}>{item.nombre}</div>
              <div className="muted">{item.email}</div>

              <div className="muted">Tipo: {prettyTipo(item.tipo_tienda)}</div>
              <div className="muted">Dirección: {prettyDireccion(item.direccion)}</div>
              <div className="muted">Horario: {prettyHorario(item.horario_atencion)}</div>
            </div>

            <div className="row-actions">
              <span className="muted">{item.estado}</span>

              {item.estado === "activo" && (
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => onDeactivate(item.tenant_id)}
                >
                  Inactivar
                </button>
              )}

              {item.estado === "inactivo" && (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onActivate(item.tenant_id)}
                >
                  Activar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
};

export default SuperUsuarioMicroempresas;
