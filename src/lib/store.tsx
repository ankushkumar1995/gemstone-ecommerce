"use client";

/**
 * Client-side commerce store.
 *
 * Backed by localStorage so everything survives reloads and is shared across
 * the app. Covers:
 *   - Cart + Wishlist
 *   - Auth (demo login/signup — no real backend)
 *   - Orders (placed at checkout)
 *   - Saved addresses
 *   - Recently viewed products
 *   - Product reviews written by the user
 *
 * Swap the persistence layer for a real API later without changing components.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import type { Product } from "@/types";

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */
export interface CartLine {
  product: Product;
  qty: number;
}

export interface User {
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
  | { type: "ADD_ADDRESS"; address: Address }
  | { type: "REMOVE_ADDRESS"; id: string }
  | { type: "SET_DEFAULT_ADDRESS"; id: string }
  | { type: "VIEW_PRODUCT"; product: Product }
  | { type: "ADD_REVIEW"; review: UserReview };

const STORAGE_KEY = "nakshatra-commerce-v2";

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
      return { ...state, user: null };

    case "UPDATE_PROFILE":
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.patch } : state.user,
      };

    case "PLACE_ORDER":
      return { ...state, orders: [action.order, ...state.orders] };

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
  login: (user: User) => void;
  logout: () => void;
  updateProfile: (patch: Partial<User>) => void;
  // orders
  placeOrder: (order: Order) => void;
  // addresses
  addAddress: (address: Address) => void;
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "HYDRATE", payload: JSON.parse(raw) });
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
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
  const toggleWishlist = useCallback(
    (product: Product) => dispatch({ type: "TOGGLE_WISHLIST", product }),
    []
  );
  const removeFromWishlist = useCallback(
    (id: string) => dispatch({ type: "REMOVE_FROM_WISHLIST", id }),
    []
  );
  const login = useCallback((user: User) => dispatch({ type: "LOGIN", user }), []);
  const logout = useCallback(() => dispatch({ type: "LOGOUT" }), []);
  const updateProfile = useCallback(
    (patch: Partial<User>) => dispatch({ type: "UPDATE_PROFILE", patch }),
    []
  );
  const placeOrder = useCallback(
    (order: Order) => dispatch({ type: "PLACE_ORDER", order }),
    []
  );
  const addAddress = useCallback(
    (address: Address) => dispatch({ type: "ADD_ADDRESS", address }),
    []
  );
  const removeAddress = useCallback(
    (id: string) => dispatch({ type: "REMOVE_ADDRESS", id }),
    []
  );
  const setDefaultAddress = useCallback(
    (id: string) => dispatch({ type: "SET_DEFAULT_ADDRESS", id }),
    []
  );
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
      login,
      logout,
      updateProfile,
      placeOrder,
      addAddress,
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
