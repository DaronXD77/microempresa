const CART_KEY = "portal_cart_v1";
const CART_OWNER_KEY = "portal_cart_owner_v1";
const GUEST_KEY = "portal_cart_guest_id_v1";

const getGuestId = () => {
  try {
    let id = localStorage.getItem(GUEST_KEY);
    if (!id) {
      id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(GUEST_KEY, id);
    }
    return `guest:${id}`;
  } catch {
    return "guest:anonymous";
  }
};

const getOwner = () => {
  try {
    const owner = localStorage.getItem(CART_OWNER_KEY);
    return owner || getGuestId();
  } catch {
    return getGuestId();
  }
};

const cartKeyForOwner = (owner) => `${CART_KEY}:${owner}`;

const readCart = () => {
  try {
    const raw = localStorage.getItem(cartKeyForOwner(getOwner()));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeCart = (data) => {
  localStorage.setItem(cartKeyForOwner(getOwner()), JSON.stringify(data));
};

export const getCart = () => {
  const data = readCart();
  return data.cart || null;
};

export const setCart = (cart) => {
  writeCart({ cart });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("cartUpdated"));
  }
};

export const clearCart = () => {
  writeCart({ cart: null });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("cartUpdated"));
  }
};

export const setCartOwner = (ownerId, { migrate = true } = {}) => {
  const nextOwner = ownerId ? String(ownerId).trim().toLowerCase() : null;
  const currentOwner = getOwner();
  const finalOwner = nextOwner || getGuestId();

  if (nextOwner) {
    localStorage.setItem(CART_OWNER_KEY, nextOwner);
  } else {
    localStorage.removeItem(CART_OWNER_KEY);
  }

  if (migrate && currentOwner !== finalOwner) {
    try {
      const currentKey = cartKeyForOwner(currentOwner);
      const nextKey = cartKeyForOwner(finalOwner);
      const raw = localStorage.getItem(currentKey);
      if (raw && !localStorage.getItem(nextKey)) {
        localStorage.setItem(nextKey, raw);
      }
    } catch {
      // ignore migration errors
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("cartUpdated"));
  }
};

export const resetCartOwner = () => {
  try {
    localStorage.removeItem(CART_OWNER_KEY);
  } catch {
    // ignore
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("cartUpdated"));
  }
};

export const addToCart = (producto, cantidad = 1) => {
  const cart = getCart();
  const tenantId = producto?.microempresa?.tenant_id || producto?.tenant_id;
  if (!tenantId) {
    return { error: "Producto inválido" };
  }
  const stock = producto?.stock;
  if (typeof stock === "number" && stock >= 0 && cantidad > stock) {
    return { error: "Stock insuficiente para este producto." };
  }

  if (cart && String(cart.tenant_id) !== String(tenantId)) {
    return { error: "Solo puedes comprar productos de una microempresa a la vez." };
  }

  const next = cart
    ? { ...cart }
    : { tenant_id: tenantId, microempresa: producto.microempresa || null, items: [] };

  const existing = next.items.find((item) => item.id_producto === producto.id_producto);
  if (existing) {
    return { error: "Este producto ya está en el carrito. Si quieres más, cambia la cantidad." };
  } else {
    next.items.push({
      id_producto: producto.id_producto,
      nombre: producto.nombre,
      precio_unitario: producto.precio_unitario,
      cantidad,
      stock: producto.stock,
      foto_url: producto.fotos?.[0]?.url || producto.microempresa?.logo_url || "",
    });
  }

  setCart(next);
  return { cart: next };
};

export const updateCartItem = (id_producto, cantidad) => {
  const cart = getCart();
  if (!cart) return { error: "Carrito vacío" };
  const next = { ...cart, items: cart.items.map((item) => ({ ...item })) };
  const target = next.items.find((item) => item.id_producto === id_producto);
  if (!target) return { error: "Producto no encontrado" };
  const stock = target.stock;
  const safeQty = Math.max(1, cantidad);
  if (typeof stock === "number" && stock >= 0 && safeQty > stock) {
    return { error: "Stock insuficiente para este producto." };
  }
  target.cantidad = safeQty;
  setCart(next);
  return { cart: next };
};

export const removeCartItem = (id_producto) => {
  const cart = getCart();
  if (!cart) return { error: "Carrito vacío" };
  const next = { ...cart, items: cart.items.filter((item) => item.id_producto !== id_producto) };
  if (next.items.length === 0) {
    clearCart();
    return { cart: null };
  }
  setCart(next);
  return { cart: next };
};
