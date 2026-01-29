import SectionCard from "../SectionCard";

// PDF
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { openPdf } from "../../utils/pdf";
import { formatDateTimeLaPaz } from "../../utils/date";

const buildFullName = (item) =>
  [item?.nombre, item?.apellido_paterno, item?.apellido_materno]
    .filter(Boolean)
    .join(" ");

const SuperUsuarioAdmins = ({ items, onDeactivate, onActivate, currentAdminId }) => {
  // Genera un informe PDF con la lista actual de superusuarios
  const generarInformeSuperusuariosPDF = () => {
    try {
      const rowsSource = items || [];

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginX = 24;

      const generado = formatDateTimeLaPaz();

      let y = 34;
      doc.setFontSize(16);
      doc.text("Informe de superusuarios", marginX, y);

      doc.setFontSize(9);
      doc.text(`Generado: ${generado}`, marginX, y + 16);

      doc.setFontSize(9);
      doc.text(`Superusuarios listados: ${rowsSource.length}`, marginX, y + 32);

      y += 48;

      const body = rowsSource.map((a) => [
        String(a.id_su ?? "-"),
        buildFullName(a) || "-",
        a.email || "-",
        a.estado || "-",
        String(a.id_su) === String(currentAdminId) ? "Sí" : "No",
      ]);

      autoTable(doc, {
        startY: y,
        tableWidth: "auto",
        margin: { left: marginX, right: marginX },
        styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
        headStyles: { fontSize: 8 },
        head: [["ID", "Nombre", "Email", "Estado"]],
        body,
        columnStyles: {
          0: { cellWidth: 60, halign: "center" },
          1: { cellWidth: 220 },
          2: { cellWidth: 260 },
          3: { cellWidth: 90, halign: "center" },
        },
        didDrawPage: () => {
          const pageCount = doc.internal.getNumberOfPages();
          const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
          doc.setFontSize(9);
          doc.text(`Página ${currentPage} / ${pageCount}`, pageW - marginX, pageH - 16, { align: "right" });
        },
      });

      const stamp = new Date().toISOString().slice(0, 10);
      openPdf(doc, `informe_superusuarios_${stamp}.pdf`);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <SectionCard title="Superusuarios">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button type="button" className="ghost-button" onClick={generarInformeSuperusuariosPDF}>
          Generar informe (PDF)
        </button>
      </div>

      <div className="data-list">
        {items.length === 0 && <p className="muted">Sin superusuarios registrados.</p>}
        {items.map((item) => (
          <div className="data-row" key={item.id_su}>
            <div>
              <div>{buildFullName(item)}</div>
              <div className="muted">{item.email}</div>
            </div>
            <div className="row-actions">
              <span className="muted">{item.estado}</span>
              {item.estado === "activo" && item.id_su !== currentAdminId && (
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => onDeactivate(item.id_su)}
                >
                  Inactivar
                </button>
              )}
              {item.estado === "inactivo" && (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => onActivate(item.id_su)}
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

export default SuperUsuarioAdmins;
