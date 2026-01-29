import React, { useEffect, useMemo, useState } from "react";
import SectionCard from "../SectionCard";
import { fetchEconomia } from "../../controllers/economiaController";
import { fetchMe } from "../../controllers/authController";

// PDF
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { resolveAssetUrl } from "../../utils/url";
import { openPdf } from "../../utils/pdf";

const API_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:5000").replace(/\/$/, "");

// Formatea saldo con signo y 2 decimales
const formatSaldo = (value) => {
  const numeric = Number(value || 0);
  const sign = numeric < 0 ? "-" : "";
  const abs = Math.abs(numeric).toFixed(2);
  return `${sign}Bs ${abs}`;
};

// Resuelve rutas relativas a URL absoluta usando API_BASE
const resolveUrl = (value) => {
  if (!value) return null;
  return resolveAssetUrl(value) || null;
};

const MicroempresaEconomia = () => {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");

  // Datos de la microempresa para encabezado (logo/nombre) en el PDF
  const [micro, setMicro] = useState(null);

  const load = async () => {
    // Se carga economía y microempresa en paralelo
    const [ecoRes, meRes] = await Promise.all([fetchEconomia(), fetchMe()]);

    if (!ecoRes.response.ok) {
      setItems([]);
    } else {
      setItems(ecoRes.data.items || []);
    }

    if (meRes.response.ok) {
      setMicro(meRes.data.user || null);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Filtra por nombre de producto (respeta el input de búsqueda)
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => String(item.nombre || "").toLowerCase().includes(term));
  }, [items, search]);

  // Obtiene una URL de logo si existe en el objeto micro
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

  // Convierte una imagen remota a DataURL para poder insertarla en jsPDF
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

  // Calcula un estado textual a partir del saldo
  const getEstadoFromSaldo = (saldo) => {
    const s = Number(saldo || 0);
    if (s < 0) return "Recuperando";
    if (s > 0) return "Ganancia";
    return "Recuperado";
  };

  // Genera informe económico en PDF (usa la lista visible y respeta búsqueda)
  const generarInformeEconomicoPDF = async () => {
    try {
      const rowsSource = visible;

      // Resumen general (acumulados)
      const resumen = rowsSource.reduce(
        (acc, it) => {
          const saldo = Number(it.saldo || 0);
          const stock = Number(it.stock ?? 0);
          const compra = Number(it.precio_compra || 0);
          const venta = Number(it.precio_unitario || 0);

          acc.productos += 1;
          acc.stockTotal += stock;

          // Suma saldos por categorías
          if (saldo < 0) acc.recuperando += 1;
          else if (saldo > 0) acc.ganancia += 1;
          else acc.recuperado += 1;

          // Totales económicos estimados (stock actual)
          acc.valorCompra += stock * compra;
          acc.valorVenta += stock * venta;

          // Saldo neto (sumatoria del saldo por producto)
          acc.saldoNeto += saldo;

          return acc;
        },
        {
          productos: 0,
          stockTotal: 0,
          recuperando: 0,
          ganancia: 0,
          recuperado: 0,
          valorCompra: 0,
          valorVenta: 0,
          saldoNeto: 0,
        }
      );

      // Configuración PDF
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginX = 24;

      // Encabezado
      const empresaNombre = micro?.razon_social || micro?.nombre || micro?.name || "Microempresa";
      const generado = new Date().toLocaleString("es-ES");

      let y = 28;
      const logoUrl = getMicroLogoUrl();
      let logoDrawn = false;

      // Se intenta insertar logo; si falla (CORS u otra razón), se continúa sin bloquear el reporte
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
      doc.text("Informe económico", logoDrawn ? marginX + 70 : marginX, y + 38);

      doc.setFontSize(9);
      doc.text(`Generado: ${generado}`, logoDrawn ? marginX + 70 : marginX, y + 54);

      y += 74;

      // Resumen en una o dos líneas
      doc.setFontSize(11);
      doc.text(
        `Productos: ${resumen.productos}   |   Stock total: ${resumen.stockTotal}   |   Recuperando: ${resumen.recuperando}   |   Ganancia: ${resumen.ganancia}   |   Recuperado: ${resumen.recuperado}`,
        marginX,
        y
      );
      y += 14;

      doc.setFontSize(10);
      doc.text(
        `Valor compra (estim): Bs ${resumen.valorCompra.toFixed(2)}   |   Valor venta (estim): Bs ${resumen.valorVenta.toFixed(
          2
        )}   |   Saldo neto: ${formatSaldo(resumen.saldoNeto)}`,
        marginX,
        y
      );

      // Prepara tabla
      const body = rowsSource.map((it) => {
        const stock = Number(it.stock ?? 0);
        const compra = Number(it.precio_compra || 0);
        const venta = Number(it.precio_unitario || 0);
        const saldo = Number(it.saldo || 0);

        return [
          String(it.nombre || "-"),
          String(stock),
          `Bs ${compra.toFixed(2)}`,
          `Bs ${venta.toFixed(2)}`,
          formatSaldo(saldo),
          getEstadoFromSaldo(saldo),
        ];
      });

      // Tabla con ajuste automático para evitar recortes
      autoTable(doc, {
        startY: y + 12,
        tableWidth: "auto",
        margin: { left: marginX, right: marginX },
        styles: {
          fontSize: 8,
          cellPadding: 3,
          overflow: "linebreak",
        },
        headStyles: {
          fontSize: 8,
        },
        head: [["Producto", "Stock", "Precio compra", "Precio venta", "Saldo", "Estado"]],
        body,
        columnStyles: {
          0: { cellWidth: 260 },
          1: { cellWidth: 55, halign: "right" },
          2: { cellWidth: 95, halign: "right" },
          3: { cellWidth: 95, halign: "right" },
          4: { cellWidth: 95, halign: "right" },
          5: { cellWidth: 110 },
        },
        didDrawPage: () => {
          const pageCount = doc.internal.getNumberOfPages();
          const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
          doc.setFontSize(9);
          doc.text(`Página ${currentPage} / ${pageCount}`, pageW - marginX, pageH - 16, { align: "right" });
        },
      });

      // Guarda el archivo
      const stamp = new Date().toISOString().slice(0, 10);
      openPdf(doc, `informe_economico_${stamp}.pdf`);
    } catch (e) {
      // Se deja el error en consola para depuración sin cambiar tu UI actual
      console.error(e);
    }
  };

  return (
    <SectionCard title="Economia" description="Control de inversion y recuperacion por producto.">
      <div className="card">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ maxWidth: 320 }}>
            <span className="form-title">Buscar producto</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar" />
          </label>

          {/* Botón para generar el informe económico en PDF (respeta el filtro de búsqueda) */}
          <div>
            <button type="button" onClick={generarInformeEconomicoPDF}>
              Generar informe (PDF)
            </button>
          </div>
        </div>

        <div className="inventario-table" style={{ marginTop: 12 }}>
          <div className="inventario-row head">
            <div>Foto</div>
            <div>Producto</div>
            <div>Stock</div>
            <div>Precio compra</div>
            <div>Precio venta</div>
            <div>Saldo</div>
            <div>Estado</div>
          </div>

          {visible.length === 0 ? (
            <p className="muted">No hay productos.</p>
          ) : (
            visible.map((item) => {
              const saldo = Number(item.saldo || 0);
              const color = saldo < 0 ? "#c0392b" : saldo > 0 ? "#1f8b4c" : "#6b7280";
              const estado = getEstadoFromSaldo(saldo);

              return (
                <div key={item.id_producto} className="inventario-row">
                  <div>
                    {item.foto_url ? (
                      <img
                        src={resolveUrl(item.foto_url)}
                        alt={item.nombre}
                        style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8 }}
                      />
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </div>
                  <div>{item.nombre || "-"}</div>
                  <div>{item.stock ?? 0}</div>
                  <div>Bs {Number(item.precio_compra || 0).toFixed(2)}</div>
                  <div>Bs {Number(item.precio_unitario || 0).toFixed(2)}</div>
                  <div style={{ color, fontWeight: 600 }}>{formatSaldo(saldo)}</div>
                  <div>
                    <span className="status-pill" style={{ background: color, color: "#fff" }}>
                      {estado}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </SectionCard>
  );
};

export default MicroempresaEconomia;