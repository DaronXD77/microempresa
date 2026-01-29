import React, { useEffect, useMemo, useState } from "react";
import SectionCard from "../SectionCard";
import { activateProducto, deactivateProducto, fetchProductos } from "../../controllers/productoController";
import { fetchProveedores } from "../../controllers/proveedorController";
import { fetchMe } from "../../controllers/authController";
import ToastModal from "../ToastModal";
import { useNavigate } from "react-router-dom";

// PDF
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { resolveAssetUrl } from "../../utils/url";
import { openPdf } from "../../utils/pdf";

const API_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:5000").replace(/\/$/, "");

const MicroempresaInventario = () => {
  const [productos, setProductos] = useState([]);
  const [search, setSearch] = useState("");
  const [fullText, setFullText] = useState(null);
  const [proveedores, setProveedores] = useState([]);
  const [proveedorFilter, setProveedorFilter] = useState("");
  const [proveedorSearch, setProveedorSearch] = useState("");
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState({ open: false, message: "", variant: "success" });
  const [confirm, setConfirm] = useState({ open: false, message: "", actionLabel: "", onAction: null });

  // ✅ para logo/nombre en PDF
  const [micro, setMicro] = useState(null);

  const navigate = useNavigate();

  const load = async () => {
    const [productosRes, proveedoresRes, meRes] = await Promise.all([
      fetchProductos(),
      fetchProveedores(),
      fetchMe(),
    ]);
    if (productosRes.response.ok) setProductos(productosRes.data.productos || []);
    if (proveedoresRes.response.ok) setProveedores(proveedoresRes.data.proveedores || []);
    if (meRes.response.ok) setMicro(meRes.data.user || null);
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

  const openConfirm = (messageText, actionLabel, onAction) => {
    setConfirm({ open: true, message: messageText, actionLabel, onAction });
  };
  const closeConfirm = () => setConfirm({ open: false, message: "", actionLabel: "", onAction: null });

  const deactivate = async (id) => {
    const { response, data } = await deactivateProducto(id);
    if (!response.ok) {
      setMessage(data.error || "No se pudo inactivar.");
      return;
    }
    setMessage("Producto inactivado.");
    await load();
  };

  const activate = async (id) => {
    const { response, data } = await activateProducto(id);
    if (!response.ok) {
      setMessage(data.error || "No se pudo activar.");
      return;
    }
    setMessage("Producto activado.");
    await load();
  };

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return productos.filter((p) => {
      if (proveedorFilter && String(p.proveedor_id) !== String(proveedorFilter)) return false;
      if (!term) return true;
      return String(p.nombre || "").toLowerCase().includes(term);
    });
  }, [productos, search, proveedorFilter]);

  const filteredProveedores = proveedores.filter((p) => {
    if ((p.estado || "").toLowerCase() !== "activo") return false;
    const term = proveedorSearch.trim().toLowerCase();
    if (!term) return true;
    return String(p.nombre || "").toLowerCase().includes(term);
  });

  const proveedorMap = useMemo(() => {
    const map = new Map();
    proveedores.forEach((p) => map.set(String(p.id_proveedor), p));
    return map;
  }, [proveedores]);

  const shouldTruncate = (value, limit = 28) => String(value || "").length > limit;

  const openFullText = (title, value) => {
    if (!value) return;
    setFullText({ title, value });
  };

  const closeFullText = () => setFullText(null);

  const renderTruncated = (value, title, extraClass = "") => {
    const text = String(value || "");
    if (!text) return <span className={extraClass}>-</span>;
    const showButton = shouldTruncate(text);
    return (
      <div className={`truncate-row ${extraClass}`.trim()}>
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

  const resolveUrl = (value) => {
    if (!value) return null;
    return resolveAssetUrl(value) || null;
  };

  const getMicroLogoUrl = () => {
    const raw =
      micro?.logo_url ||
      micro?.logo ||
      micro?.imagen_url ||
      micro?.image_url ||
      micro?.foto_url ||
      "";
    return resolveUrl(raw);
  };

  const fetchImageAsDataUrl = async (url) => {
    const res = await fetch(url, { mode: "cors", credentials: "include" });
    if (!res.ok) throw new Error("No se pudo cargar el logo.");
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // ✅ NUEVO: PDF informe inventario
  const generarInformeInventarioPDF = async () => {
    try {
      const rowsSource = visible; // respeta filtros (proveedor + búsqueda)
      const empresaNombre = micro?.razon_social || micro?.nombre || micro?.name || "Microempresa";
      const generado = new Date().toLocaleString();

      // Resumen
      const totalProductos = rowsSource.length;

      const resumen = rowsSource.reduce(
        (acc, p) => {
          const stockInicial = Number(p.stock_inicial ?? p.stock ?? 0);
          const stockActual = Number(p.stock ?? 0);
          const stockMin = Number(p.stock_minimo ?? 0);
          const low = stockActual <= stockMin;

          const precioVenta = Number(p.precio_unitario ?? 0);
          const precioCompra = Number(p.precio_compra ?? 0);

          acc.stockTotal += stockActual;
          acc.lowCount += low ? 1 : 0;
          acc.valorCompra += stockActual * precioCompra;
          acc.valorVenta += stockActual * precioVenta;

          // vendidas = inicial - actual (no < 0)
          const vendidas = Math.max(0, stockInicial - stockActual);
          acc.vendidasTotal += vendidas;

          return acc;
        },
        { stockTotal: 0, lowCount: 0, valorCompra: 0, valorVenta: 0, vendidasTotal: 0 }
      );

      // PDF
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginX = 36;

      // Header con logo
      let y = 28;
      const logoUrl = getMicroLogoUrl();
      let logoDrawn = false;

      if (logoUrl) {
        try {
          const dataUrl = await fetchImageAsDataUrl(logoUrl);
          const format = String(dataUrl).startsWith("data:image/png") ? "PNG" : "JPEG";
          doc.addImage(dataUrl, format, marginX, y, 56, 56);
          logoDrawn = true;
        } catch {
          logoDrawn = false;
        }
      }

      doc.setFontSize(16);
      doc.text(empresaNombre, logoDrawn ? marginX + 70 : marginX, y + 18);

      doc.setFontSize(12);
      doc.text("Informe de inventario", logoDrawn ? marginX + 70 : marginX, y + 38);

      doc.setFontSize(9);
      doc.text(`Generado: ${generado}`, logoDrawn ? marginX + 70 : marginX, y + 54);

      y += 74;

      // Resumen en líneas
      doc.setFontSize(11);
      doc.text(
        `Productos: ${totalProductos}   |   Stock total: ${resumen.stockTotal}   |   Bajo stock: ${resumen.lowCount}   |   Vendidas (estim): ${resumen.vendidasTotal}`,
        marginX,
        y
      );
      y += 14;

      doc.setFontSize(10);
      doc.text(
        `Valor compra (estim): Bs ${resumen.valorCompra.toFixed(2)}   |   Valor venta (estim): Bs ${resumen.valorVenta.toFixed(2)}`,
        marginX,
        y
      );
      y += 10;

      // Tabla
      const body = rowsSource.map((p) => {
        const proveedor = p.proveedor_id ? proveedorMap.get(String(p.proveedor_id)) : null;
        const stockInicial = p.stock_inicial ?? p.stock ?? 0;
        const stockActual = p.stock ?? 0;
        const vendidas = Math.max(0, Number(stockInicial || 0) - Number(stockActual || 0));

        return [
          String(p.nombre || "-"),
          String(proveedor?.nombre || "-"),
          `Bs ${Number(p.precio_unitario || 0).toFixed(2)}`,
          `Bs ${Number(p.precio_compra || 0).toFixed(2)}`,
          String(stockInicial),
          String(stockActual),
          String(vendidas),
          String(p.stock_minimo ?? 0),
          String(p.estado || "-"),
        ];
      });

      autoTable(doc, {
        startY: y + 10,
        tableWidth: "auto",
        styles: {
          fontSize: 8,
          cellPadding: 3,
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [41, 128, 185], // azul bonito
          textColor: 255,
          fontSize: 8,
        },
        bodyStyles: {
          fontSize: 8,
        },
        margin: { left: 24, right: 24 },
        head: [[
          "Producto",
          "Proveedor",
          "Precio venta",
          "Precio compra",
          "Stock inicial",
          "Stock actual",
          "Vendidas",
          "Stock mínimo",
          "Estado",
        ]],
        body,
        didDrawPage: () => {
          const pageCount = doc.internal.getNumberOfPages();
          const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
          doc.setFontSize(9);
          doc.text(
            `Página ${currentPage} / ${pageCount}`,
            doc.internal.pageSize.getWidth() - 24,
            doc.internal.pageSize.getHeight() - 16,
            { align: "right" }
          );
        },
      });

      const stamp = new Date().toISOString().slice(0, 10);
      openPdf(doc, `informe_inventario_${stamp}.pdf`);
      setMessage("Informe de inventario generado.");
    } catch (e) {
      setMessage(e?.message || "No se pudo generar el informe de inventario.");
    }
  };

  return (
    <SectionCard title="Inventario" description="Listado general de productos y stock disponible.">
      <div className="card">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ maxWidth: 320 }}>
            <span className="form-title">Buscar producto</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar" />
          </label>

          <label style={{ minWidth: 220 }}>
            <span className="form-title">Buscar proveedor</span>
            <input value={proveedorSearch} onChange={(e) => setProveedorSearch(e.target.value)} placeholder="Proveedor" />
          </label>

          <label style={{ minWidth: 220 }}>
            <span className="form-title">Filtrar proveedor</span>
            <select value={proveedorFilter} onChange={(e) => setProveedorFilter(e.target.value)}>
              <option value="">Todos</option>
              {filteredProveedores.map((p) => (
                <option key={p.id_proveedor} value={p.id_proveedor}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>

          {/* ✅ BOTÓN PDF */}
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="button" onClick={generarInformeInventarioPDF}>
              Generar informe (PDF)
            </button>
          </div>
        </div>

        <div className="inventario-table">
          <div className="inventario-row head">
            <div>Foto</div>
            <div>Producto</div>
            <div>Proveedor</div>
            <div>Precio venta</div>
            <div>Precio compra</div>
            <div>Stock inicial</div>
            <div>Stock actual</div>
            <div>Vendidas</div>
            <div>Stock minimo</div>
            <div>Estado</div>
            <div>Acciones</div>
          </div>

          {visible.length === 0 ? (
            <p className="muted">No hay productos.</p>
          ) : (
            visible.map((producto) => {
              const low = producto.stock <= producto.stock_minimo;
              const stockInicial = producto.stock_inicial ?? producto.stock;
              const stockActual = producto.stock ?? 0;
              const vendidas = Math.max(0, stockInicial - stockActual);
              const fotoUrl = resolveAssetUrl(producto.fotos?.[0]?.url || "");
              const proveedor = producto.proveedor_id ? proveedorMap.get(String(producto.proveedor_id)) : null;

              return (
                <div key={producto.id_producto} className={`inventario-row ${low ? "low" : ""}`}>
                  <div>
                    {fotoUrl ? (
                      <img
                        src={fotoUrl}
                        alt={producto.nombre}
                        style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8 }}
                      />
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </div>

                  <div className="producto-table-name">
                    {renderTruncated(producto.nombre || "-", "Nombre", "strong-text")}
                  </div>

                  <div>{proveedor ? proveedor.nombre : "-"}</div>
                  <div>Bs {producto.precio_unitario}</div>
                  <div>Bs {Number(producto.precio_compra || 0).toFixed(2)}</div>
                  <div>{stockInicial}</div>
                  <div>{stockActual}</div>
                  <div>{vendidas}</div>
                  <div>{producto.stock_minimo}</div>
                  <div>
                    <span className={`status-pill ${producto.estado === "activo" ? "active" : ""}`}>
                      {producto.estado}
                    </span>
                  </div>

                  <div className="producto-table-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() =>
                        openConfirm("¿Quieres editar este producto en la pestaña Productos?", "Ir a editar", () =>
                          navigate("/productos")
                        )
                      }
                    >
                      Editar
                    </button>

                    {producto.estado === "activo" ? (
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() =>
                          openConfirm("¿Inactivar este producto?", "Inactivar", () => deactivate(producto.id_producto))
                        }
                      >
                        Inactivar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => openConfirm("¿Activar este producto?", "Activar", () => activate(producto.id_producto))}
                      >
                        Activar
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
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

      <ToastModal
        open={toast.open}
        message={toast.message}
        variant={toast.variant}
        duration={10000}
        onClose={() => setToast({ open: false, message: "", variant: "success" })}
      />
      <ToastModal
        open={confirm.open}
        message={confirm.message}
        variant="warning"
        actionLabel={confirm.actionLabel || "Confirmar"}
        duration={10000}
        onClose={closeConfirm}
        onAction={() => {
          if (confirm.onAction) confirm.onAction();
        }}
      />
    </SectionCard>
  );
};

export default MicroempresaInventario;