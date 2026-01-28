import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import ForgotPasswordView from "./views/ForgotPasswordView";
import ResetPasswordView from "./views/ResetPasswordView";

// (modulo 2)
import MicroempresaSignupWizard from "./views/registro/MicroempresaSignupWizard";
import SuperUsuarioPendientes from "./views/dashboards/SuperUsuarioPendientes";

// Planes (super admin)
import SuperUsuarioPlanes from "./views/dashboards/SuperUsuarioPlanes";
import SuperUsuarioPlanCreate from "./views/dashboards/SuperUsuarioPlanCreate";
import SuperUsuarioVentas from "./views/dashboards/SuperUsuarioVentas";

// Gestión de clientes (microempresa)
import GestionClientes from "./views/dashboards/MicroempresaClientes";

import {
  fetchMe,
  guestLogin,
  login,
  logout,
  register,
  switchRole,
} from "./controllers/authController";
import { fetchDashboard } from "./controllers/dashboardController";
import {
  activateAdmin,
  activateCliente,
  activateMicroempresa,
  deactivateAdmin,
  deactivateCliente,
  deactivateMicroempresa,
  updateAdmin,
  updateCliente,
  updateMicroempresa,
} from "./controllers/userController";
import { updateEmpleadoMe } from "./controllers/empleadoController";

import DataList from "./views/DataList";
import DashboardLayout from "./views/DashboardLayout";
import LoginView from "./views/LoginView";
import ProfileSummaryView from "./views/ProfileSummaryView";
import ProfileView from "./views/ProfileView";
import SectionCard from "./views/SectionCard";

import MicroempresaDashboard from "./views/dashboards/MicroempresaDashboard";
import SuperUsuarioDashboard from "./views/dashboards/SuperUsuarioDashboard";
import SuperUsuarioClientes from "./views/dashboards/SuperUsuarioClientes";
import SuperUsuarioMicroempresas from "./views/dashboards/SuperUsuarioMicroempresas";
import SuperUsuarioAdmins from "./views/dashboards/SuperUsuarioAdmins";
import SuperUsuarioCategorias from "./views/dashboards/SuperUsuarioCategorias";
import SuperUsuarioAuditoria from "./views/dashboards/SuperUsuarioAuditoria";
import MicroempresaProductos from "./views/dashboards/MicroempresaProductos";
import MicroempresaHistorialCompras from "./views/dashboards/MicroempresaHistorialCompras";
import MicroempresaVentas from "./views/dashboards/MicroempresaVentas";
import MicroempresaPedidos from "./views/dashboards/MicroempresaPedidos";
import MicroempresaPOS from "./views/dashboards/MicroempresaPOS";
import MicroempresaInventario from "./views/dashboards/MicroempresaInventario";
import MicroempresaCompras from "./views/dashboards/MicroempresaCompras";
import MicroempresaEconomia from "./views/dashboards/MicroempresaEconomia";
import MicroempresaProveedores from "./views/dashboards/MicroempresaProveedores";
import MicroempresaEmpleados from "./views/dashboards/MicroempresaEmpleados";
import PortalProductos from "./views/PortalProductos";
import PortalProductoDetalle from "./views/PortalProductoDetalle";
import PortalCarrito from "./views/PortalCarrito";
import PortalPedidos from "./views/PortalPedidos";
import ClienteMicroempresas from "./views/dashboards/ClienteMicroempresas";
import { clearCart, resetCartOwner, setCartOwner } from "./utils/cartStorage";
import ToastModal from "./views/ToastModal";

const emptyForm = {
  username: "",
  password: "",
  nombre: "",
  apellido_paterno: "",
  apellido_materno: "",
  ci: "",
  logo_url: "",
  direccion: "",
  horario_inicio: "",
  horario_fin: "",
  nombre_propietario: "",
  apellido_paterno_propietario: "",
  apellido_materno_propietario: "",
  email: "",
  razon_social: "",
  es_empresa: "false",
  tipo_tienda: "fisica",
  tenant_id: "",
};

const Icon = {
  Dashboard: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" />
      <rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor" />
      <rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" />
      <rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" />
    </svg>
  ),
  Productos: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor" />
      <rect x="7" y="7" width="10" height="4" rx="1" fill="#fff" />
    </svg>
  ),
  Ventas: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16v4H4z" fill="currentColor" />
      <path d="M4 12h10v6H4z" fill="currentColor" />
      <rect x="16" y="12" width="4" height="6" fill="currentColor" />
    </svg>
  ),
  Pedidos: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="4" fill="currentColor" />
      <rect x="4" y="10" width="16" height="10" fill="currentColor" />
    </svg>
  ),
  POS: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2" fill="currentColor" />
      <rect x="7" y="10" width="10" height="2" fill="#fff" />
    </svg>
  ),
  Inventario: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="16" height="6" fill="currentColor" />
      <rect x="4" y="12" width="16" height="8" fill="currentColor" />
    </svg>
  ),
  Clientes: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" fill="currentColor" />
      <rect x="4" y="14" width="16" height="6" rx="3" fill="currentColor" />
    </svg>
  ),
  Empleados: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="8" r="3" fill="currentColor" />
      <circle cx="16" cy="8" r="3" fill="currentColor" />
      <path d="M4 20c0-3 8-3 8 0" fill="currentColor" />
      <path d="M12 20c0-3 8-3 8 0" fill="currentColor" />
    </svg>
  ),
  Perfil: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" fill="currentColor" />
      <path d="M4 20c2.5-4 13.5-4 16 0" fill="currentColor" />
    </svg>
  ),
};

const roleMenus = {
  super_usuario: [
    { path: "/dashboard", label: "Inicio", icon: Icon.Dashboard },
    { path: "/ventas", label: "Ventas", icon: Icon.Ventas },
    { path: "/planes", label: "Planes", icon: Icon.Ventas },
    { path: "/categorias", label: "Categorias", icon: Icon.Productos },
    { path: "/auditoria", label: "Auditoria", icon: Icon.Clientes },
    { path: "/microempresas-pendientes", label: "Microempresas en espera", icon: Icon.Pedidos },
    { path: "/microempresas", label: "Microempresas", icon: Icon.Inventario },
    { path: "/clientes", label: "Clientes", icon: Icon.Clientes },
    { path: "/superusuarios", label: "Superusuarios", icon: Icon.Perfil },
  ],
  microempresa: [
    { path: "/dashboard", label: "Inicio", icon: Icon.Dashboard },
    { path: "/ventas", label: "Ventas", icon: Icon.Ventas },
    { path: "/pedidos", label: "Pedidos", icon: Icon.Pedidos },
    { path: "/pos", label: "Punto de venta", icon: Icon.POS },
    { path: "/inventario", label: "Inventario", icon: Icon.Inventario },
    { path: "/compras", label: "Compras", icon: Icon.Ventas },
    { path: "/economia", label: "Economia", icon: Icon.Ventas },
    { path: "/historial-compras", label: "Historial compras", icon: Icon.Ventas },
    { path: "/proveedores", label: "Proveedores", icon: Icon.Clientes },
    { path: "/gestion-clientes", label: "Gestion de Clientes", icon: Icon.Clientes },
    { path: "/empleados", label: "Empleados", icon: Icon.Empleados },
    { path: "/mi-empresa", label: "Mi empresa", icon: Icon.Perfil },
  ],
  cliente: [
    { path: "/dashboard", label: "Productos", icon: Icon.Productos },
    { path: "/microempresas", label: "Microempresas", icon: Icon.Inventario },
    { path: "/mis-pedidos", label: "Mis pedidos", icon: Icon.Pedidos },
  ],
};

const empleadoMenuConfig = [
  { key: "ventas", path: "/ventas", label: "Ventas", icon: Icon.Ventas },
  { key: "pedidos", path: "/pedidos", label: "Pedidos", icon: Icon.Pedidos },
  { key: "pos", path: "/pos", label: "Punto de venta", icon: Icon.POS },
  { key: "inventario", path: "/inventario", label: "Inventario", icon: Icon.Inventario },
  { key: "compras", path: "/compras", label: "Compras", icon: Icon.Ventas },
  { key: "economia", path: "/economia", label: "Economia", icon: Icon.Ventas },
  { key: "proveedores", path: "/proveedores", label: "Proveedores", icon: Icon.Clientes },
  { key: "gestion_clientes", path: "/gestion-clientes", label: "Gestion de Clientes", icon: Icon.Clientes },
  { key: "historial_compras", path: "/historial-compras", label: "Historial compras", icon: Icon.Ventas },
];

const AppContent = () => {
  const [form, setForm] = useState(emptyForm);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [mode, setMode] = useState("login");
  const [registerRole, setRegisterRole] = useState(null);
  const [message, setMessage] = useState("");
  const [appToast, setAppToast] = useState({ open: false, message: "", variant: "success" });
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [roleOptions, setRoleOptions] = useState([]);
  const [pendingLogin, setPendingLogin] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [profileForm, setProfileForm] = useState(emptyForm);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const location = useLocation();
  const isPortalRoute = location.pathname.startsWith("/portal");
  const mustResetPassword =
    (role === "cliente" || role === "empleado") && Boolean(user?.force_password_reset);
  const shouldUseLayout = user && (role === "cliente" || !isPortalRoute || mustResetPassword);

  const buildFullName = (userData) => {
    if (!userData) return "";
    return [userData.nombre, userData.apellido_paterno, userData.apellido_materno]
      .filter(Boolean)
      .join(" ");
  };

  const displayName =
    role === "microempresa"
      ? user?.nombre || "Usuario"
      : buildFullName(user) || user?.username || "Usuario";

  const initials = displayName.slice(0, 2).toUpperCase();
  const avatarUrl = role === "microempresa" ? user?.logo_url : null;
  const menuItems = useMemo(() => {
    if (!role) return [];

    if (role === "empleado") {
      const permisos = Array.isArray(user?.permisos) ? user.permisos : [];
      return empleadoMenuConfig
        .filter((item) => permisos.includes(item.key))
        .map(({ key, ...item }) => item);
    }

    if (role === "microempresa") {
      const items = roleMenus.microempresa || [];
      if (user?.is_owner === false) {
        return items.filter((item) => item.path !== "/empleados");
      }
      return items;
    }

    return roleMenus[role] || [];
  }, [role, user]);

  const loadMe = async () => {
    const { data } = await fetchMe();
    setUser(data.user);
    setRole(data.role);
    setAvailableRoles(data.available_roles || []);
  };

  const loadDashboard = async () => {
    if (!user || role === "empleado") {
      setDashboardData(null);
      return;
    }
    const { data } = await fetchDashboard();
    setDashboardData(data);
  };

  useEffect(() => {
    loadMe();
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [user, role]);

  useEffect(() => {
    if (role === "cliente" && user?.email) {
      setCartOwner(user.email, { migrate: true });
    }
  }, [role, user?.email]);

  useEffect(() => {
    if (!user) {
      setProfileForm(emptyForm);
      return;
    }

    if (role === "super_usuario") {
      setProfileForm((prev) => ({
        ...prev,
        nombre: user.nombre || "",
        apellido_paterno: user.apellido_paterno || "",
        apellido_materno: user.apellido_materno || "",
        email: user.email || "",
        password: "",
      }));
      return;
    }

    if (role === "microempresa") {
      const horario = user.horario_atencion || "";

      const timeRangeRe = /^\s*\d{2}:\d{2}\s*-\s*\d{2}:\d{2}\s*$/;
      const isTimeRange = timeRangeRe.test(horario);

      const [inicio, fin] = isTimeRange
        ? horario.split("-").map((part) => part.trim())
        : ["", ""];

      const direccion = user.direccion || "";
      const looksVirtual =
        !isTimeRange ||
        /virtual/i.test(direccion) ||
        /atenci[oó]n\s*online/i.test(horario) ||
        /sin\s*tienda\s*f[ií]sica/i.test(direccion);

      setProfileForm((prev) => ({
        ...prev,
        tipo_tienda: looksVirtual ? "virtual" : "fisica",
        nombre: user.nombre || "",
        logo_url: user.logo_url || "",
        direccion: looksVirtual ? "" : user.direccion || "",
        horario_inicio: looksVirtual ? "" : inicio || "",
        horario_fin: looksVirtual ? "" : fin || "",
        nombre_propietario: user.nombre_propietario || "",
        apellido_paterno_propietario: user.apellido_paterno_propietario || "",
        apellido_materno_propietario: user.apellido_materno_propietario || "",
        email: user.email || "",
        password: "",
      }));
      return;
    }

    if (role === "empleado") {
      setProfileForm((prev) => ({
        ...prev,
        nombre: user.nombre || "",
        apellido_paterno: user.apellido_paterno || "",
        apellido_materno: user.apellido_materno || "",
        ci: user.ci || "",
        email: user.email || "",
        password: "",
      }));
      return;
    }

    if (role === "cliente") {
      const razonSocial = user.razon_social || "";
      setProfileForm((prev) => ({
        ...prev,
        nombre: user.nombre || "",
        apellido_paterno: user.apellido_paterno || "",
        apellido_materno: user.apellido_materno || "",
        ci: user.ci || "",
        razon_social: razonSocial,
        email: user.email || "",
        es_empresa: razonSocial ? "true" : "false",
        password: "",
      }));
    }
  }, [user, role]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBulkChange = (updates) => {
    setForm((prev) => ({ ...prev, ...updates }));
  };

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetAuthState = () => {
    setMessage("");
    setRoleOptions([]);
    setPendingLogin(null);
  };

  const showToast = (msg, variant = "success") => {
    setAppToast({ open: true, message: msg, variant });
  };

  const handleLogin = async () => {
    const { response, data } = await login({
      username: form.username,
      password: form.password,
    });

    if (!response.ok) {
      setMessage(data.error || "Ocurrió un error");
      return;
    }

    if (data.select_role) {
      setRoleOptions(data.roles || []);
      setPendingLogin({ username: form.username, password: form.password });
      return;
    }

    setUser(data.user);
    setRole(data.role);
    setAvailableRoles(data.available_roles || []);
    setForm(emptyForm);
    setMenuOpen(false);
    resetAuthState();
  };

  const handleRegister = async () => {
    if (registerRole === "microempresa") {
      setMessage(
        "El registro de microempresa ahora se hace por pasos. Usa el botón 'Microempresa (por plan)'."
      );
      return;
    }

    if (registerRole === "super_usuario") {
      const registerPayload = {
        role: registerRole,
        password: form.password,
        nombre: form.nombre,
        apellido_paterno: form.apellido_paterno,
        apellido_materno: form.apellido_materno,
        email: form.email,
      };

      const { response, data } = await register(registerPayload);
      if (!response.ok) {
        setMessage(data.error || "Ocurrió un error");
        return;
      }

      setUser(data.user);
      setRole(data.role);
      setAvailableRoles(data.available_roles || []);
      setForm(emptyForm);
      setMenuOpen(false);
      setMode("login");
      setRegisterRole(null);
      resetAuthState();
      return;
    }

    if (registerRole === "cliente") {
      const tenantIdStr = (form.tenant_id || "").toString().trim();

      const isEmpresa = String(form.es_empresa) === "true";
      if (isEmpresa && !(form.razon_social || "").trim()) {
        setMessage("Razón social requerida");
        return;
      }

      if (!(form.ci || "").trim()) {
        setMessage("CI requerido");
        return;
      }

      if (!form.password) {
        setMessage("Password requerido");
        return;
      }

      const payload = {
        ...(tenantIdStr ? { tenant_id: Number(tenantIdStr) } : {}),
        nombre: (form.nombre || "").trim(),
        apellido_paterno: (form.apellido_paterno || "").trim(),
        apellido_materno: (form.apellido_materno || "").trim(),
        ci: (form.ci || "").trim(),
        email: (form.email || "").trim(),
        password: form.password,
        es_empresa: isEmpresa,
        razon_social: isEmpresa ? (form.razon_social || "").trim() : "",
      };

      try {
        const res = await fetch("/api/public/clientes/register", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setMessage(data.error || "Ocurrió un error");
          return;
        }

        if (data.user && data.role) {
          setUser(data.user);
          setRole(data.role);
          setAvailableRoles(data.available_roles || []);
        } else {
          setMode("login");
          setRegisterRole(null);
          setMessage("Cliente registrado. Ahora inicia sesión.");
        }

        setForm(emptyForm);
        setMenuOpen(false);
        resetAuthState();
        return;
      } catch (e) {
        setMessage(e.message || "Ocurrió un error");
        return;
      }
    }

    setMessage("Rol de registro no soportado");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    if (mode === "login") {
      await handleLogin();
      return;
    }

    await handleRegister();
  };

  const handleRoleLogin = async (selectedRole) => {
    if (!pendingLogin) return;

    const { response, data } = await login({
      username: pendingLogin.username,
      password: pendingLogin.password,
      role: selectedRole,
    });

    if (!response.ok) {
      setMessage(data.error || "Ocurrió un error");
      return;
    }

    setUser(data.user);
    setRole(data.role);
    setAvailableRoles(data.available_roles || []);
    setForm(emptyForm);
    setMenuOpen(false);
    resetAuthState();
  };

  const handleGuestLogin = async () => {
    const { response, data } = await guestLogin();
    if (!response.ok) {
      setMessage(data.error || "Ocurrió un error");
      return;
    }
    setUser(data.user);
    setRole(data.role);
    setAvailableRoles(data.available_roles || []);
    setForm(emptyForm);
    setMenuOpen(false);
    resetAuthState();
    resetCartOwner();
    clearCart();
  };

  const handleSwitchRole = async (selectedRole) => {
    const { response, data } = await switchRole(selectedRole);
    if (!response.ok) {
      setMessage(data.error || "Ocurrió un error");
      return;
    }
    setUser(data.user);
    setRole(data.role);
    setAvailableRoles(data.available_roles || []);
    setMenuOpen(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore logout network errors; still reset UI state
    }
    setUser(null);
    setRole(null);
    setAvailableRoles([]);
    setMenuOpen(false);
    setMode("login");
    setRegisterRole(null);
    setForm(emptyForm);
    resetAuthState();
    setDashboardData(null);
    setProfileForm(emptyForm);
    resetCartOwner();
    if (window.location.pathname !== "/") {
      window.location.assign("/");
    }
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setProfileMessage("");
    setProfileSaving(true);

    try {
      let responseData;

      if (role === "super_usuario") {
        const payload = {
          nombre: profileForm.nombre,
          apellido_paterno: profileForm.apellido_paterno,
          apellido_materno: profileForm.apellido_materno,
        };
        if (profileForm.password) payload.password = profileForm.password;

        const { response, data } = await updateAdmin(user.id_su, payload);
        if (!response.ok) {
          setProfileMessage(data.error || "Ocurrió un error");
          return;
        }
        responseData = data.admin;
        setUser((prev) => ({ ...prev, ...responseData }));
      }

      if (role === "microempresa") {
        const VIRTUAL_DIRECCION = "Sin tienda física (virtual)";
        const VIRTUAL_HORARIO = "Atención online";

        const tipo = profileForm.tipo_tienda || "fisica";

        if (tipo === "fisica") {
          if (!profileForm.horario_inicio || !profileForm.horario_fin) {
            setProfileMessage("Debes seleccionar un rango de horario válido");
            return;
          }
          if (profileForm.horario_inicio >= profileForm.horario_fin) {
            setProfileMessage("El horario de fin debe ser mayor al de inicio");
            return;
          }
          if (!profileForm.direccion?.trim()) {
            setProfileMessage("Dirección requerida para tienda física");
            return;
          }
        }

        const payload = {
          nombre: profileForm.nombre,
          logo_url: profileForm.logo_url,
          direccion: tipo === "virtual" ? VIRTUAL_DIRECCION : profileForm.direccion,
          horario_atencion:
            tipo === "virtual"
              ? VIRTUAL_HORARIO
              : `${profileForm.horario_inicio} - ${profileForm.horario_fin}`,
          nombre_propietario: profileForm.nombre_propietario,
          apellido_paterno_propietario: profileForm.apellido_paterno_propietario,
          apellido_materno_propietario: profileForm.apellido_materno_propietario,
          tipo_tienda: tipo,
        };

        if (profileForm.password) payload.password = profileForm.password;

        const { response, data } = await updateMicroempresa(user.tenant_id, payload);
        if (!response.ok) {
          setProfileMessage(data.error || "Ocurrió un error");
          return;
        }

        responseData = data.microempresa;
        setUser((prev) => ({ ...prev, ...responseData }));
      }

      if (role === "empleado") {
        if (user?.force_password_reset && !profileForm.password) {
          setProfileMessage("Debes cambiar tu contraseña antes de continuar");
          return;
        }
        if (!(profileForm.ci || "").trim()) {
          setProfileMessage("CI requerido");
          return;
        }
        const payload = {
          nombre: profileForm.nombre,
          apellido_paterno: profileForm.apellido_paterno,
          apellido_materno: profileForm.apellido_materno,
          ci: (profileForm.ci || "").trim(),
        };
        if (profileForm.password) payload.password = profileForm.password;

        const { response, data } = await updateEmpleadoMe(payload);
        if (!response.ok) {
          setProfileMessage(data.error || "Ocurrio un error");
          return;
        }
        responseData = data.empleado;
        setUser((prev) => ({ ...prev, ...responseData }));
      }

      if (role === "cliente") {
        const isEmpresa = String(profileForm.es_empresa) === "true";
        if (isEmpresa && !profileForm.razon_social) {
          setProfileMessage("Razón social requerida");
          return;
        }
        if (user?.force_password_reset && !profileForm.password) {
          setProfileMessage("Debes cambiar tu contraseña antes de continuar");
          return;
        }
        if (!(profileForm.ci || "").trim()) {
          setProfileMessage("CI requerido");
          return;
        }
        const payload = {
          nombre: profileForm.nombre,
          apellido_paterno: profileForm.apellido_paterno,
          apellido_materno: profileForm.apellido_materno,
          ci: (profileForm.ci || "").trim(),
          razon_social: isEmpresa ? profileForm.razon_social : "",
          es_empresa: isEmpresa,
        };
        if (profileForm.password) payload.password = profileForm.password;

        const { response, data } = await updateCliente(user.id_cliente, payload);
        if (!response.ok) {
          setProfileMessage(data.error || "Ocurrió un error");
          return;
        }
        responseData = data.cliente;
        setUser((prev) => ({ ...prev, ...responseData }));
      }

      if (responseData) setProfileMessage("Datos actualizados correctamente");
    } finally {
      setProfileSaving(false);
    }
  };

  const openRegister = (selectedRole) => {
    setMode("register");
    setRegisterRole(selectedRole);
    setForm(emptyForm);
    resetAuthState();
  };

  const handleDeactivateMicroempresa = async (tenantId) => {
    const { response, data } = await deactivateMicroempresa(tenantId);
    if (!response.ok) {
      showToast(data.error || "Ocurrió un error", "warning");
      return;
    }
    showToast("Microempresa inactivada.");
    await loadDashboard();
  };

  const handleDeactivateCliente = async (clienteId) => {
    const { response, data } = await deactivateCliente(clienteId);
    if (!response.ok) {
      showToast(data.error || "Ocurrió un error", "warning");
      return;
    }
    showToast("Cliente inactivado.");
    await loadDashboard();
  };

  const handleDeactivateAdmin = async (adminId) => {
    const { response, data } = await deactivateAdmin(adminId);
    if (!response.ok) {
      showToast(data.error || "Ocurrió un error", "warning");
      return;
    }
    showToast("Superusuario inactivado.");
    await loadDashboard();
  };

  const handleActivateMicroempresa = async (tenantId) => {
    const { response, data } = await activateMicroempresa(tenantId);
    if (!response.ok) {
      showToast(data.error || "Ocurrió un error", "warning");
      return;
    }
    showToast("Microempresa activada.");
    await loadDashboard();
  };

  const handleActivateCliente = async (clienteId) => {
    const { response, data } = await activateCliente(clienteId);
    if (!response.ok) {
      showToast(data.error || "Ocurrió un error", "warning");
      return;
    }
    showToast("Cliente activado.");
    await loadDashboard();
  };

  const handleActivateAdmin = async (adminId) => {
    const { response, data } = await activateAdmin(adminId);
    if (!response.ok) {
      showToast(data.error || "Ocurrió un error", "warning");
      return;
    }
    showToast("Superusuario activado.");
    await loadDashboard();
  };

  const dashboardRoutes = () => {
    const forceReset = (role === "cliente" || role === "empleado") && user?.force_password_reset;

    if (role === "super_usuario") {
      return (
        <>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={<SuperUsuarioDashboard displayName={displayName} dashboardData={dashboardData} />}
          />
          <Route path="/ventas" element={<SuperUsuarioVentas />} />
          <Route path="/planes" element={<SuperUsuarioPlanes />} />
          <Route path="/auditoria" element={<SuperUsuarioAuditoria />} />
          <Route path="/planes/nuevo" element={<SuperUsuarioPlanCreate />} />
          <Route path="/categorias" element={<SuperUsuarioCategorias />} />

          <Route
            path="/microempresas-pendientes"
            element={
              <SuperUsuarioPendientes
                dashboardData={dashboardData}
                onApprove={handleActivateMicroempresa}
                onReject={handleDeactivateMicroempresa}
                reloadDashboard={loadDashboard}
              />
            }
          />

          <Route
            path="/microempresas"
            element={
              <SuperUsuarioMicroempresas
                items={dashboardData?.microempresas || []}
                onDeactivate={handleDeactivateMicroempresa}
                onActivate={handleActivateMicroempresa}
              />
            }
          />

          <Route
            path="/clientes"
            element={
              <SuperUsuarioClientes
                items={dashboardData?.clientes || []}
                microempresas={dashboardData?.microempresas || []}
                onDeactivate={handleDeactivateCliente}
                onActivate={handleActivateCliente}
                onUpdate={async (id, payload) => {
                  const { response, data } = await updateCliente(id, payload);
                  if (!response.ok) {
                    showToast(data.error || "Ocurrió un error", "warning");
                    return;
                  }
                  showToast("Cliente actualizado.");
                  await loadDashboard();
                }}
              />
            }
          />

          <Route
            path="/superusuarios"
            element={
              <SuperUsuarioAdmins
                items={dashboardData?.admins || []}
                onDeactivate={handleDeactivateAdmin}
                onActivate={handleActivateAdmin}
                currentAdminId={user?.id_su}
              />
            }
          />
        </>
      );
    }

    if (role === "microempresa") {
      return (
        <>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={<MicroempresaDashboard displayName={displayName} dashboardData={dashboardData} />}
          />
          <Route path="/ventas" element={<MicroempresaVentas />} />
          <Route path="/pedidos" element={<MicroempresaPedidos />} />
          <Route path="/pos" element={<MicroempresaPOS />} />
          <Route path="/inventario" element={<MicroempresaInventario />} />
          <Route path="/compras" element={<MicroempresaCompras />} />
          <Route path="/economia" element={<MicroempresaEconomia />} />
          <Route path="/productos" element={<MicroempresaProductos />} />
          <Route path="/historial-compras" element={<MicroempresaHistorialCompras />} />
          <Route path="/proveedores" element={<MicroempresaProveedores />} />
          <Route path="/gestion-clientes" element={<GestionClientes />} />
          <Route path="/empleados" element={<MicroempresaEmpleados />} />

          <Route
            path="/mi-empresa"
            element={<MicroempresaDashboard displayName={displayName} dashboardData={dashboardData} />}
          />
        </>
      );
    }

    if (role === "empleado") {
      if (forceReset) {
        return (
          <>
            <Route path="*" element={<Navigate to="/perfil/editar" replace />} />
          </>
        );
      }

      const permisos = Array.isArray(user?.permisos) ? user.permisos : [];
      const hasPerm = (perm) => permisos.includes(perm);
      const defaultPath =
        (hasPerm("ventas") && "/ventas") ||
        (hasPerm("pedidos") && "/pedidos") ||
        (hasPerm("pos") && "/pos") ||
        (hasPerm("inventario") && "/inventario") ||
        (hasPerm("compras") && "/compras") ||
        (hasPerm("economia") && "/economia") ||
        (hasPerm("proveedores") && "/proveedores") ||
        (hasPerm("gestion_clientes") && "/gestion-clientes") ||
        (hasPerm("historial_compras") && "/historial-compras") ||
        "/perfil";

      return (
        <>
          <Route path="/" element={<Navigate to={defaultPath} replace />} />
          <Route path="/dashboard" element={<Navigate to={defaultPath} replace />} />
          {hasPerm("ventas") && <Route path="/ventas" element={<MicroempresaVentas />} />}
          {hasPerm("pedidos") && <Route path="/pedidos" element={<MicroempresaPedidos />} />}
          {hasPerm("pos") && <Route path="/pos" element={<MicroempresaPOS />} />}
          {hasPerm("inventario") && <Route path="/inventario" element={<MicroempresaInventario />} />}
          {hasPerm("compras") && <Route path="/compras" element={<MicroempresaCompras />} />}
          {hasPerm("economia") && <Route path="/economia" element={<MicroempresaEconomia />} />}
          {hasPerm("proveedores") && <Route path="/proveedores" element={<MicroempresaProveedores />} />}
          {hasPerm("gestion_clientes") && <Route path="/gestion-clientes" element={<GestionClientes />} />}
          {hasPerm("historial_compras") && (
            <Route path="/historial-compras" element={<MicroempresaHistorialCompras />} />
          )}
        </>
      );
    }

    if (role === "cliente") {
      return (
        <>
          {forceReset && <Route path="*" element={<Navigate to="/perfil/editar" replace />} />}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={<PortalProductos />}
          />
          <Route path="/microempresa/:tenantId" element={<PortalProductos />} />
          <Route path="/producto/:productoId" element={<PortalProductoDetalle />} />
          <Route
            path="/microempresas"
            element={<ClienteMicroempresas />}
          />
          <Route path="/mis-pedidos" element={<PortalPedidos />} />
        </>
      );
    }

    return null;
  };

  return shouldUseLayout ? (
    <DashboardLayout
      menuItems={menuItems}
      displayName={displayName}
      initials={initials}
      avatarUrl={avatarUrl}
      menuOpen={menuOpen}
      setMenuOpen={setMenuOpen}
      sidebarCollapsed={sidebarCollapsed}
      setSidebarCollapsed={setSidebarCollapsed}
      onLogout={handleLogout}
      availableRoles={availableRoles}
      currentRole={role}
      onSwitchRole={handleSwitchRole}
      themeClass={`theme-${role}`}
    >
      <Routes>
        {dashboardRoutes()}

        <Route path="/portal" element={<PortalProductos />} />
        <Route path="/portal/:tenantId" element={<PortalProductos />} />
        <Route path="/portal/producto/:productoId" element={<PortalProductoDetalle />} />
        <Route path="/portal/carrito" element={<PortalCarrito />} />
        <Route path="/portal/pedidos" element={<PortalPedidos />} />

        <Route
          path="/perfil"
          element={
            role === "cliente" && !user?.id_cliente ? (
              <SectionCard title="Perfil">
                <p className="muted">El perfil no está disponible en modo invitado.</p>
              </SectionCard>
            ) : (
              <ProfileSummaryView
                role={role}
                user={user}
                canEdit={role !== "cliente" || Boolean(user?.id_cliente)}
              />
            )
          }
        />

        <Route
          path="/perfil/editar"
          element={
            role === "cliente" && !user?.id_cliente ? (
              <SectionCard title="Perfil">
                <p className="muted">El perfil no está disponible en modo invitado.</p>
              </SectionCard>
            ) : role === "super_usuario" || role === "microempresa" || role === "cliente" ? (
              <ProfileView
                role={role}
                form={profileForm}
                message={profileMessage}
                onChange={handleProfileChange}
                onSubmit={handleProfileSubmit}
                isSaving={profileSaving}
                forcePasswordReset={
                  (role === "cliente" || role === "empleado") && Boolean(user?.force_password_reset)
                }
              />
            ) : (
              <SectionCard title="Perfil">
                <p className="muted">La edición no está disponible para este rol.</p>
              </SectionCard>
            )
          }
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <ToastModal
        open={appToast.open}
        message={appToast.message}
        variant={appToast.variant}
        duration={10000}
        onClose={() => setAppToast({ open: false, message: "", variant: "success" })}
      />
    </DashboardLayout>
  ) : (
    <>
      <Routes>
        <Route path="/portal" element={<PortalProductos />} />
        <Route path="/portal/producto/:productoId" element={<PortalProductoDetalle />} />
        <Route path="/portal/:tenantId" element={<PortalProductos />} />
        <Route path="/portal/carrito" element={<PortalCarrito />} />
        <Route path="/portal/pedidos" element={<PortalPedidos />} />
        <Route
          path="/"
          element={
            <LoginView
              form={form}
              mode={mode}
              registerRole={registerRole}
              roleOptions={roleOptions}
              message={message}
              onChange={handleChange}
              onBulkChange={handleBulkChange}
              onSubmit={handleSubmit}
              onSelectRole={handleRoleLogin}
              onBackFromRoleSelect={() => {
                setRoleOptions([]);
                setPendingLogin(null);
              }}
              onOpenRegister={openRegister}
              onBackToLogin={() => {
                setMode("login");
                setRegisterRole(null);
                setForm(emptyForm);
                resetAuthState();
              }}
              onGuestLogin={handleGuestLogin}
            />
          }
        />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/forgot-password" element={<ForgotPasswordView />} />
        <Route path="/reset-password" element={<ResetPasswordView />} />
        <Route path="/registro/microempresa/*" element={<MicroempresaSignupWizard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastModal
        open={appToast.open}
        message={appToast.message}
        variant={appToast.variant}
        duration={10000}
        onClose={() => setAppToast({ open: false, message: "", variant: "success" })}
      />
    </>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
