import React, { useMemo, useState } from "react";
import SectionCard from "../SectionCard";

// PDF
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const buildFullName = (item) =>
  [item?.nombre, item?.apellido_paterno, item?.apellido_materno]
    .filter(Boolean)
    .join(" ");

const estadoStyle = (estado) => ({
  fontWeight: 600,
  color: (estado || "").toLowerCase() === "activo" ? "green" : "red",
});

const sourceLabel = (value) => {
  const key = String(value || "").toLowerCase();
  if (key === "microempresa") return "Microempresa";
  return "Independiente";
};

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

const SuperUsuarioClientes = ({
  items,
  microempresas,
  onDeactivate,
  onActivate,
  onUpdate,
}) => {
  // Búsqueda / filtro
  const [q, setQ] = useState("");
  const [tenantFilter, setTenantFilter] = useState("");
  const [showAll, setShowAll] = useState(false);

  // Edición inline
  const [editingId, setEditingId] = useState(null);
  const [fullText, setFullText] = useState(null);

  // Form edición
  const [form, setForm] = useState({
    nombre: "",
    apellido_paterno: "",
    apellido_materno: "",
    ci: "",
    email: "",
    tipo_cliente: "persona",
    razon_social: "",
  });

  const filtered = useMemo(() => {
    const query = normalize(q);

    return (items || [])
      .filter((c) => (showAll ? true : normalize(c.estado) === "activo"))
      .filter((c) => {
        if (!tenantFilter) return true;
        return String(c.tenant_id ?? "") === String(tenantFilter);
      })
      .filter((c) => {
        if (!query) return true;

        const haystack = [
          buildFullName(c),
          c.ci,
          c.email,
          c.razon_social,
          String(c.tenant_id ?? ""),
          c.microempresa_nombre,
        ]
          .filter(Boolean)
          .map(normalize)
          .join(" ");

        return haystack.includes(query);
      });
  }, [items, q, tenantFilter, showAll]);

  const tenantNameById = useMemo(() => {
    const map = new Map();
    (microempresas || []).forEach((m) => map.set(String(m.tenant_id), m.nombre));
    return map;
  }, [microempresas]);

  const startEdit = (item) => {
    const id = item.id ?? item.id_cliente;
    setEditingId(id);

    const tipo = tipoFromCliente(item);

    setForm({
      nombre: item.nombre || "",
      apellido_paterno: item.apellido_paterno || "",
      apellido_materno: item.apellido_materno || "",
      ci: item.ci || "",
      email: item.email || "",
      tipo_cliente: tipo,
      razon_social: item.razon_social || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({
      nombre: "",
      apellido_paterno: "",
      apellido_materno: "",
      ci: "",
      email: "",
      tipo_cliente: "persona",
      razon_social: "",
    });
  };

  const onChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "tipo_cliente" && value !== "empresa") {
        next.razon_social = "";
      }
      return next;
    });
  };

  const submitEdit = async (item) => {
    if (!onUpdate) return;

    const id = item.id ?? item.id_cliente;
    if (!id) return;

    const payload = {
      nombre: (form.nombre || "").trim(),
      apellido_paterno: (form.apellido_paterno || "").trim(),
      apellido_materno: (form.apellido_materno || "").trim(),
      ci: (form.ci || "").trim(),
      email: (form.email || "").trim(),
      es_empresa: form.tipo_cliente === "empresa",
      razon_social: form.tipo_cliente === "empresa" ? (form.razon_social || "").trim() : "",
    };

    if (!payload.nombre || !payload.apellido_paterno || !payload.apellido_materno) return;
    if (!payload.ci) return;
    if (!payload.email) return;
    if (payload.es_empresa && !payload.razon_social) return;

    await onUpdate(id, payload);
    cancelEdit();
  };

  const shouldTruncate = (value, limit = 28) => String(value || "").length > limit;

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

  // Genera un informe PDF con el listado actual (respeta filtros)
  const generarInformeClientesPDF = () => {
    try {
      const rowsSource = filtered || [];

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a3" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginX = 24;

      const generado = new Date().toLocaleString("es-ES");

      let y = 34;
      doc.setFontSize(16);
      doc.text("Informe de clientes (superusuario)", marginX, y);

      doc.setFontSize(9);
      doc.text(`Generado: ${generado}`, marginX, y + 16);

      const filtroTenant = tenantFilter
        ? `Microempresa: ${tenantNameById.get(String(tenantFilter)) || `#${tenantFilter}`}`
        : "Microempresa: Todas";
      const filtroEstado = showAll ? "Estado: Todos" : "Estado: Solo activos";
      doc.setFontSize(9);
      doc.text(`${filtroTenant}  |  ${filtroEstado}  |  Clientes: ${rowsSource.length}`, marginX, y + 32);

      y += 48;

      const body = rowsSource.map((item) => {
        const id = item.id ?? item.id_cliente;
        const tenantId = item.tenant_id;

        const tenantName =
          item.microempresa_nombre ||
          (tenantId != null ? tenantNameById.get(String(tenantId)) : "") ||
          "-";

        const tipoLabel = item.razon_social ? "Empresa" : "Persona";

        return [
          String(id ?? "-"),
          buildFullName(item) || "-",
          item.ci || "-",
          tipoLabel,
          item.razon_social || "-",
          item.email || "-",
          `${tenantName}${tenantId != null ? ` (#${tenantId})` : ""}`.trim(),
          item.estado || "-",
          sourceLabel(item.creation_source) || "-",
        ];
      });

      autoTable(doc, {
        startY: y,
        tableWidth: "auto",
        margin: { left: marginX, right: marginX },
        styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
        headStyles: { fontSize: 8 },
        head: [[
          "ID",
          "Nombre",
          "CI",
          "Tipo",
          "Razón social",
          "Email",
          "Microempresa",
          "Estado",
          "Creación",
        ]],
        body,
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 150 },
          2: { cellWidth: 85 },
          3: { cellWidth: 70 },
          4: { cellWidth: 160 },
          5: { cellWidth: 170 },
          6: { cellWidth: 190 },
          7: { cellWidth: 80 },
          8: { cellWidth: 95 },
        },
        didDrawPage: () => {
          const pageCount = doc.internal.getNumberOfPages();
          const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
          doc.setFontSize(9);
          doc.text(`Página ${currentPage} / ${pageCount}`, pageW - marginX, pageH - 16, { align: "right" });
        },
      });

      const stamp = new Date().toISOString().slice(0, 10);
      doc.save(`informe_clientes_superusuario_${stamp}.pdf`);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <SectionCard title="Clientes">
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            placeholder="Buscar por nombre, email, razón social, CI"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minWidth: 260 }}
          />

          <select value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)}>
            <option value="">Todas las microempresas</option>
            {(microempresas || []).map((m) => (
              <option key={m.tenant_id} value={m.tenant_id}>
                {m.nombre}
              </option>
            ))}
          </select>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            Mostrar todos
          </label>

          {/* Botón nuevo */}
          <button type="button" className="ghost-button" onClick={generarInformeClientesPDF}>
            Generar informe (PDF)
          </button>
        </div>

        <div className="muted">{filtered.length} cliente(s)</div>
      </div>

      {filtered.length === 0 ? (
        <p className="muted">
          {showAll ? "Sin clientes registrados." : "Sin clientes activos."}
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1240, tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={headCell}>Nombre</th>
                <th style={headCell}>CI</th>
                <th style={headCell}>Tipo</th>
                <th style={headCell}>Razón social</th>
                <th style={headCell}>Email</th>
                <th style={headCell}>Microempresa</th>
                <th style={headCell}>Estado</th>
                <th style={headCell}>Creación</th>
                <th style={headCell}>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((item) => {
                const id = item.id ?? item.id_cliente;
                const tenantId = item.tenant_id;

                const tenantName =
                  item.microempresa_nombre ||
                  (tenantId != null ? tenantNameById.get(String(tenantId)) : "") ||
                  "-";

                const isEditing = editingId != null && String(editingId) === String(id);
                const tipoLabel = item.razon_social ? "Empresa" : "Persona";

                return (
                  <tr key={id}>
                    {!isEditing ? (
                      <>
                        <td style={cell}>{renderTruncated(buildFullName(item), "Nombre")}</td>
                        <td style={cell}>{renderTruncated(item.ci || "-", "CI")}</td>
                        <td style={cell}>{tipoLabel}</td>
                        <td style={cell}>{renderTruncated(item.razon_social || "-", "Razon social")}</td>
                        <td style={cell}>{renderTruncated(item.email, "Email")}</td>
                        <td style={cell}>
                          {renderTruncated(
                            `${tenantName} ${tenantId != null ? `(#${tenantId})` : ""}`.trim(),
                            "Microempresa"
                          )}
                        </td>
                        <td style={cell}>
                          <span style={estadoStyle(item.estado)}>{item.estado}</span>
                        </td>
                        <td style={cell}>
                          {renderTruncated(sourceLabel(item.creation_source) || "-", "Creación")}
                        </td>
                        <td style={cell}>
                          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", rowGap: 6 }}>
                            <button type="button" onClick={() => startEdit(item)}>
                              Editar
                            </button>

                            {item.estado === "activo" ? (
                              <button
                                type="button"
                                className="danger-button"
                                onClick={() => onDeactivate(id)}
                              >
                                Inactivar
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="ghost-button"
                                onClick={() => onActivate(id)}
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
                              value={form.nombre}
                              onChange={onChange}
                            />
                            <input
                              name="apellido_paterno"
                              placeholder="Apellido paterno"
                              value={form.apellido_paterno}
                              onChange={onChange}
                            />
                            <input
                              name="apellido_materno"
                              placeholder="Apellido materno"
                              value={form.apellido_materno}
                              onChange={onChange}
                            />
                          </div>
                        </td>

                        <td style={cell}>
                          <input
                            name="ci"
                            placeholder="CI"
                            value={form.ci}
                            onChange={onChange}
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
                                checked={form.tipo_cliente === "persona"}
                                onChange={onChange}
                              />
                              Persona
                            </label>

                            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <input
                                type="radio"
                                name="tipo_cliente"
                                value="empresa"
                                checked={form.tipo_cliente === "empresa"}
                                onChange={onChange}
                              />
                              Empresa
                            </label>
                          </div>
                        </td>

                        <td style={cell}>
                          {form.tipo_cliente === "empresa" ? (
                            <input
                              name="razon_social"
                              placeholder="Razón social"
                              value={form.razon_social}
                              onChange={onChange}
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
                            value={form.email}
                            onChange={onChange}
                            style={{ width: "100%" }}
                          />
                        </td>

                        <td style={cell}>
                          {tenantName} {tenantId != null ? `(#${tenantId})` : ""}
                        </td>

                        <td style={cell}>
                          <span style={estadoStyle(item.estado)}>{item.estado}</span>
                        </td>
                        <td style={cell}>
                          {renderTruncated(sourceLabel(item.creation_source) || "-", "Creación")}
                        </td>
                        <td style={cell}>
                          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", rowGap: 6 }}>
                            <button type="button" onClick={() => submitEdit(item)}>
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

export default SuperUsuarioClientes;
