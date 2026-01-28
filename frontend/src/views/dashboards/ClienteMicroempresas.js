import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SectionCard from "../SectionCard";
import { fetchFollowedMicroempresas, followMicroempresa, unfollowMicroempresa } from "../../controllers/clienteController";
import { fetchPublicMicroempresas } from "../../controllers/publicController";
import ToastModal from "../ToastModal";
import { resolveAssetUrl } from "../utils/url";

const ClienteMicroempresas = () => {
  const [microempresas, setMicroempresas] = useState([]);
  const [followed, setFollowed] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingId, setPendingId] = useState(null);
  const [toast, setToast] = useState({ open: false, message: "", variant: "success" });

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const [microsRes, followedRes] = await Promise.all([
        fetchPublicMicroempresas(),
        fetchFollowedMicroempresas(),
      ]);
      if (microsRes.response.ok) {
        setMicroempresas(microsRes.data.microempresas || []);
      }
      if (followedRes.response.ok) {
        setFollowed(followedRes.data.microempresas || []);
      }
    } catch (error) {
      setMessage(error.message || "No se pudo cargar.");
    } finally {
      setLoading(false);
    }
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

  const followedIds = useMemo(
    () => new Set((followed || []).map((micro) => String(micro.tenant_id))),
    [followed]
  );

  const handleFollow = async (tenantId) => {
    setPendingId(tenantId);
    const { response, data } = await followMicroempresa(tenantId);
    if (!response.ok) {
      setMessage(data.error || "No se pudo seguir.");
      setPendingId(null);
      return;
    }
    setToast({ open: true, message: "Empresa seguida exitosamente.", variant: "success" });
    await load();
    setPendingId(null);
  };

  const handleUnfollow = async (tenantId) => {
    setPendingId(tenantId);
    const { response, data } = await unfollowMicroempresa(tenantId);
    if (!response.ok) {
      setMessage(data.error || "No se pudo dejar de seguir.");
      setPendingId(null);
      return;
    }
    setToast({ open: true, message: "Se dejó de seguir a la empresa.", variant: "success" });
    await load();
    setPendingId(null);
  };

  const renderMicroempresa = (micro, isFollowing) => (
    <article key={micro.tenant_id} className="micro-card">
      <div className="micro-logo">
        {micro.logo_url ? (
          <img src={resolveAssetUrl(micro.logo_url)} alt={micro.nombre} />
        ) : (
          <span>{String(micro.nombre || "?").slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <div className="micro-info">
        <div className="micro-name">{micro.nombre}</div>
        {micro.email && <div className="micro-meta">{micro.email}</div>}
      </div>
      <div className="micro-actions">
        <Link className="micro-link" to={`/microempresa/${micro.tenant_id}`}>
          Ver productos
        </Link>
        {isFollowing ? (
          <button
            type="button"
            className="micro-follow following"
            onClick={() => handleUnfollow(micro.tenant_id)}
            disabled={pendingId === micro.tenant_id}
          >
            Siguiendo
          </button>
        ) : (
          <button
            type="button"
            className="micro-follow"
            onClick={() => handleFollow(micro.tenant_id)}
            disabled={pendingId === micro.tenant_id}
          >
            Seguir
          </button>
        )}
      </div>
    </article>
  );

  return (
    <>
      <SectionCard title="Microempresas" description="Explora y sigue microempresas.">
        <div className="micro-grid">
          {microempresas.map((micro) => renderMicroempresa(micro, followedIds.has(String(micro.tenant_id))))}
        </div>
      </SectionCard>

      <SectionCard title="Siguiendo" description="Microempresas a las que estas suscrito.">
        <div className="micro-grid">
          {followed.length === 0 && <p className="muted">No sigues ninguna microempresa.</p>}
          {followed.map((micro) => renderMicroempresa(micro, true))}
        </div>
      </SectionCard>

      {loading && <p className="muted" style={{ marginTop: 12 }}>Cargando...</p>}
      <ToastModal
        open={toast.open}
        message={toast.message}
        variant={toast.variant}
        duration={10000}
        onClose={() => setToast({ open: false, message: "", variant: "success" })}
      />
    </>
  );
};

export default ClienteMicroempresas;
