"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, X } from "lucide-react";
import { zodiacSigns } from "@/data/zodiac";
import { ProductCard } from "@/components/ui/product-card";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Dropdown } from "@/components/ui/dropdown";
import { cn, discountPercent } from "@/lib/utils";
import type { Product, ProductCategory, ZodiacSign } from "@/types";

/** Minimal category shape the filter sidebar needs (from the DB). */
type ShopCategory = { slug: string; title: string; id: string; parentId: string | null };

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

  const filterPanel = (
    <div className="space-y-8">
      {/* Offers */}
      <FilterGroup title="Offers">
        <FilterPill active={saleOnly} onClick={() => setSaleOnly((v) => !v)}>
          🔴 On Sale
        </FilterPill>
      </FilterGroup>

      {/* Category (2-level: parents, with children indented under them) */}
      <FilterGroup title="Category">
        <FilterPill active={category === "all"} onClick={() => setCategory("all")}>
          All Jewellery
        </FilterPill>
        {rootCategories.map((parent) => {
          const kids = childrenByParentId.get(parent.id) ?? [];
          return (
            <div key={parent.slug} className="w-full">
              <FilterPill
                active={category === parent.slug}
                onClick={() => setCategory(parent.slug)}
              >
                {parent.title}
              </FilterPill>
              {kids.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 border-l border-foreground/12 pl-3">
                  {kids.map((child) => (
                    <FilterPill
                      key={child.slug}
                      active={category === child.slug}
                      onClick={() => setCategory(child.slug)}
                    >
                      {child.title}
                    </FilterPill>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </FilterGroup>

      {/* Zodiac */}
      <FilterGroup title="Zodiac Sign">
        <FilterPill active={zodiac === "all"} onClick={() => setZodiac("all")}>
          All Signs
        </FilterPill>
        {zodiacSigns.map((z) => (
          <FilterPill
            key={z.sign}
            active={zodiac === z.sign}
            onClick={() => setZodiac(z.sign)}
          >
            <span className="mr-1">{z.symbol}</span>
            {z.name}
          </FilterPill>
        ))}
      </FilterGroup>

      {activeFilters > 0 && (
        <button
          onClick={() => {
            setCategory("all");
            setZodiac("all");
            setSaleOnly(false);
            setSearch("");
          }}
          className="text-sm text-gold-600 hover:text-gold-500"
        >
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
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
          <div className="sticky top-28 rounded-2xl glass p-6">{filterPanel}</div>
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
              className="fixed inset-y-0 left-0 z-50 w-80 max-w-[85%] overflow-y-auto glass-strong p-6 lg:hidden"
            >
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-display text-xl text-foreground">Filters</h3>
                <button onClick={() => setMobileFilters(false)} aria-label="Close">
                  <X size={20} className="text-muted" />
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
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground">
        {title}
      </h4>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
        active
          ? "border-gold-400/60 bg-gold-400/15 text-gold-600"
          : "border-foreground/12 bg-nebula text-muted hover:border-foreground/25 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
