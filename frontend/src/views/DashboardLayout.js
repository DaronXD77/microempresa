import { NavLink, useLocation } from "react-router-dom";
import { resolveAssetUrl } from "../utils/url";

/**
 * =========================================================
 * 📌 pageTitles
 * ---------------------------------------------------------
 * 🔹 NUEVO:
 * Se agrega el título para la ruta `/gestion-clientes`
 * usada por el rol "microempresa" para administrar
 * sus propios clientes (multi-tenant).
 *
 * Esto permite que el <h1> del dashboard se actualice
 * automáticamente sin tocar la lógica del layout.
 * =========================================================
 */
const pageTitles = {
  "/dashboard": "Dashboard",
  "/planes": "Planes",
  "/planes/nuevo": "Crear plan",
  "/microempresas-pendientes": "Microempresas en espera",
  "/microempresas": "Microempresas",
  "/clientes": "Clientes",
  "/gestion-clientes": "Gestión de clientes", // ✅ NUEVO
  "/mi-empresa": "Mi empresa",
  "/categorias": "Categorias",
  "/auditoria": "Auditoria",
  "/productos": "Productos",
  "/historial-compras": "Historial de compras",
  "/empleados": "Empleados",
  "/ventas": "Ventas",
  "/pedidos": "Pedidos",
  "/pos": "Punto de venta",
  "/inventario": "Inventario",
  "/compras": "Compras",
  "/economia": "Economia",
  "/proveedores": "Proveedores",
  "/mis-pedidos": "Mis pedidos",
  "/perfil": "Perfil",
};

/**
 * Etiquetas visibles para el selector de roles
 */
const roleLabels = {
  super_usuario: "Super usuario",
  microempresa: "Microempresa",
  cliente: "Cliente",
  empleado: "Empleado",
};

const DashboardLayout = ({
  children,
  menuItems,
  displayName,
  initials,
  avatarUrl,
  menuOpen,
  setMenuOpen,
  sidebarCollapsed,
  setSidebarCollapsed,
  onLogout,
  availableRoles,
  currentRole,
  onSwitchRole,
  themeClass,
}) => {
  const location = useLocation();
  const isMobile = typeof window !== "undefined" && window.innerWidth < 900;

  /**
   * Título dinámico basado en la ruta actual.
   * Si la ruta no está definida en pageTitles,
   * se usa "Dashboard" como fallback.
   */
  const title = pageTitles[location.pathname] || "Dashboard";

  /**
   * Roles disponibles para cambio rápido
   * (excluye el rol actual)
   */
  const switchRoles = availableRoles.filter((role) => role !== currentRole);

  const closeMobileNav = () => {
    if (!isMobile) return;
    setSidebarCollapsed(true);
  };

  return (
    <div className={`app-shell ${!sidebarCollapsed ? "nav-open" : ""} ${themeClass || ""}`.trim()}>
      {!sidebarCollapsed && isMobile && (
        <button type="button" className="nav-backdrop" aria-label="Cerrar menu" onClick={closeMobileNav} />
      )}
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`.trim()}>
        <div className="sidebar-top">
          <div className="brand">
            {roleLabels[currentRole] || "Dashboard"}
          </div>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            aria-label="Alternar menu"
          >
            <span />
            <span />
            <span />
          </button>
          <button
            type="button"
            className="sidebar-close"
            onClick={closeMobileNav}
            aria-label="Cerrar menu"
          >
            ×
          </button>
        </div>

        <nav className="menu">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={closeMobileNav}
              className={({ isActive }) =>
                `menu-item${isActive ? " active" : ""}`
              }
            >
              {item.icon && <span className="menu-icon">{item.icon}</span>}
              <span className="menu-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-nav-toggle"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              aria-label="Abrir menu"
            >
              <span />
              <span />
              <span />
            </button>
            <h1>{title}</h1>
          </div>

          <div className="user-menu">
            <button
              type="button"
              className="avatar-button"
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              {avatarUrl ? (
                <img
                  className="avatar-image"
                  src={resolveAssetUrl(avatarUrl)}
                  alt={displayName}
                />
              ) : (
                <span className="avatar">{initials}</span>
              )}
              <span className="avatar-name">{displayName}</span>
            </button>

            {menuOpen && (
              <div className="dropdown">
                {switchRoles.length > 0 && (
                  <div className="dropdown-section">
                    <span className="dropdown-title">Cambiar rol</span>
                    {switchRoles.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => onSwitchRole(role)}
                      >
                        {roleLabels[role] || role}
                      </button>
                    ))}
                  </div>
                )}

                <NavLink to="/perfil" className="dropdown-link">
                  Perfil
                </NavLink>

                <button type="button" onClick={onLogout}>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </header>

        {children}
      </div>
    </div>
  );
};

export default DashboardLayout;
