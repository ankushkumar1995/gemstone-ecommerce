"use client";

/**
 * Client-side commerce store.
 *
 * Persistence is HYBRID:
 *   • Logged OUT (guest): everything lives in localStorage (cart, wishlist,
 *     recently-viewed, reviews) so the browsing experience survives reloads.
 *   • Logged IN: the account-owned data — profile, orders, saved addresses
 *     and wishlist — is backed by the real DB via /api/v1/account/*. On login
 *     we hydrate from the server (source of truth, works across devices) and
 *     every mutation is persisted back. Cart / recently-viewed / reviews stay
 *     local by design.
 *
 * The reducer + component API are unchanged, so UI code never had to change —
 * only where the data comes from and goes to.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Product } from "@/types";
import { customerApi, type AddressPayload } from "@/lib/customer-api";
import { shopApi } from "@/lib/shop-api";
import type { CustomerAddress } from "@/modules/customers";
import type { Order as DbOrder } from "@/modules/orders";

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */
export interface CartLine {
  product: Product;
  qty: number;
}

export interface User {
  /** DB customer id (from the authenticated session). Absent for stale/local-only users. */
  id?: string;
  name: string;
  email: string;
  phone?: string;
}

export interface Address {
  id: string;
  label: string; // Home / Office
  name: string;
  phone: string;
  line: string;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

export interface OrderItem {
  id: string;
  slug: string;
  name: string;
  image: string;
  price: number;
  qty: number;
}

export interface Order {
  id: string; // e.g. NK-2026-0481
  date: string; // ISO
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  status: "Confirmed" | "Energising" | "Shipped" | "Delivered";
}

export interface UserReview {
  id: string;
  productId: string;
  rating: number;
  title: string;
  body: string;
  author: string;
  date: string; // ISO
}

interface CommerceState {
  cart: CartLine[];
  wishlist: Product[];
  user: User | null;
  orders: Order[];
  addresses: Address[];
  recentlyViewed: Product[];
  reviews: UserReview[];
}

type Action =
  | { type: "HYDRATE"; payload: Partial<CommerceState> }
  | { type: "ADD_TO_CART"; product: Product; qty: number }
  | { type: "REMOVE_FROM_CART"; id: string }
  | { type: "SET_QTY"; id: string; qty: number }
  | { type: "CLEAR_CART" }
  | { type: "TOGGLE_WISHLIST"; product: Product }
  | { type: "REMOVE_FROM_WISHLIST"; id: string }
  | { type: "LOGIN"; user: User }
  | { type: "LOGOUT" }
  | { type: "UPDATE_PROFILE"; patch: Partial<User> }
  | { type: "PLACE_ORDER"; order: Order }
  | { type: "SET_ORDERS"; orders: Order[] }
  | { type: "SET_ADDRESSES"; addresses: Address[] }
  | { type: "SET_WISHLIST"; wishlist: Product[] }
  | { type: "ADD_ADDRESS"; address: Address }
  | { type: "REMOVE_ADDRESS"; id: string }
  | { type: "SET_DEFAULT_ADDRESS"; id: string }
  | { type: "VIEW_PRODUCT"; product: Product }
  | { type: "ADD_REVIEW"; review: UserReview };

const STORAGE_KEY = "astrounkle-commerce-v2";

/* ------------------------------------------------------------------ *
 * Reducer
 * ------------------------------------------------------------------ */
function reducer(state: CommerceState, action: Action): CommerceState {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, ...action.payload };

    case "ADD_TO_CART": {
      const existing = state.cart.find((l) => l.product.id === action.product.id);
      if (existing) {
        return {
          ...state,
          cart: state.cart.map((l) =>
            l.product.id === action.product.id
              ? { ...l, qty: l.qty + action.qty }
              : l
          ),
        };
      }
      return {
        ...state,
        cart: [...state.cart, { product: action.product, qty: action.qty }],
      };
    }

    case "REMOVE_FROM_CART":
      return { ...state, cart: state.cart.filter((l) => l.product.id !== action.id) };

    case "SET_QTY":
      return {
        ...state,
        cart: state.cart
          .map((l) =>
            l.product.id === action.id ? { ...l, qty: Math.max(0, action.qty) } : l
          )
          .filter((l) => l.qty > 0),
      };

    case "CLEAR_CART":
      return { ...state, cart: [] };

    case "TOGGLE_WISHLIST": {
      const exists = state.wishlist.some((p) => p.id === action.product.id);
      return {
        ...state,
        wishlist: exists
          ? state.wishlist.filter((p) => p.id !== action.product.id)
          : [...state.wishlist, action.product],
      };
    }

    case "REMOVE_FROM_WISHLIST":
      return {
        ...state,
        wishlist: state.wishlist.filter((p) => p.id !== action.id),
      };

    case "LOGIN":
      return { ...state, user: action.user };

    case "LOGOUT":
      // Clear account-owned data so a signed-out (or next) user never sees the
      // previous customer's orders / addresses / wishlist. Cart is kept.
      return { ...state, user: null, orders: [], addresses: [], wishlist: [] };

    case "UPDATE_PROFILE":
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.patch } : state.user,
      };

    case "PLACE_ORDER":
      return { ...state, orders: [action.order, ...state.orders] };

    case "SET_ORDERS":
      return { ...state, orders: action.orders };

    case "SET_ADDRESSES":
      return { ...state, addresses: action.addresses };

    case "SET_WISHLIST":
      return { ...state, wishlist: action.wishlist };

    case "ADD_ADDRESS": {
      const first = state.addresses.length === 0;
      const addr = { ...action.address, isDefault: first || action.address.isDefault };
      const addresses = addr.isDefault
        ? state.addresses.map((a) => ({ ...a, isDefault: false }))
        : state.addresses;
      return { ...state, addresses: [...addresses, addr] };
    }

    case "REMOVE_ADDRESS":
      return {
        ...state,
        addresses: state.addresses.filter((a) => a.id !== action.id),
      };

    case "SET_DEFAULT_ADDRESS":
      return {
        ...state,
        addresses: state.addresses.map((a) => ({
          ...a,
          isDefault: a.id === action.id,
        })),
      };

    case "VIEW_PRODUCT": {
      const rest = state.recentlyViewed.filter(
        (p) => p.id !== action.product.id
      );
      return {
        ...state,
        recentlyViewed: [action.product, ...rest].slice(0, 8),
      };
    }

    case "ADD_REVIEW":
      return { ...state, reviews: [action.review, ...state.reviews] };

    default:
      return state;
  }
}

const initialState: CommerceState = {
  cart: [],
  wishlist: [],
  user: null,
  orders: [],
  addresses: [],
  recentlyViewed: [],
  reviews: [],
};

/* ------------------------------------------------------------------ *
 * Mapping helpers — translate between the DB module shapes and the
 * store's UI shapes. Kept in one place so the mappings never drift.
 * ------------------------------------------------------------------ */

/** DB CustomerAddress → store Address (line1→line, postalCode→pincode). */
function dbAddressToStore(a: CustomerAddress): Address {
  return {
    id: a.id,
    label: a.label || "Home",
    name: a.name ?? "",
    phone: a.phone ?? "",
    line: a.line1 ?? "",
    city: a.city ?? "",
    state: a.state ?? "",
    pincode: a.postalCode ?? "",
    isDefault: a.isDefault,
  };
}

/** store Address (or add-form) → the API address payload. */
function storeAddressToPayload(a: Omit<Address, "id">): AddressPayload {
  return {
    label: a.label,
    name: a.name,
    phone: a.phone,
    line1: a.line,
    city: a.city,
    state: a.state,
    postalCode: a.pincode,
    country: "India",
    isDefault: a.isDefault,
  };
}

/** DB order status → the store's friendly status label. */
function dbStatusToStore(s: DbOrder["status"]): Order["status"] {
  switch (s) {
    case "shipped":
      return "Shipped";
    case "delivered":
      return "Delivered";
    case "packed":
      return "Energising";
    default:
      // pending / confirmed / cancelled / refunded all show as "Confirmed"
      // in the simple storefront timeline (admin has the full lifecycle).
      return "Confirmed";
  }
}

/** DB Order → store Order (what the account dashboard renders). */
function dbOrderToStore(o: DbOrder): Order {
  return {
    id: o.orderNumber,
    date: o.placedAt,
    items: o.items.map((it) => ({
      id: it.productId,
      slug: "",
      name: it.name,
      image: it.image ?? "",
      price: it.unitPrice,
      qty: it.qty,
    })),
    subtotal: o.pricing.subtotal,
    shipping: o.pricing.shipping,
    total: o.pricing.grandTotal,
    status: dbStatusToStore(o.status),
  };
}

/* ------------------------------------------------------------------ *
 * Context
 * ------------------------------------------------------------------ */
interface CommerceContextValue extends CommerceState {
  cartCount: number;
  cartSubtotal: number;
  cartMrpTotal: number;
  wishlistCount: number;
  addToCart: (product: Product, qty?: number) => void;
  removeFromCart: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clearCart: () => void;
  toggleWishlist: (product: Product) => void;
  removeFromWishlist: (id: string) => void;
  isInWishlist: (id: string) => boolean;
  isInCart: (id: string) => boolean;
  cartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  // auth
  /** False until the real session (/me) has resolved — gate auth-dependent UI
   *  on this to avoid a logged-out → logged-in flash on refresh. */
  authReady: boolean;
  login: (user: User) => void;
  logout: () => void;
  updateProfile: (patch: Partial<User>) => void;
  // orders
  placeOrder: (order: Order) => void;
  // addresses
  addAddress: (address: Address) => void;
  /** Persist a new address and resolve with the authoritative server list
   *  (ids assigned, single-default enforced). For a signed-in user this hits
   *  the DB and reports failure (never a silent local-only save). Guests get a
   *  local-only entry. Used by checkout to auto-select the new one. */
  addAddressAsync: (
    address: Omit<Address, "id">,
  ) => Promise<{ ok: boolean; addresses: Address[]; message?: string }>;
  removeAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
  // recently viewed
  viewProduct: (product: Product) => void;
  // reviews
  addReview: (review: UserReview) => void;
  reviewsFor: (productId: string) => UserReview[];
}

const CommerceContext = createContext<CommerceContextValue | null>(null);

export function CommerceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [hydrated, setHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  // Flips to true once /me resolves (success OR failure). Until then,
  // auth-dependent screens show a neutral placeholder instead of flashing the
  // login card before the real session is known.
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "HYDRATE", payload: JSON.parse(raw) });
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  // Keep live refs so DB-syncing mutators + the hydration effect can read the
  // current user / state without being re-created on every change.
  const userRef = useRef<User | null>(null);
  userRef.current = state.user;
  const stateRef = useRef<CommerceState>(state);
  stateRef.current = state;

  // Reconcile the client `user` with the REAL httpOnly session on the server.
  // The cookie is the source of truth: /me returns the DB customer when a valid
  // session exists, else we clear any stale local `user`. This keeps the UI in
  // step with logout-everywhere / token kill-switch and survives reloads.
  //
  // When signed in we ALSO hydrate the account-owned data (orders, addresses,
  // wishlist) from the DB so it's correct across devices and after a cache
  // clear. The server is the source of truth for these.
  useEffect(() => {
    let active = true;
    (async () => {
      const res = await customerApi.me();
      if (!active) return;
      if (!res.ok) {
        dispatch({ type: "LOGOUT" });
        setAuthReady(true); // session known (signed out)
        return;
      }
      const c = res.data.customer;
      dispatch({ type: "LOGIN", user: { id: c.id, name: c.name, email: c.email, phone: c.phone } });
      setAuthReady(true); // session known (signed in) — render immediately,
      //                     account data below streams in afterwards.

      // Pull account data in parallel. Each is best-effort: a failure just
      // leaves that slice empty rather than breaking the dashboard.
      const [ordersRes, addrRes, wishRes, productsRes] = await Promise.all([
        customerApi.orders(),
        customerApi.addresses.list(),
        customerApi.wishlist.list(),
        shopApi.products.list(),
      ]);
      if (!active) return;

      if (ordersRes.ok) {
        dispatch({ type: "SET_ORDERS", orders: ordersRes.data.orders.map(dbOrderToStore) });
      }
      if (addrRes.ok) {
        dispatch({ type: "SET_ADDRESSES", addresses: addrRes.data.addresses.map(dbAddressToStore) });
      }
      if (wishRes.ok) {
        // Resolve wishlisted product ids → full Product objects for the UI.
        // Prefer the freshly-fetched catalogue; fall back to whatever products
        // are already known locally (recently viewed / existing wishlist).
        const ids = new Set(wishRes.data.wishlist);
        const catalogue: Product[] = productsRes.ok ? productsRes.data : [];
        const known = new Map<string, Product>();
        for (const p of catalogue) known.set(p.id, p);
        for (const p of stateRef.current.wishlist) if (!known.has(p.id)) known.set(p.id, p);
        for (const p of stateRef.current.recentlyViewed) if (!known.has(p.id)) known.set(p.id, p);
        const resolved: Product[] = [];
        for (const id of ids) {
          const p = known.get(id);
          if (p) resolved.push(p);
        }
        dispatch({ type: "SET_WISHLIST", wishlist: resolved });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, hydrated]);

  const addToCart = useCallback((product: Product, qty = 1) => {
    dispatch({ type: "ADD_TO_CART", product, qty });
    setCartOpen(true);
  }, []);
  const removeFromCart = useCallback(
    (id: string) => dispatch({ type: "REMOVE_FROM_CART", id }),
    []
  );
  const setQty = useCallback(
    (id: string, qty: number) => dispatch({ type: "SET_QTY", id, qty }),
    []
  );
  const clearCart = useCallback(() => dispatch({ type: "CLEAR_CART" }), []);

  // Wishlist — optimistic local toggle, then persist to the DB when signed in.
  const toggleWishlist = useCallback((product: Product) => {
    const wasIn = stateRef.current.wishlist.some((p) => p.id === product.id);
    dispatch({ type: "TOGGLE_WISHLIST", product });
    if (!userRef.current?.id) return; // guest → local only
    const call = wasIn
      ? customerApi.wishlist.remove(product.id)
      : customerApi.wishlist.add(product.id);
    void call; // fire-and-forget; local state already reflects the change
  }, []);

  const removeFromWishlist = useCallback((id: string) => {
    dispatch({ type: "REMOVE_FROM_WISHLIST", id });
    if (userRef.current?.id) void customerApi.wishlist.remove(id);
  }, []);

  const login = useCallback((user: User) => dispatch({ type: "LOGIN", user }), []);
  const logout = useCallback(() => dispatch({ type: "LOGOUT" }), []);

  // Profile — update locally, then persist name/phone to the DB when signed in.
  const updateProfile = useCallback((patch: Partial<User>) => {
    dispatch({ type: "UPDATE_PROFILE", patch });
    if (!userRef.current?.id) return;
    const body: { name?: string; phone?: string } = {};
    if (patch.name !== undefined) body.name = patch.name;
    if (patch.phone !== undefined) body.phone = patch.phone;
    if (Object.keys(body).length > 0) void customerApi.updateProfile(body);
  }, []);

  const placeOrder = useCallback(
    (order: Order) => dispatch({ type: "PLACE_ORDER", order }),
    []
  );

  // Addresses — optimistic local change, then persist + reconcile with the
  // authoritative server list (which owns ids + the single-default invariant).
  const addAddress = useCallback((address: Address) => {
    dispatch({ type: "ADD_ADDRESS", address });
    if (!userRef.current?.id) return;
    (async () => {
      const res = await customerApi.addresses.add(storeAddressToPayload(address));
      if (res.ok) dispatch({ type: "SET_ADDRESSES", addresses: res.data.addresses.map(dbAddressToStore) });
    })();
  }, []);

  // Awaitable add — persists to the DB and returns the resulting list so the
  // caller (checkout) can auto-select the freshly-added address by its real id.
  const addAddressAsync = useCallback(
    async (
      address: Omit<Address, "id">,
    ): Promise<{ ok: boolean; addresses: Address[]; message?: string }> => {
      if (userRef.current?.id) {
        // Signed in → must persist to the DB. Report failure (don't silently
        // keep a local-only copy that vanishes on reload).
        const res = await customerApi.addresses.add(storeAddressToPayload(address));
        if (res.ok) {
          const list = res.data.addresses.map(dbAddressToStore);
          dispatch({ type: "SET_ADDRESSES", addresses: list });
          return { ok: true, addresses: list };
        }
        return { ok: false, addresses: stateRef.current.addresses, message: res.message };
      }
      // Guest / not signed in → local-only entry (expected; no account to save to).
      const local: Address = { ...address, id: `addr-${Date.now()}` };
      dispatch({ type: "ADD_ADDRESS", address: local });
      return {
        ok: true,
        addresses: [...stateRef.current.addresses.filter((a) => a.id !== local.id), local],
      };
    },
    [],
  );

  const removeAddress = useCallback((id: string) => {
    dispatch({ type: "REMOVE_ADDRESS", id });
    if (!userRef.current?.id) return;
    (async () => {
      const res = await customerApi.addresses.remove(id);
      if (res.ok) dispatch({ type: "SET_ADDRESSES", addresses: res.data.addresses.map(dbAddressToStore) });
    })();
  }, []);

  const setDefaultAddress = useCallback((id: string) => {
    dispatch({ type: "SET_DEFAULT_ADDRESS", id });
    if (!userRef.current?.id) return;
    (async () => {
      const res = await customerApi.addresses.setDefault(id);
      if (res.ok) dispatch({ type: "SET_ADDRESSES", addresses: res.data.addresses.map(dbAddressToStore) });
    })();
  }, []);
  const viewProduct = useCallback(
    (product: Product) => dispatch({ type: "VIEW_PRODUCT", product }),
    []
  );
  const addReview = useCallback(
    (review: UserReview) => dispatch({ type: "ADD_REVIEW", review }),
    []
  );

  const value = useMemo<CommerceContextValue>(() => {
    const cartCount = state.cart.reduce((n, l) => n + l.qty, 0);
    const cartSubtotal = state.cart.reduce(
      (sum, l) => sum + l.product.price * l.qty,
      0
    );
    const cartMrpTotal = state.cart.reduce(
      (sum, l) => sum + l.product.mrp * l.qty,
      0
    );
    return {
      ...state,
      cartCount,
      cartSubtotal,
      cartMrpTotal,
      wishlistCount: state.wishlist.length,
      addToCart,
      removeFromCart,
      setQty,
      clearCart,
      toggleWishlist,
      removeFromWishlist,
      isInWishlist: (id: string) => state.wishlist.some((p) => p.id === id),
      isInCart: (id: string) => state.cart.some((l) => l.product.id === id),
      cartOpen,
      openCart: () => setCartOpen(true),
      closeCart: () => setCartOpen(false),
      authReady,
      login,
      logout,
      updateProfile,
      placeOrder,
      addAddress,
      addAddressAsync,
      removeAddress,
      setDefaultAddress,
      viewProduct,
      addReview,
      reviewsFor: (productId: string) =>
        state.reviews.filter((r) => r.productId === productId),
    };
  }, [
    state,
    cartOpen,
    authReady,
    addToCart,
    removeFromCart,
    setQty,
    clearCart,
    toggleWishlist,
    removeFromWishlist,
    login,
    logout,
    updateProfile,
    placeOrder,
    addAddress,
    addAddressAsync,
    removeAddress,
    setDefaultAddress,
    viewProduct,
    addReview,
  ]);

  return (
    <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>
  );
}

export function useCommerce(): CommerceContextValue {
  const ctx = useContext(CommerceContext);
  if (!ctx) {
    throw new Error("useCommerce must be used within a CommerceProvider");
  }
  return ctx;
}
