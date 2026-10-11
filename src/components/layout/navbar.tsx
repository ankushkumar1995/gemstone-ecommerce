"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ShoppingBag,
  Heart,
  User,
  Menu,
  X,
  Gem,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Container } from "@/components/ui/container";
import { MegaMenu } from "@/components/layout/mega-menu";
import { SearchOverlay } from "@/components/layout/search-overlay";
import { CurrencySelector } from "@/components/layout/currency-selector";
import { categories } from "@/data/categories";
import { useCommerce } from "@/lib/store";

type NavLink = { label: string; href: string; mega?: boolean; accent?: boolean };

const navLinks: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Shop All", href: "/shop", mega: true },
  { label: "Services", href: "/services" },
  { label: "Blog", href: "/blog" },
  { label: "Sale", href: "/shop?sale=true", accent: true },
  { label: "Contact", href: "/contact" },
];

export function Navbar() {
  const [elevated, setElevated] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [mobileShopOpen, setMobileShopOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { cartCount, wishlistCount, openCart } = useCommerce();

  useEffect(() => {
    const onScroll = () => setElevated(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Open instantly, close with a small grace delay so the pointer can travel
  // from the trigger into the panel without it snapping shut.
  const openMega = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMegaOpen(true);
  };
  const scheduleCloseMega = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMegaOpen(false), 140);
  };

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "sticky top-0 z-40 border-b bg-cosmos/95 backdrop-blur-xl transition-all duration-300",
        elevated
          ? "border-foreground/10 shadow-[0_10px_30px_-16px_rgba(36,26,59,0.45)]"
          : "border-transparent"
      )}
    >
      <Container className="flex items-center justify-between gap-6 py-4">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2">
          <motion.span
            whileHover={{ rotate: 20, scale: 1.1 }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-gold-400 to-royal-600 text-white shadow-lg"
          >
            <Gem size={18} />
          </motion.span>
          <span className="font-display text-2xl font-semibold tracking-wide text-gradient-gold">
            Nakshatra
          </span>
        </Link>

        {/* Desktop links */}
        <ul className="hidden items-center gap-7 lg:flex">
          {navLinks.map((link) =>
            link.mega ? (
              <li
                key={link.href}
                className="static"
                onMouseEnter={openMega}
                onMouseLeave={scheduleCloseMega}
              >
                <Link
                  href={link.href}
                  className={cn(
                    "group relative flex items-center gap-1 text-sm font-medium transition-colors hover:text-gold-500",
                    megaOpen ? "text-gold-500" : "text-foreground/85"
                  )}
                >
                  {link.label}
                  <ChevronDown
                    size={14}
                    className={cn(
                      "transition-transform duration-300",
                      megaOpen && "rotate-180"
                    )}
                  />
                  <span
                    className={cn(
                      "absolute -bottom-1 left-0 h-px bg-gradient-to-r from-gold-300 to-royal-400 transition-all duration-300",
                      megaOpen ? "w-full" : "w-0 group-hover:w-full"
                    )}
                  />
                </Link>
              </li>
            ) : (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "group relative text-sm font-medium transition-colors",
                    link.accent
                      ? "text-rose-mystic hover:text-rose-mystic/80"
                      : "text-foreground/85 hover:text-gold-500"
                  )}
                >
                  {link.accent && (
                    <span className="mr-1 inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-rose-mystic align-middle" />
                  )}
                  {link.label}
                  <span
                    className={cn(
                      "absolute -bottom-1 left-0 h-px w-0 transition-all duration-300 group-hover:w-full",
                      link.accent
                        ? "bg-rose-mystic"
                        : "bg-gradient-to-r from-gold-300 to-royal-400"
                    )}
                  />
                </Link>
              </li>
            )
          )}
        </ul>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <CurrencySelector className="hidden sm:block" />
          <IconButton label="Search" onClick={() => setSearchOpen(true)}>
            <Search size={18} />
          </IconButton>
          <IconButton label="Account" href="/account" className="hidden sm:flex">
            <User size={18} />
          </IconButton>
          <IconButton
            label="Wishlist"
            href="/wishlist"
            badge={wishlistCount || undefined}
            className="hidden sm:flex"
          >
            <Heart size={18} />
          </IconButton>
          <IconButton
            label="Cart"
            onClick={openCart}
            badge={cartCount || undefined}
          >
            <ShoppingBag size={18} />
          </IconButton>
          <button
            aria-label="Menu"
            onClick={() => setMobileOpen((v) => !v)}
            className="ml-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors hover:bg-foreground/10 lg:hidden"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </Container>

      {/* Search overlay */}
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Desktop mega menu */}
      <AnimatePresence>
        {megaOpen && (
          <div
            className="absolute inset-x-0 top-full hidden justify-center px-4 lg:flex"
            onMouseEnter={openMega}
            onMouseLeave={scheduleCloseMega}
          >
            {/* panel sits flush against the navbar bottom — no gap */}
            <MegaMenu onNavigate={() => setMegaOpen(false)} />
          </div>
        )}
      </AnimatePresence>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden glass-strong lg:hidden"
          >
            <ul className="flex flex-col gap-1 px-4 py-4">
              {navLinks.map((link) =>
                link.mega ? (
                  <li key={link.href}>
                    <div className="flex items-center">
                      <Link
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className="flex-1 rounded-xl px-4 py-3 text-sm font-medium text-foreground/90 transition-colors hover:bg-foreground/5 hover:text-gold-600"
                      >
                        {link.label}
                      </Link>
                      <button
                        aria-label="Toggle categories"
                        aria-expanded={mobileShopOpen}
                        onClick={() => setMobileShopOpen((v) => !v)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-foreground/70 transition-colors hover:bg-foreground/5"
                      >
                        <ChevronDown
                          size={18}
                          className={cn(
                            "transition-transform duration-300",
                            mobileShopOpen && "rotate-180"
                          )}
                        />
                      </button>
                    </div>
                    <AnimatePresence initial={false}>
                      {mobileShopOpen && (
                        <motion.ul
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden pl-4"
                        >
                          {categories.map((cat) => (
                            <li key={cat.slug}>
                              <Link
                                href={`/shop?category=${cat.slug}`}
                                onClick={() => setMobileOpen(false)}
                                className="block rounded-xl px-4 py-2.5 text-sm text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-gold-600"
                              >
                                {cat.title}
                              </Link>
                            </li>
                          ))}
                        </motion.ul>
                      )}
                    </AnimatePresence>
                  </li>
                ) : (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "block rounded-xl px-4 py-3 text-sm font-medium transition-colors hover:bg-foreground/5",
                        link.accent
                          ? "text-rose-mystic"
                          : "text-foreground/90 hover:text-gold-600"
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                )
              )}

              {/* currency selector on mobile */}
              <li className="mt-2 flex items-center justify-between gap-2 border-t border-foreground/10 px-4 pt-3">
                <span className="text-sm text-muted">Currency</span>
                <CurrencySelector />
              </li>

              {/* account / wishlist quick links on mobile */}
              <li className="mt-2 flex gap-2 pt-1">
                <Link
                  href="/account"
                  onClick={() => setMobileOpen(false)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-foreground/5 px-4 py-2.5 text-sm font-medium text-foreground"
                >
                  <User size={16} /> Account
                </Link>
                <Link
                  href="/wishlist"
                  onClick={() => setMobileOpen(false)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-foreground/5 px-4 py-2.5 text-sm font-medium text-foreground"
                >
                  <Heart size={16} /> Wishlist
                  {wishlistCount > 0 && (
                    <span className="rounded-full bg-gold-400 px-1.5 text-xs text-white">
                      {wishlistCount}
                    </span>
                  )}
                </Link>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

function IconButton({
  children,
  label,
  badge,
  className,
  href,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  badge?: number;
  className?: string;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      {children}
      {badge !== undefined && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-gold-400 to-gold-500 px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </>
  );

  const classes = cn(
    "relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-foreground/90 transition-colors hover:bg-foreground/10 hover:text-gold-500",
    className
  );

  if (href) {
    return (
      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
        <Link href={href} aria-label={label} className={classes}>
          {inner}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      aria-label={label}
      onClick={onClick}
      className={classes}
    >
      {inner}
    </motion.button>
  );
}
