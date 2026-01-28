import React, { useEffect, useMemo, useState } from "react";
import SectionCard from "../SectionCard";
import ToastModal from "../ToastModal";
import { fetchAuditoria } from "../../controllers/auditController";

// PDF
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const SuperUsuarioAuditoria = () => {
  const [items, setItems] = useState([]);
  const [role, setRole] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [fullText, setFullText] = useState(null);
  const [toast, setToast] = useState({ open: false, message: "", variant: "success" });

  const load = async () => {
    setMessage("");
    const { response, data } = await fetchAuditoria({ role, from, to });
    if (!response.ok) {
      setMessage(data.error || "No se pudo cargar auditoria.");
      setItems([]);
      return;
    }
    setItems(data.auditoria || []);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!message) return;
    const lower = String(message || "").toLowerCase();
    const variant = lower.includes("no") || lower.includes("error") ? "warning" : "success";
    setToast({ open: true, message, variant });
  }, [message]);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") setFullText(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const visible = useMemo(() => items, [items]);

  const shouldTruncate = (value, limit = 26) => String(value || "").length > limit;

  const openFullText = (title, value) => {
    if (!value) return;
    setFullText({ title, value });
  };

  const closeFullText = () => setFullText(null);

  const renderTruncated = (value, title) => {
    const text = String(value || "");
    if (!text) return <span>-</span>;
    const showButton = shouldTruncate(text);
    return (
      <div className="truncate-row">
        <span className="truncate-text">{text}</span>
        {showButton && (
          <button
            type="button"
            className="ellipsis-button"
            aria-label={`Ver ${title}`}
            onClick={() => openFullText(title, text)}
          >
            ...
          </button>
        )}
      </div>
    );
  };

  // Genera un informe PDF con los registros actualmente listados (respeta filtros de rol/fechas)
  const generarInformeAuditoriaPDF = () => {
    try {
      const rowsSource = visible || [];

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginX = 24;

      const generado = new Date().toLocaleString("es-ES");

      let y = 34;
      doc.setFontSize(16);
      doc.text("Informe de auditoría", marginX, y);

      doc.setFontSize(9);
      doc.text(`Generado: ${generado}`, marginX, y + 16);

      const filtroRol = role ? `Rol: ${role}` : "Rol: Todos";
      const filtroDesde = from ? `Desde: ${from}` : "Desde: -";
      const filtroHasta = to ? `Hasta: ${to}` : "Hasta: -";

      doc.setFontSize(9);
      doc.text(`${filtroRol}  |  ${filtroDesde}  |  ${filtroHasta}  |  Registros: ${rowsSource.length}`, marginX, y + 32);

      y += 48;

      const body = rowsSource.map((item) => [
        item.role || "-",
        item.nombre || "-",
        item.email || "-",
        item.ip || "-",
        item.login_at ? new Date(item.login_at).toLocaleString() : "-",
        item.logout_at ? new Date(item.logout_at).toLocaleString() : "-",
      ]);

      autoTable(doc, {
        startY: y,
        tableWidth: "auto",
        margin: { left: marginX, right: marginX },
        styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
        headStyles: { fontSize: 8 },
        head: [["Rol", "Nombre", "Email", "IP", "Login", "Logout"]],
        body,
        columnStyles: {
          0: { cellWidth: 110 },
          1: { cellWidth: 180 },
          2: { cellWidth: 220 },
          3: { cellWidth: 120 },
          4: { cellWidth: 140 },
          5: { cellWidth: 140 },
        },
        didDrawPage: () => {
          const pageCount = doc.internal.getNumberOfPages();
          const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
          doc.setFontSize(9);
          doc.text(`Página ${currentPage} / ${pageCount}`, pageW - marginX, pageH - 16, { align: "right" });
        },
      });

      const stamp = new Date().toISOString().slice(0, 10);
      doc.save(`informe_auditoria_${stamp}.pdf`);

      setToast({ open: true, message: "Informe PDF generado.", variant: "success" });
    } catch (e) {
      console.error(e);
      setMessage(e?.message || "No se pudo generar el informe.");
    }
  };

  return (
    <SectionCard title="Auditoria" description="Registro de inicios y cierres de sesion.">
      <div className="card">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label>
            <span className="form-title">Rol</span>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">Todos</option>
              <option value="super_usuario">Super usuario</option>
              <option value="microempresa">Microempresa</option>
              <option value="cliente">Cliente</option>
            </select>
          </label>
          <label>
            <span className="form-title">Desde</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            <span className="form-title">Hasta</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button type="button" className="ghost-button" onClick={load}>
            Filtrar
          </button>

          {/* Botón nuevo para generar informe PDF */}
          <button type="button" className="ghost-button" onClick={generarInformeAuditoriaPDF}>
            Generar informe (PDF)
          </button>
        </div>

        <ToastModal
          open={toast.open}
          message={toast.message}
          variant={toast.variant}
          duration={10000}
          onClose={() => setToast({ open: false, message: "", variant: "success" })}
        />

        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Rol</th>
                <th>Nombre</th>
                <th>Email</th>
                <th>IP</th>
                <th>Login</th>
                <th>Logout</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="audit-empty muted">
                    Sin registros.
                  </td>
                </tr>
              ) : (
                visible.map((item) => (
                  <tr key={item.id_audit}>
                    <td>{renderTruncated(item.role, "Rol")}</td>
                    <td>{renderTruncated(item.nombre || "-", "Nombre")}</td>
                    <td>{renderTruncated(item.email || "-", "Email")}</td>
                    <td>{renderTruncated(item.ip || "-", "IP")}</td>
                    <td>{item.login_at ? new Date(item.login_at).toLocaleString() : "-"}</td>
                    <td>{item.logout_at ? new Date(item.logout_at).toLocaleString() : "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {fullText && (
        <div className="text-modal" onClick={closeFullText}>
          <div className="text-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="form-title">{fullText.title}</div>
            <div className="text-modal-body">{fullText.value}</div>
            <button type="button" className="ghost-button" onClick={closeFullText}>
              Volver
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
};

export default SuperUsuarioAuditoria;
