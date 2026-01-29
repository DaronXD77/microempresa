import React, { useEffect, useState } from "react";
import SectionCard from "../SectionCard";
import ToastModal from "../ToastModal";
import {
  createEmpleado,
  fetchEmpleados,
  resetEmpleadoPassword,
  updateEmpleado,
} from "../../controllers/empleadoController";

// PDF
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { openPdf } from "../../utils/pdf";
import { formatDateTimeLaPaz } from "../../utils/date";

const PERMISOS = [
  { key: "ventas", label: "Ventas" },
  { key: "pedidos", label: "Pedidos" },
  { key: "pos", label: "Punto de venta" },
  { key: "inventario", label: "Inventario" },
  { key: "compras", label: "Compras" },
  { key: "economia", label: "Economia" },
  { key: "proveedores", label: "Proveedores" },
  { key: "gestion_clientes", label: "Gestion de clientes" },
  { key: "historial_compras", label: "Historial de compras" },
];

const emptyForm = {
  nombre: "",
  apellido_paterno: "",
  apellido_materno: "",
  email: "",
  ci: "",
  password: "",
  permisos: [],
};

const MicroempresaEmpleados = () => {
  const [empleados, setEmpleados] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState({ open: false, message: "", variant: "success" });

  const load = async () => {
    const { response, data } = await fetchEmpleados();
    if (response.ok) setEmpleados(data.empleados || []);
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

  const togglePermiso = (current, key) => {
    if (current.includes(key)) return current.filter((p) => p !== key);
    return [...current, key];
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    if (!form.nombre || !form.apellido_paterno || !form.apellido_materno || !form.email || !form.ci) {
      setMessage("Completa nombre, apellidos, email y CI.");
      return;
    }
    if (form.permisos.length === 0) {
      setMessage("Selecciona al menos un permiso.");
      return;
    }

    if (editingId) {
      const { response, data } = await updateEmpleado(editingId, {
        ...form,
        password: undefined,
      });
      if (!response.ok) {
        setMessage(data.error || "No se pudo actualizar.");
        return;
      }
      setMessage("Empleado actualizado.");
    } else {
      const { response, data } = await createEmpleado(form);
      if (!response.ok) {
        setMessage(data.error || "No se pudo crear.");
        return;
      }
      setMessage("Empleado creado.");
    }
    setForm(emptyForm);
    setEditingId(null);
    await load();
  };

  const startEdit = (empleado) => {
    setEditingId(empleado.id_empleado);
    setForm({
      nombre: empleado.nombre || "",
      apellido_paterno: empleado.apellido_paterno || "",
      apellido_materno: empleado.apellido_materno || "",
      email: empleado.email || "",
      ci: empleado.ci || "",
      password: "",
      permisos: empleado.permisos || [],
    });
  };

  const handleReset = async (id) => {
    const { response, data } = await resetEmpleadoPassword(id);
    if (!response.ok) {
      setMessage(data.error || "No se pudo resetear.");
      return;
    }
    setMessage("Contraseña reiniciada.");
    await load();
  };

  // Genera un informe PDF de empleados registrados
  const generarInformeEmpleadosPDF = () => {
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginX = 24;

    const generado = formatDateTimeLaPaz();

      let y = 34;
      doc.setFontSize(16);
      doc.text("Informe de empleados", marginX, y);

      doc.setFontSize(9);
      doc.text(`Generado: ${generado}`, marginX, y + 16);

      doc.setFontSize(9);
      doc.text(`Empleados listados: ${empleados.length}`, marginX, y + 32);

      y += 48;

      const permisosLabel = (arr) => {
        const list = Array.isArray(arr) ? arr : [];
        if (!list.length) return "-";
        // Mapea keys a labels si existe en PERMISOS
        const map = new Map(PERMISOS.map((p) => [p.key, p.label]));
        return list.map((k) => map.get(k) || k).join(", ");
      };

      const body = (empleados || []).map((e) => [
        `${e.nombre || ""} ${e.apellido_paterno || ""} ${e.apellido_materno || ""}`.trim() || "-",
        e.email || "-",
        e.ci || "-",
        permisosLabel(e.permisos),
      ]);

      autoTable(doc, {
        startY: y,
        tableWidth: "auto",
        margin: { left: marginX, right: marginX },
        styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
        headStyles: { fontSize: 8 },
        head: [["Empleado", "Email", "CI", "Permisos"]],
        body,
        columnStyles: {
          0: { cellWidth: 200 },
          1: { cellWidth: 180 },
          2: { cellWidth: 90 },
          3: { cellWidth: 360 },
        },
        didDrawPage: () => {
          const pageCount = doc.internal.getNumberOfPages();
          const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
          doc.setFontSize(9);
          doc.text(`Página ${currentPage} / ${pageCount}`, pageW - marginX, pageH - 16, { align: "right" });
        },
      });

      const stamp = new Date().toISOString().slice(0, 10);
      openPdf(doc, `informe_empleados_${stamp}.pdf`);

      setToast({ open: true, message: "Informe PDF generado.", variant: "success" });
    } catch (e) {
      console.error(e);
      setMessage(e?.message || "No se pudo generar el informe.");
    }
  };

  return (
    <SectionCard title="Empleados" description="Crea empleados y asigna permisos por módulo.">
      <div className="card">
        <ToastModal
          open={toast.open}
          message={toast.message}
          variant={toast.variant}
          duration={10000}
          onClose={() => setToast({ open: false, message: "", variant: "success" })}
        />

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <div className="form-title">{editingId ? "Editar empleado" : "Nuevo empleado"}</div>
          <div className="pos-client-grid">
            <label>
              Nombre
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </label>
            <label>
              Apellido paterno
              <input
                value={form.apellido_paterno}
                onChange={(e) => setForm({ ...form, apellido_paterno: e.target.value })}
              />
            </label>
            <label>
              Apellido materno
              <input
                value={form.apellido_materno}
                onChange={(e) => setForm({ ...form, apellido_materno: e.target.value })}
              />
            </label>
            <label>
              Email
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label>
              CI
              <input value={form.ci} onChange={(e) => setForm({ ...form, ci: e.target.value })} />
            </label>
            {!editingId && (
              <label>
                Password (opcional, si esta vacio se usa el CI)
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </label>
            )}
          </div>

          <div>
            <div className="form-title">Permisos</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
              {PERMISOS.map((perm) => (
                <label key={perm.key} className="radio-option">
                  <input
                    type="checkbox"
                    checked={form.permisos.includes(perm.key)}
                    onChange={() => setForm({ ...form, permisos: togglePermiso(form.permisos, perm.key) })}
                  />
                  <span>{perm.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" className="primary-button">
              {editingId ? "Guardar" : "Crear empleado"}
            </button>
            {editingId && (
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>

        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div className="form-title">Empleados registrados</div>

            {/* Botón nuevo para generar informe PDF */}
            <button type="button" className="ghost-button" onClick={generarInformeEmpleadosPDF}>
              Generar informe (PDF)
            </button>
          </div>

          {empleados.length === 0 ? (
            <p className="muted">Sin empleados.</p>
          ) : (
            <div className="data-list">
              {empleados.map((empleado) => (
                <div key={empleado.id_empleado} className="data-row">
                  <div>
                    <strong>{`${empleado.nombre} ${empleado.apellido_paterno}`}</strong>
                    <div className="muted">{empleado.email}</div>
                    <div className="muted">CI: {empleado.ci}</div>
                    <div className="muted">Permisos: {(empleado.permisos || []).join(", ") || "-"}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="ghost-button" onClick={() => startEdit(empleado)}>
                      Editar
                    </button>
                    <button type="button" className="ghost-button" onClick={() => handleReset(empleado.id_empleado)}>
                      Reiniciar contrasena
                    </button>
                  </div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    La contrasena temporal se reinicia al CI del empleado.
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
};

export default MicroempresaEmpleados;
