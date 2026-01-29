
import React, { useEffect, useMemo, useState } from "react";
import SectionCard from "../SectionCard";
import ToastModal from "../ToastModal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { openPdf } from "../../utils/pdf";

const API_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:5000").replace(/\/$/, "");


async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { method: "GET", credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error");
  return data;
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error");
  return data;
}

async function apiPut(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error");
  return data;
}

async function apiPatch(path) {
  const res = await fetch(`${API_BASE}${path}`, { method: "PATCH", credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error");
  return data;
}

const fullName = (c) =>
  [c?.nombre, c?.apellido_paterno, c?.apellido_materno].filter(Boolean).join(" ");

const estadoStyle = (estado) => ({
  fontWeight: 600,
  color: (estado || "").toLowerCase() === "activo" ? "green" : "red",
});

const cell = {
  padding: "10px 12px",
  textAlign: "center",
  verticalAlign: "middle",
  borderBottom: "1px solid rgba(0,0,0,0.08)",
};

const headCell = {
  ...cell,
  fontWeight: 700,
  borderBottom: "1px solid rgba(0,0,0,0.14)",
};

const normalize = (v) => (v || "").toString().toLowerCase().trim();

function tipoFromCliente(c) {
  return c?.razon_social ? "empresa" : "persona";
}

const sourceLabel = (value) => {
  const key = String(value || "").toLowerCase();
  if (key === "microempresa") return "Microempresa";
  if (key === "invitado") return "Invitado";
  return "Independiente";
};

function payloadFromForm(form, includePassword) {
  const tipo = form.tipo_cliente; // persona | empresa

  const es_empresa = tipo === "empresa";
  const razon_social = es_empresa ? (form.razon_social || "").trim() : "";

  const payload = {
    nombre: (form.nombre || "").trim(),
    apellido_paterno: (form.apellido_paterno || "").trim(),
    apellido_materno: (form.apellido_materno || "").trim(),
    ci: (form.ci || "").trim(),
    email: (form.email || "").trim(),
    es_empresa,
    razon_social,
  };

  if (includePassword) payload.password = form.password || "";

  return payload;
}

function validatePayload(payload, includePassword) {
  if (!payload.nombre || !payload.apellido_paterno) {
    return "Completa nombre y apellido paterno";
  }
  if (!payload.ci) return "CI requerido";
  if (!payload.email) return "Email requerido";
  if (payload.es_empresa && !payload.razon_social) return "Razón social requerida si es empresa";
  if (includePassword && !payload.password) return "Password requerido";
  return "";
}

export default function MicroempresaClientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState({ open: false, message: "", variant: "success" });

  const [showAll, setShowAll] = useState(false);
  const [q, setQ] = useState("");

  const [showRegister, setShowRegister] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [reportCliente, setReportCliente] = useState(null);
  const [fullText, setFullText] = useState(null);

  const [registerForm, setRegisterForm] = useState({
    nombre: "",
    apellido_paterno: "",
    apellido_materno: "",
    ci: "",
    email: "",
    password: "",
    tipo_cliente: "persona", // persona | empresa
    razon_social: "",
  });

  const [editForm, setEditForm] = useState({
    nombre: "",
    apellido_paterno: "",
    apellido_materno: "",
    ci: "",
    email: "",
    tipo_cliente: "persona",
    razon_social: "",
  });

  const loadClientes = async () => {
    setLoading(true);
    setMessage("");
    try {
      const data = await apiGet("/api/clientes");
      const raw = data.clientes || [];
      const normalized = raw.map((c) => ({
        ...c,
        id_cliente: c.id_cliente ?? c.id,
      }));
      setClientes(normalized);
    } catch (e) {
      setMessage(e.message);
      setClientes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClientes();
  }, []);

  useEffect(() => {
    if (!message) return;
    const lower = String(message || "").toLowerCase();
    const variant = lower.includes("no") || lower.includes("error") ? "warning" : "success";
    setToast({ open: true, message, variant });
  }, [message]);

  const shouldTruncate = (value, limit = 28) => String(value || "").length > limit;

  const openFullText = (title, value) => {
    if (!value) return;
    setFullText({ title, value });
  };

  const closeFullText = () => setFullText(null);

  const buildReportHtml = (cliente) => {
    const safe = (value) => String(value || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Reporte de acceso</title>
  <style>
    @page { size: 80mm auto; margin: 6mm; }
    html, body { padding: 0; margin: 0; }
    body { font-family: Arial, sans-serif; width: 80mm; }
    .card { padding: 8mm 6mm; }
    .title { font-size: 16px; font-weight: 700; margin-bottom: 6mm; text-align: center; }
    .row { margin-bottom: 3mm; font-size: 12px; }
    .label { font-weight: 700; }
    .divider { border-top: 1px dashed #999; margin: 6mm 0; }
    ol { margin: 0 0 0 16px; padding: 0; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="title">Reporte de acceso</div>
    <div class="row"><span class="label">Email:</span> ${safe(cliente?.email)}</div>
    <div class="row"><span class="label">Contrasena:</span> ${safe(cliente?.temp_password)}</div>
    <div class="divider"></div>
    <div class="row"><span class="label">Instrucciones:</span></div>
    <ol>
      <li>Ingresa al sistema con tu email y la contrasena indicada.</li>
      <li>Ve a Perfil y selecciona Editar.</li>
      <li>En el campo Password escribe tu nueva contrasena.</li>
      <li>Guarda los cambios para actualizar tu acceso.</li>
    </ol>
  </div>
</body>
</html>`;
  };

  const downloadReport = (cliente) => {
    const html = buildReportHtml(cliente);
    const isMobile = typeof window !== "undefined" && (/android|iphone|ipad|ipod/i.test(navigator.userAgent) || window.Capacitor);
    if (isMobile) {
      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
      window.location.href = dataUrl;
      return;
    }
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reporte_cliente_${cliente?.id_cliente || "cliente"}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const printReport = (cliente) => {
    const html = buildReportHtml(cliente);
    const win = window.open("", "_blank", "width=420,height=640");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 250);
  };
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

  const filteredClientes = useMemo(() => {
    const query = normalize(q);

    return (clientes || [])
      .filter((c) => (showAll ? true : normalize(c.estado) === "activo"))
      .filter((c) => {
        if (!query) return true;
        const haystack = [
          c.nombre,
          c.apellido_paterno,
          c.apellido_materno,
          c.ci,
          c.email,
          c.razon_social,
        ]
          .filter(Boolean)
          .map(normalize)
          .join(" ");
        return haystack.includes(query);
      });
  }, [clientes, showAll, q]);

  const onToggleShowAll = (e) => setShowAll(e.target.checked);

  const resetRegisterForm = () => {
    setRegisterForm({
      nombre: "",
      apellido_paterno: "",
      apellido_materno: "",
      ci: "",
      email: "",
      password: "",
      tipo_cliente: "persona",
      razon_social: "",
    });
  };

  const onToggleRegister = () => {
    setMessage("");
    setEditingId(null);
    setShowRegister((prev) => {
      const next = !prev;
      if (next) resetRegisterForm();
      return next;
    });
  };

  const onRegisterChange = (e) => {
    const { name, value } = e.target;

    setRegisterForm((prev) => {
      const next = { ...prev, [name]: value };

      // Si cambia a persona, borrar razón social
      if (name === "tipo_cliente" && value !== "empresa") {
        next.razon_social = "";
      }

      return next;
    });
  };

  const onRegisterSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    const payload = payloadFromForm(registerForm, true);
    const err = validatePayload(payload, true);
    if (err) return setMessage(err);

    try {
      await apiPost("/api/clientes", payload);
      setToast({ open: true, message: "Cliente creado exitosamente.", variant: "success" });
      resetRegisterForm();
      setShowRegister(false);
      await loadClientes();
    } catch (e2) {
      setMessage(e2.message);
    }
  };

  const startEdit = (cliente) => {
    setMessage("");
    setShowRegister(false);
    setEditingId(cliente.id_cliente);

    const tipo = tipoFromCliente(cliente);

    setEditForm({
      nombre: cliente.nombre || "",
      apellido_paterno: cliente.apellido_paterno || "",
      apellido_materno: cliente.apellido_materno || "",
      ci: cliente.ci || "",
      email: cliente.email || "",
      tipo_cliente: tipo,
      razon_social: cliente.razon_social || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setMessage("");
    setEditForm({
      nombre: "",
      apellido_paterno: "",
      apellido_materno: "",
      ci: "",
      email: "",
      tipo_cliente: "persona",
      razon_social: "",
    });
  };

  const onEditChange = (e) => {
    const { name, value } = e.target;

    setEditForm((prev) => {
      const next = { ...prev, [name]: value };

      // Si cambia a persona, borrar razón social
      if (name === "tipo_cliente" && value !== "empresa") {
        next.razon_social = "";
      }

      return next;
    });
  };

  const submitEdit = async (cliente) => {
    setMessage("");

    const id = cliente?.id_cliente ?? cliente?.id;
    if (!id) return setMessage("No se encontró el id del cliente");

    const payload = payloadFromForm(editForm, false);
    const err = validatePayload(payload, false);
    if (err) return setMessage(err);

    try {
      await apiPut(`/api/clientes/${id}`, payload);
      setToast({ open: true, message: "Cliente actualizado.", variant: "success" });
      cancelEdit();
      await loadClientes();
    } catch (e) {
      setMessage(e.message);
    }
  };

  const toggleEstado = async (cliente) => {
    setMessage("");

    const id = cliente?.id_cliente ?? cliente?.id;
    if (!id) return setMessage("No se encontró el id del cliente");

    try {
      const estado = (cliente.estado || "").toLowerCase();
      if (estado === "activo") {
        await apiPatch(`/api/clientes/${id}/deactivate`);
        setToast({ open: true, message: "Cliente inactivado.", variant: "success" });
      } else {
        await apiPatch(`/api/clientes/${id}/activate`);
        setToast({ open: true, message: "Cliente activado.", variant: "success" });
      }
      await loadClientes();
    } catch (e) {
      setMessage(e.message);
    }
  };
    const generarInformeClientesPDF = async () => {
    try {
      // Se usa el listado visible actual (respeta búsqueda y "mostrar todos")
      const rowsSource = filteredClientes || [];

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginX = 24;

      // Encabezado simple (mismo estilo general de tus reportes anteriores)
      const generado = new Date().toLocaleString("es-ES");

      let y = 34;
      doc.setFontSize(16);
      doc.text("Informe de clientes", marginX, y);

      doc.setFontSize(9);
      doc.text(`Generado: ${generado}`, marginX, y + 16);

      doc.setFontSize(9);
      doc.text(`Clientes listados: ${rowsSource.length}`, marginX, y + 32);

      y += 48;

      // Tabla
      const body = rowsSource.map((c) => {
        const tipoLabel = c.razon_social ? "Empresa" : "Persona";
        return [
          fullName(c) || "-",
          c.ci || "-",
          tipoLabel,
          c.razon_social || "-",
          c.email || "-",
          c.estado || "-",
          sourceLabel(c.creation_source),
        ];
      });

      autoTable(doc, {
        startY: y,
        tableWidth: "auto",
        margin: { left: marginX, right: marginX },
        styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
        headStyles: { fontSize: 8 },
        head: [[
          "Nombre completo",
          "CI",
          "Tipo",
          "Razón social",
          "Email",
          "Estado",
          "Creación",
        ]],
        body,
        didDrawPage: () => {
          const pageCount = doc.internal.getNumberOfPages();
          const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
          doc.setFontSize(9);
          doc.text(`Página ${currentPage} / ${pageCount}`, pageW - marginX, pageH - 16, { align: "right" });
        },
      });

      const stamp = new Date().toISOString().slice(0, 10);
      openPdf(doc, `informe_clientes_${stamp}.pdf`);

      setToast({ open: true, message: "Informe PDF generado.", variant: "success" });
    } catch (e) {
      console.error(e);
      setMessage(e?.message || "No se pudo generar el informe.");
    }
  };


  return (
    <SectionCard title="Gestión de clientes">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={onToggleRegister}>
            {showRegister ? "Cerrar" : "Registrar cliente"}
          </button>

          <input
            placeholder="Buscar por nombre, email, razón social, CI"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minWidth: 260 }}
          />
        </div>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={showAll} onChange={onToggleShowAll} />
          Mostrar todos
        </label>
      <button type="button" className="ghost-button" onClick={generarInformeClientesPDF}>
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

      {showRegister && (
        <form onSubmit={onRegisterSubmit} style={{ marginTop: 16 }}>
          <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
            <input
              name="nombre"
              placeholder="Nombre"
              value={registerForm.nombre}
              onChange={onRegisterChange}
              required
            />
            <input
              name="apellido_paterno"
              placeholder="Apellido paterno"
              value={registerForm.apellido_paterno}
              onChange={onRegisterChange}
              required
            />
            <input
              name="apellido_materno"
              placeholder="Apellido materno"
              value={registerForm.apellido_materno}
              onChange={onRegisterChange}
            />
            <input
              name="ci"
              placeholder="CI"
              value={registerForm.ci}
              onChange={onRegisterChange}
              required
            />

            <div style={{ display: "grid", gap: 6 }}>
              <div className="muted">Tipo de cliente</div>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="radio"
                  name="tipo_cliente"
                  value="persona"
                  checked={registerForm.tipo_cliente === "persona"}
                  onChange={onRegisterChange}
                />
                Persona
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="radio"
                  name="tipo_cliente"
                  value="empresa"
                  checked={registerForm.tipo_cliente === "empresa"}
                  onChange={onRegisterChange}
                />
                Empresa
              </label>
            </div>

            {registerForm.tipo_cliente === "empresa" && (
              <input
                name="razon_social"
                placeholder="Razón social"
                value={registerForm.razon_social}
                onChange={onRegisterChange}
              />
            )}

            <input
              name="email"
              placeholder="Email"
              value={registerForm.email}
              onChange={onRegisterChange}
              required
            />

            <input
              name="password"
              placeholder="Password"
              type="password"
              value={registerForm.password}
              onChange={onRegisterChange}
              required
            />

            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit">Guardar</button>
              <button
                type="button"
                onClick={() => {
                  resetRegisterForm();
                  setShowRegister(false);
                  setMessage("");
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      <div style={{ marginTop: 16 }}>
        {loading ? (
          <p className="muted">Cargando...</p>
        ) : filteredClientes.length === 0 ? (
          <p className="muted">
            {showAll ? "No hay clientes registrados." : "No hay clientes activos."}
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1220, tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th style={headCell}>Nombre completo</th>
                  <th style={headCell}>CI</th>
                  <th style={headCell}>Tipo</th>
                  <th style={headCell}>Razón social</th>
                  <th style={headCell}>Email</th>
                <th style={headCell}>Estado</th>
                <th style={headCell}>Creación</th>
                <th style={headCell}>Acciones</th>
              </tr>
            </thead>

              <tbody>
                {filteredClientes.map((c) => {
                  const id = c.id_cliente;
                  const isEditing = editingId != null && String(editingId) === String(id);

                  const tipoLabel = c.razon_social ? "Empresa" : "Persona";

                  return (
                    <tr key={id}>
                      {!isEditing ? (
                        <>
                          <td style={cell}>{renderTruncated(fullName(c) || "-", "Nombre")}</td>
                          <td style={cell}>{renderTruncated(c.ci || "-", "CI")}</td>
                          <td style={cell}>{tipoLabel}</td>
                          <td style={cell}>{renderTruncated(c.razon_social || "-", "Razón social")}</td>
                          <td style={cell}>{renderTruncated(c.email, "Email")}</td>
                          <td style={cell}>
                            <span style={estadoStyle(c.estado)}>{c.estado}</span>
                          </td>
                          <td style={cell}>{sourceLabel(c.creation_source)}</td>
                          <td style={cell}>
                            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", rowGap: 6 }}>
                              <button type="button" onClick={() => startEdit(c)}>
                                Editar
                              </button>

                              {String(c.creation_source || "") === "microempresa" && Boolean(c.temp_password) && (
                                <button
                                  type="button"
                                  className="ghost-button"
                                  onClick={() => setReportCliente(c)}
                                >
                                  Reporte
                                </button>
                              )}

                              {c.estado === "activo" ? (
                                <button
                                  type="button"
                                  className="danger-button"
                                  onClick={() => toggleEstado(c)}
                                >
                                  Inactivar
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="ghost-button"
                                  onClick={() => toggleEstado(c)}
                                >
                                  Activar
                                </button>
                              )}
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={cell}>
                            <div style={{ display: "grid", gap: 8 }}>
                              <input
                                name="nombre"
                                placeholder="Nombre"
                                value={editForm.nombre}
                                onChange={onEditChange}
                              />
                              <input
                                name="apellido_paterno"
                                placeholder="Apellido paterno"
                                value={editForm.apellido_paterno}
                                onChange={onEditChange}
                              />
                              <input
                                name="apellido_materno"
                                placeholder="Apellido materno"
                                value={editForm.apellido_materno}
                                onChange={onEditChange}
                              />
                            </div>
                          </td>

                          <td style={cell}>
                            <input
                              name="ci"
                              placeholder="CI"
                              value={editForm.ci}
                              onChange={onEditChange}
                              style={{ width: "100%" }}
                            />
                          </td>

                          <td style={cell}>
                            <div style={{ display: "grid", gap: 6, justifyItems: "center" }}>
                              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <input
                                  type="radio"
                                  name="tipo_cliente"
                                  value="persona"
                                  checked={editForm.tipo_cliente === "persona"}
                                  onChange={onEditChange}
                                />
                                Persona
                              </label>

                              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <input
                                  type="radio"
                                  name="tipo_cliente"
                                  value="empresa"
                                  checked={editForm.tipo_cliente === "empresa"}
                                  onChange={onEditChange}
                                />
                                Empresa
                              </label>
                            </div>
                          </td>

                          <td style={cell}>
                            {editForm.tipo_cliente === "empresa" ? (
                              <input
                                name="razon_social"
                                placeholder="Razón social"
                                value={editForm.razon_social}
                                onChange={onEditChange}
                                style={{ width: "100%" }}
                              />
                            ) : (
                              <span className="muted">-</span>
                            )}
                          </td>

                          <td style={cell}>
                            <input
                              name="email"
                              placeholder="Email"
                              value={editForm.email}
                              onChange={onEditChange}
                              style={{ width: "100%" }}
                            />
                          </td>

                          <td style={cell}>
                            <span style={estadoStyle(c.estado)}>{c.estado}</span>
                          </td>
                          <td style={cell}>{sourceLabel(c.creation_source)}</td>
                          <td style={cell}>
                            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", rowGap: 6 }}>
                              <button type="button" onClick={() => submitEdit(c)}>
                                Guardar
                              </button>
                              <button type="button" className="ghost-button" onClick={cancelEdit}>
                                Cancelar
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {reportCliente && (
        <div className="text-modal" onClick={() => setReportCliente(null)}>
          <div className="text-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="form-title">Reporte de acceso</div>
            <div className="text-modal-body">
              <div><strong>Email:</strong> {reportCliente.email || "-"}</div>
              <div><strong>Contraseña:</strong> {reportCliente.temp_password || "-"}</div>
              <div style={{ marginTop: 12 }}>
                <strong>Instrucciones para el cliente:</strong>
                <ol style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                  <li>Ingresa al sistema con tu email y la contraseña indicada.</li>
                  <li>Ve a la sección <strong>Perfil</strong> y selecciona <strong>Editar</strong>.</li>
                  <li>En el campo <strong>Password</strong> escribe tu nueva contraseña.</li>
                  <li>Guarda los cambios para actualizar tu acceso.</li>
                </ol>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <button type="button" className="ghost-button" onClick={() => printReport(reportCliente)}>
                Imprimir
              </button>
              <button type="button" className="ghost-button" onClick={() => downloadReport(reportCliente)}>
                Descargar
              </button>
              <button type="button" className="ghost-button" onClick={() => setReportCliente(null)}>
                Volver
              </button>
            </div>
          </div>
        </div>
      )}
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
}
