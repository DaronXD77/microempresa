import React, { useEffect } from "react";

const ToastModal = ({
  open,
  message,
  variant = "success",
  duration = 7000,
  actionLabel = "Volver",
  onClose,
  onAction,
}) => {
  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [open, duration, onClose]);

  if (!open || !message) return null;

  return (
    <div className="toast-backdrop" onClick={onClose}>
      <div className={`toast-modal toast-${variant}`} onClick={(e) => e.stopPropagation()}>
        <div className="toast-icon" aria-hidden="true">
          {variant === "success" ? "✓" : "!"}
        </div>
        <div className="toast-message">{message}</div>
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            const result = onAction ? onAction() : undefined;
            if (result === false) return;
            if (onClose) onClose();
          }}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
};

export default ToastModal;
