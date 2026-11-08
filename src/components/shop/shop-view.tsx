"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, X, Tag, ChevronDown, Check } from "lucide-react";
import { zodiacSigns } from "@/data/zodiac";
import { ProductCard } from "@/components/ui/product-card";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Dropdown } from "@/components/ui/dropdown";
import { cn, discountPercent } from "@/lib/utils";
import type { Product, ProductCategory, ZodiacSign } from "@/types";

/** Minimal category shape the filter sidebar needs (from the DB). */
type ShopCategory = { slug: string; title: string; id: string; parentId: string | null };

/** Top-level categories shown before "more" (keeps the sidebar short, no inner scroll). */
const CAT_PREVIEW = 6;
/** Zodiac tiles shown before "more" (two rows of three). */
const SIGN_PREVIEW = 6;

type SortKey = "featured" | "price-asc" | "price-desc" | "rating";

const sortOptions: { key: SortKey; label: string }[] = [
  { key: "featured", label: "Featured" },
  { key: "price-asc", label: "Price: Low to High" },
  { key: "price-desc", label: "Price: High to Low" },
  { key: "rating", label: "Top Rated" },
];

export function ShopView({
  products,
  categories,
  initialCategory,
  initialZodiac,
  initialSale = false,
  initialSearch = "",
}: {
  products: Product[];
  categories: ShopCategory[];
  initialCategory?: ProductCategory;
  initialZodiac?: ZodiacSign;
  initialSale?: boolean;
  initialSearch?: string;
}) {
  const [category, setCategory] = useState<string>(initialCategory ?? "all");
  const [zodiac, setZodiac] = useState<ZodiacSign | "all">(
    initialZodiac ?? "all"
  );
  const [saleOnly, setSaleOnly] = useState(initialSale);
  const [search, setSearch] = useState(initialSearch);
  const [sort, setSort] = useState<SortKey>("featured");
  const [mobileFilters, setMobileFilters] = useState(false);
  const [showAllCats, setShowAllCats] = useState(false);
  const [showAllSigns, setShowAllSigns] = useState(false);

  // --- Hierarchy helpers (2-level) -----------------------------------------
  const bySlug = useMemo(() => {
    const m = new Map<string, ShopCategory>();
    for (const c of categories) m.set(c.slug, c);
    return m;
  }, [categories]);

  const childrenByParentId = useMemo(() => {
    const m = new Map<string, ShopCategory[]>();
    for (const c of categories) {
      if (c.parentId) {
        const list = m.get(c.parentId) ?? [];
        list.push(c);
        m.set(c.parentId, list);
      }
    }
    return m;
  }, [categories]);

  const rootCategories = useMemo(
    () => categories.filter((c) => !c.parentId),
    [categories],
  );

  // The set of category slugs a selection matches: the slug itself plus, if the
  // selected category is a top-level parent, all of its children's slugs. This
  // is what makes selecting a parent show the whole subtree's products.
  const selectedSlugs = useMemo(() => {
    if (category === "all") return null;
    const self = bySlug.get(category);
    const slugs = new Set<string>([category]);
    if (self && !self.parentId) {
      for (const child of childrenByParentId.get(self.id) ?? []) slugs.add(child.slug);
    }
    return slugs;
  }, [category, bySlug, childrenByParentId]);

  // Product counts per category slug (a parent also counts its children).
  const countBySlug = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return m;
  }, [products]);
  const countFor = (c: ShopCategory) => {
    let n = countBySlug.get(c.slug) ?? 0;
    if (!c.parentId) for (const k of childrenByParentId.get(c.id) ?? []) n += countBySlug.get(k.slug) ?? 0;
    return n;
  };
  const saleCount = useMemo(
    () => products.filter((p) => discountPercent(p.mrp, p.price) > 0).length,
    [products],
  );

  const filtered = useMemo(() => {
    let list = [...products];
    if (selectedSlugs) list = list.filter((p) => selectedSlugs.has(p.category));
    if (zodiac !== "all") list = list.filter((p) => p.zodiac.includes(zodiac));
    if (saleOnly)
      list = list.filter((p) => discountPercent(p.mrp, p.price) > 0);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const hay = [
          p.name,
          p.shortDescription,
          p.category,
          ...(p.tags ?? []),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    switch (sort) {
      case "price-asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        list.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        list.sort((a, b) => b.rating - a.rating);
        break;
    }
    return list;
  }, [products, selectedSlugs, zodiac, saleOnly, search, sort]);

  // Breadcrumb: Shop › [Parent ›] Selected
  const breadcrumbItems = useMemo(() => {
    const items: { label: string; href?: string }[] = [{ label: "Shop", href: "/shop" }];
    if (category === "all") {
      items[0] = { label: "Shop" };
      return items;
    }
    const self = bySlug.get(category);
    if (!self) return [{ label: "Shop" }];
    if (self.parentId) {
      const parent = categories.find((c) => c.id === self.parentId);
      if (parent) items.push({ label: parent.title, href: `/shop?category=${parent.slug}` });
    }
    items.push({ label: self.title });
    return items;
  }, [category, bySlug, categories]);

  const activeFilters =
    (category !== "all" ? 1 : 0) +
    (zodiac !== "all" ? 1 : 0) +
    (saleOnly ? 1 : 0) +
    (search.trim() ? 1 : 0);

  const clearAll = () => {
    setCategory("all");
    setZodiac("all");
    setSaleOnly(false);
    setSearch("");
  };

  // Long category lists stay compact: first few, then "Show all".
  // The selected category (or the parent of a selected sub-category) always
  // stays visible, even when it sits beyond the preview.
  const selectedRootSlug = (() => {
    const self = bySlug.get(category);
    if (!self) return null;
    if (!self.parentId) return self.slug;
    return categories.find((c) => c.id === self.parentId)?.slug ?? null;
  })();
  const visibleRoots = showAllCats
    ? rootCategories
    : rootCategories.filter(
        (c, i) => i < CAT_PREVIEW || c.slug === selectedRootSlug,
      );
  const hiddenCount = rootCategories.length - visibleRoots.length;

  // Same idea for zodiac: a short preview, the active sign always shown.
  const visibleSigns = showAllSigns
    ? zodiacSigns
    : zodiacSigns.filter((z, i) => i < SIGN_PREVIEW || z.sign === zodiac);

  const filterPanel = (
    <div>
      {/* panel header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <SlidersHorizontal size={15} className="text-gold-600" />
          Filters
          {activeFilters > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-400 px-1.5 text-[11px] font-bold text-white">
              {activeFilters}
            </span>
          )}
        </h3>
        {activeFilters > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-semibold text-gold-600 transition-colors hover:text-gold-500"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Offers: a single switch instead of a lone pill */}
      <button
        type="button"
        role="switch"
        aria-checked={saleOnly}
        onClick={() => setSaleOnly((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between rounded-2xl border px-3.5 py-2.5 text-left transition-colors",
          saleOnly ? "border-gold-400/50 bg-gold-400/10" : "border-foreground/10 hover:border-foreground/20"
        )}
      >
        <span className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
            <Tag size={14} />
          </span>
          <span>
            <span className="block text-[13px] font-semibold text-foreground">On sale</span>
            <span className="block text-[11px] text-muted">{saleCount} discounted</span>
          </span>
        </span>
        <span
          aria-hidden
          className={cn(
            "relative h-5 w-9 shrink-0 rounded-full transition-colors",
            saleOnly ? "bg-gold-500" : "bg-foreground/15"
          )}
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 500, damping: 32 }}
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow",
              saleOnly ? "right-0.5" : "left-0.5"
            )}
          />
        </span>
      </button>

      {/* Category (2-level: parents, children indented under them) */}
      <FilterGroup title="Category">
        <ul className="space-y-0.5">
          <li>
            <CategoryRow
              label="All products"
              count={products.length}
              active={category === "all"}
              onClick={() => setCategory("all")}
            />
          </li>
          {visibleRoots.map((parent) => {
            const kids = childrenByParentId.get(parent.id) ?? [];
            const open =
              category === parent.slug || kids.some((k) => k.slug === category);
            return (
              <li key={parent.slug}>
                <CategoryRow
                  label={parent.title}
                  count={countFor(parent)}
                  active={category === parent.slug}
                  onClick={() => setCategory(parent.slug)}
                />
                {kids.length > 0 && open && (
                  <ul className="mb-1 ml-4 mt-0.5 space-y-0.5 border-l border-foreground/10 pl-2">
                    {kids.map((child) => (
                      <li key={child.slug}>
                        <CategoryRow
                          label={child.title}
                          count={countFor(child)}
                          active={category === child.slug}
                          onClick={() => setCategory(child.slug)}
                          small
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        {(showAllCats || hiddenCount > 0) && (
          <MoreToggle
            open={showAllCats}
            hidden={hiddenCount}
            onClick={() => setShowAllCats((v) => !v)}
          />
        )}
      </FilterGroup>

      {/* Zodiac: compact 3-column tiles */}
      <FilterGroup
        title="Zodiac sign"
        action={
          zodiac !== "all" ? (
            <button
              type="button"
              onClick={() => setZodiac("all")}
              className="text-[11px] font-semibold normal-case tracking-normal text-gold-600 hover:text-gold-500"
            >
              Reset
            </button>
          ) : null
        }
      >
        <div className="grid grid-cols-3 gap-1.5">
          {visibleSigns.map((z) => {
            const active = zodiac === z.sign;
            return (
              <button
                key={z.sign}
                type="button"
                aria-pressed={active}
                onClick={() => setZodiac(active ? "all" : z.sign)}
                className={cn(
                  "flex flex-col items-center rounded-xl border px-1 py-2 transition-all duration-200",
                  active
                    ? "border-gold-400/60 bg-gold-400/12 text-gold-600 shadow-[0_6px_16px_-10px_rgba(201,148,42,0.8)]"
                    : "border-foreground/10 text-foreground/70 hover:-translate-y-0.5 hover:border-gold-400/40 hover:text-gold-600"
                )}
              >
                <span className="text-base leading-none">{z.symbol}</span>
                <span className="mt-1 text-[10.5px] font-medium leading-none">{z.name}</span>
              </button>
            );
          })}
        </div>
        {(showAllSigns || zodiacSigns.length > visibleSigns.length) && (
          <MoreToggle
            open={showAllSigns}
            hidden={zodiacSigns.length - visibleSigns.length}
            onClick={() => setShowAllSigns((v) => !v)}
          />
        )}
      </FilterGroup>
    </div>
  );

  return (
    <div className="mx-auto max-w-[90rem] px-5 py-10 sm:px-8">
      <Breadcrumb items={breadcrumbItems} className="mb-6" />
      {/* header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-600">
          The Collection
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-foreground sm:text-5xl">
          Explore Our <span className="text-gradient-gold">Gemstones</span>
        </h1>
        {search.trim() && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-400/10 px-4 py-1.5 text-sm text-foreground">
            Showing results for
            <span className="font-semibold text-gold-600">&ldquo;{search.trim()}&rdquo;</span>
            <button
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="ml-1 rounded-full p-0.5 text-muted transition-colors hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>

      {/* toolbar */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <button
          onClick={() => setMobileFilters(true)}
          className="flex items-center gap-2 rounded-full border border-foreground/15 bg-nebula px-4 py-2.5 text-sm font-medium text-foreground lg:hidden"
        >
          <SlidersHorizontal size={16} />
          Filters
          {activeFilters > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gold-400 text-xs text-white">
              {activeFilters}
            </span>
          )}
        </button>
        <p className="hidden text-sm text-muted lg:block">
          Showing <span className="text-foreground">{filtered.length}</span> gemstones
        </p>
        <Dropdown<SortKey>
          label="Sort by"
          value={sort}
          onChange={setSort}
          options={sortOptions.map((o) => ({ value: o.key, label: o.label }))}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        {/* desktop sidebar */}
        <aside className="hidden lg:block">
          {/* full height, no inner scrollbar: long lists collapse behind "more" */}
          <div className="rounded-3xl border border-foreground/10 bg-white p-4 shadow-[0_18px_50px_-34px_rgba(36,26,59,0.45)]">
            {filterPanel}
          </div>
        </aside>

        {/* grid */}
        <div>
          {filtered.length === 0 ? (
            <div className="flex h-80 flex-col items-center justify-center rounded-2xl glass text-center">
              <p className="font-display text-2xl text-foreground">No gems found</p>
              <p className="mt-2 text-muted">Try adjusting your filters.</p>
            </div>
          ) : (
            <motion.div
              layout
              className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3"
            >
              <AnimatePresence mode="popLayout">
                {filtered.map((product, i) => (
                  <motion.div key={product.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                    <ProductCard product={product} index={i} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>

      {/* mobile filter drawer */}
      <AnimatePresence>
        {mobileFilters && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileFilters(false)}
              className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed inset-y-0 left-0 z-50 w-80 max-w-[85%] overflow-y-auto bg-white p-5 shadow-2xl lg:hidden"
            >
              <div className="mb-2 flex justify-end">
                <button
                  onClick={() => setMobileFilters(false)}
                  aria-label="Close filters"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-foreground/5 hover:text-foreground"
                >
                  <X size={18} />
                </button>
              </div>
              {filterPanel}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterGroup({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 border-t border-foreground/10 pt-4">
      <div className="mb-2.5 flex items-center justify-between px-1">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{title}</h4>
        {action}
      </div>
      {children}
    </div>
  );
}

/** "+N more" / "Show less" toggle under a collapsed list. */
function MoreToggle({
  open,
  hidden,
  onClick,
}: {
  open: boolean;
  hidden: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-gold-600 transition-colors hover:bg-gold-400/10 hover:text-gold-500"
    >
      {open ? "Show less" : `+${hidden} more`}
      <ChevronDown size={13} className={cn("transition-transform duration-300", open && "rotate-180")} />
    </button>
  );
}

/** One compact, radio-like category row with a product count. */
function CategoryRow({
  label,
  count,
  active,
  onClick,
  small = false,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-xl px-2.5 text-left transition-colors",
        small ? "py-1.5" : "py-2",
        active ? "bg-gold-400/12" : "hover:bg-foreground/[0.04]"
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border transition-colors",
          small ? "h-3.5 w-3.5" : "h-4 w-4",
          active
            ? "border-gold-500 bg-gold-500 text-white"
            : "border-foreground/25 group-hover:border-gold-400"
        )}
      >
        {active && <Check size={small ? 9 : 10} strokeWidth={3} />}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          small ? "text-[12.5px]" : "text-[13px]",
          active ? "font-semibold text-gold-600" : "text-foreground/80 group-hover:text-foreground"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "shrink-0 rounded-full px-1.5 py-px text-[10.5px] font-semibold tabular-nums",
          active ? "bg-gold-400 text-white" : "bg-foreground/[0.06] text-muted"
        )}
      >
        {count}
      </span>
    </button>
  );
}
