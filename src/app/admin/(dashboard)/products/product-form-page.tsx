"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Save,
  Gem,
  Boxes,
  Image as ImageIcon,
  Sparkles,
  FileText,
  Search as SearchIcon,
  CalendarClock,
  Layers,
  Film,
  Star,
} from "lucide-react";
import type { Product, ProductContentSection, ProductVideo, Collection, Category } from "@/types";
import type { CreateProductDto } from "@/modules/products";
import { adminApi } from "@/lib/admin-api";
import {
  Card,
  AdminButton,
  AdminInput,
  AdminTextarea,
  Field,
  AdminDropdown,
  AdminBreadcrumb,
  Tabs,
  Toggle,
  ImagePickerField,
  useAdminToast,
} from "../../_components";
import { ProductGalleryField } from "./product-gallery-field";
import { TagInput, ContentSections, VideosEditor } from "./product-form-fields";
import { CollectionsSelect, RelatedProductsPicker } from "./product-relations-field";
import { ProductVariantsManager } from "./product-variants-manager";

const BADGES = [
  { value: "", label: "None" },
  { value: "Bestseller", label: "Bestseller" },
  { value: "New", label: "New" },
  { value: "Limited", label: "Limited" },
  { value: "Certified", label: "Certified" },
];
const PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"].map(
  (p) => ({ value: p, label: p })
);

type TabKey = "general" | "variants" | "content" | "media" | "seo" | "organise" | "workflow";

const fade = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

/** convert an ISO string to the value a datetime-local input expects */
function toLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ProductFormPage({ editing }: { editing?: Product | null }) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<TabKey>("general");

  /**
   * The live product record used by the Variants tab. It starts from `editing`
   * and is replaced whenever a variant action returns an updated product, so
   * the server-computed stock rollups are reflected immediately.
   */
  const [liveProduct, setLiveProduct] = useState<Product | null>(editing ?? null);

  /* basics (controlled so values survive tab switches) */
  const [name, setName] = useState(editing?.name ?? "");
  const [shortDescription, setShortDescription] = useState(editing?.shortDescription ?? "");
  const [price, setPrice] = useState<string>(editing ? String(editing.price) : "");
  const [mrp, setMrp] = useState<string>(editing ? String(editing.mrp) : "");
  const [stockQty, setStockQty] = useState<string>(String(editing?.stockQty ?? 0));
  const [sku, setSku] = useState(editing?.sku ?? "");
  const [stone, setStone] = useState(editing?.attributes.stone ?? "");
  const [origin, setOrigin] = useState(editing?.attributes.origin ?? "");
  const [weightCarat, setWeightCarat] = useState<string>(
    editing?.attributes.weightCarat ? String(editing.attributes.weightCarat) : ""
  );
  const [certification, setCertification] = useState(editing?.attributes.certification ?? "");
  const [color, setColor] = useState(editing?.attributes.color ?? "");

  const [images, setImages] = useState<string[]>(
    editing?.images?.length ? editing.images : editing?.image ? [editing.image] : []
  );
  const [imageAlts, setImageAlts] = useState<Record<string, string>>(editing?.imageAlts ?? {});
  const [category, setCategory] = useState<string>(editing?.category ?? "");
  const [badge, setBadge] = useState<string>(editing?.badge ?? "");
  const [planet, setPlanet] = useState<string>(editing?.attributes.planet ?? "Jupiter");
  const [status, setStatus] = useState<string>(editing?.status ?? "active");
  const [tags, setTags] = useState<string[]>(editing?.tags ?? []);

  /* content & media */
  const [content, setContent] = useState<ProductContentSection[]>(editing?.content ?? []);
  const [videos, setVideos] = useState<ProductVideo[]>(editing?.videos ?? []);
  const [certificatePdf, setCertificatePdf] = useState(editing?.certificatePdf ?? "");

  /* seo */
  const [seoTitle, setSeoTitle] = useState(editing?.seo?.metaTitle ?? "");
  const [seoDesc, setSeoDesc] = useState(editing?.seo?.metaDescription ?? "");
  const [seoOg, setSeoOg] = useState(editing?.seo?.ogImage ?? "");
  const [seoKeywords, setSeoKeywords] = useState<string[]>(editing?.seo?.keywords ?? []);
  const [noindex, setNoindex] = useState(editing?.seo?.noindex ?? false);

  /* organisation */
  const [collectionIds, setCollectionIds] = useState<string[]>(editing?.collections ?? []);
  const [related, setRelated] = useState<string[]>(editing?.related ?? []);
  const [featured, setFeatured] = useState(editing?.featured ?? false);

  /* workflow */
  const [publishAt, setPublishAt] = useState(toLocalInput(editing?.publishAt));

  /* fetched data for pickers */
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  useEffect(() => {
    (async () => {
      const [cols, prods, cats] = await Promise.all([
        adminApi.collections.list(),
        adminApi.products.list(),
        adminApi.categories.list(),
      ]);
      if (cols.ok) setAllCollections(cols.data);
      if (prods.ok) setAllProducts(prods.data);
      if (cats.ok) {
        setAllCategories(cats.data);
        // default to the first category when creating a new product
        if (!editing && !category && cats.data[0]) setCategory(cats.data[0].slug);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categoryOptions = useMemo(
    () => allCategories.map((c) => ({ value: c.slug, label: c.title })),
    [allCategories]
  );

  const tagSuggestions = useMemo(() => {
    const set = new Set<string>();
    allProducts.forEach((p) => p.tags?.forEach((t) => set.add(t)));
    return [...set];
  }, [allProducts]);

  const isEdit = Boolean(editing);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!name.trim()) {
      toast("Product name is required", "error");
      setTab("general");
      return;
    }

    if (!category.trim()) {
      toast("Please select a category", "error");
      setTab("general");
      return;
    }

    const qty = Number(stockQty || 0);
    const dto: CreateProductDto = {
      name,
      category: category as CreateProductDto["category"],
      price: Number(price || 0),
      mrp: Number(mrp || price || 0),
      image: images[0] || "",
      images,
      imageAlts,
      shortDescription,
      badge: (badge || undefined) as CreateProductDto["badge"],
      status: status as CreateProductDto["status"],
      stockQty: qty,
      inStock: qty > 0,
      sku,
      tags,
      content: content.map((s) => ({ heading: s.heading, body: s.body, id: s.id?.startsWith("tmp_") ? undefined : s.id })),
      videos: videos
        .filter((v) => v.url.trim())
        .map((v) => ({ url: v.url, kind: v.kind, label: v.label, id: v.id?.startsWith("tmp_") ? undefined : v.id })),
      certificatePdf,
      seo: {
        metaTitle: seoTitle,
        metaDescription: seoDesc,
        ogImage: seoOg,
        keywords: seoKeywords,
        noindex,
      },
      collections: collectionIds,
      related,
      featured,
      publishAt: publishAt ? new Date(publishAt).toISOString() : "",
      attributes: {
        stone,
        planet: planet as Product["attributes"]["planet"],
        origin,
        weightCarat: Number(weightCarat || 0),
        certification,
        color,
      },
    };

    setSaving(true);
    const res = editing
      ? await adminApi.products.update(editing.id, dto)
      : await adminApi.products.create(dto);
    setSaving(false);

    if (res.ok) {
      toast(isEdit ? "Product updated" : "Product created", "success");
      // Let the toast paint before we navigate away. The toast provider lives
      // in the (dashboard) layout so it survives this client navigation and the
      // message stays visible on the products list. (No router.refresh() — it
      // remounts the subtree and would kill the toast; the list reloads itself.)
      setTimeout(() => router.push("/admin/products"), 150);
    } else {
      toast(res.message, "error");
    }
  };

  const tabs: { value: TabKey; label: string }[] = [
    { value: "general", label: "General" },
    { value: "variants", label: "Variants" },
    { value: "content", label: "Content" },
    { value: "media", label: "Media" },
    { value: "seo", label: "SEO" },
    { value: "organise", label: "Organise" },
    { value: "workflow", label: "Workflow" },
  ];

  return (
    <form onSubmit={handleSubmit}>
      <AdminBreadcrumb
        items={[{ label: "Products", href: "/admin/products" }, { label: isEdit ? "Edit" : "New" }]}
      />
      <div className="mt-3 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/admin/products")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-black/[0.04]"
            style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--a-fg)" }}>
              {isEdit ? "Edit Product" : "Add Product"}
            </h1>
            <p className="text-sm" style={{ color: "var(--a-muted)" }}>
              {isEdit ? editing?.name : "Create a new gemstone listing"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <AdminButton type="button" variant="outline" onClick={() => router.push("/admin/products")}>
            Cancel
          </AdminButton>
          <AdminButton type="submit" disabled={saving}>
            <Save size={16} /> {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Product"}
          </AdminButton>
        </div>
      </div>

      {/* tabs */}
      <div className="mb-5 overflow-x-auto">
        <Tabs tabs={tabs} value={tab} onChange={(v) => setTab(v)} />
      </div>

      <motion.div key={tab} variants={fade} initial="hidden" animate="show" transition={{ duration: 0.3 }}>
        {tab === "general" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <div className="space-y-6">
              <Card>
                <SectionTitle icon={Gem} title="Basic details" />
                <div className="mt-4 space-y-4">
                  <Field label="Product name" required>
                    <AdminInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Natural Ruby (Manik)" />
                  </Field>
                  <Field label="Short description">
                    <AdminTextarea
                      value={shortDescription}
                      onChange={(e) => setShortDescription(e.target.value)}
                      rows={3}
                      placeholder="A fiery natural ruby — the stone of the Sun…"
                    />
                  </Field>
                </div>
              </Card>

              <Card>
                <SectionTitle icon={Sparkles} title="Gemstone attributes" />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Stone">
                    <AdminInput value={stone} onChange={(e) => setStone(e.target.value)} placeholder="Natural Ruby (Manik)" />
                  </Field>
                  <Field label="Ruling planet">
                    <AdminDropdown value={planet} options={PLANETS} onChange={setPlanet} className="w-full" />
                  </Field>
                  <Field label="Origin">
                    <AdminInput value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Burma" />
                  </Field>
                  <Field label="Weight (carat)">
                    <AdminInput value={weightCarat} onChange={(e) => setWeightCarat(e.target.value)} type="number" step="0.01" placeholder="5.25" />
                  </Field>
                  <Field label="Certification">
                    <AdminInput value={certification} onChange={(e) => setCertification(e.target.value)} placeholder="IGI Certified" />
                  </Field>
                  <Field label="Colour">
                    <AdminInput value={color} onChange={(e) => setColor(e.target.value)} placeholder="Pigeon Blood Red" />
                  </Field>
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <SectionTitle icon={Boxes} title="Category" />
                <div className="mt-4 space-y-4">
                  <Field label="Category" required hint="Which catalogue category this product belongs to">
                    <AdminDropdown
                      value={category}
                      options={categoryOptions}
                      onChange={setCategory}
                      placeholder={categoryOptions.length ? "Select category" : "No categories yet"}
                      className="w-full"
                    />
                  </Field>
                </div>
              </Card>
              <Card>
                <SectionTitle icon={Gem} title="Pricing" />
                <div className="mt-4 space-y-4">
                  <Field label="Price (₹)" required>
                    <AdminInput value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder="0" />
                  </Field>
                  <Field label="MRP (₹)" hint="Shown struck-through for discount">
                    <AdminInput value={mrp} onChange={(e) => setMrp(e.target.value)} type="number" placeholder="0" />
                  </Field>
                </div>
              </Card>
              <Card>
                <SectionTitle icon={Boxes} title="Inventory" />
                <div className="mt-4 space-y-4">
                  <Field label="Stock quantity" hint="0 = out of stock">
                    <AdminInput value={stockQty} onChange={(e) => setStockQty(e.target.value)} type="number" min={0} placeholder="0" />
                  </Field>
                  <Field label="SKU" hint="Stock keeping unit (optional)">
                    <AdminInput value={sku} onChange={(e) => setSku(e.target.value)} placeholder="NK-RUBY-001" />
                  </Field>
                </div>
              </Card>
            </div>
          </div>
        )}

        {tab === "variants" && (
          <Card>
            <SectionTitle icon={Boxes} title="Variants" />
            <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>
              Size / metal / carat variations with their own SKU, price and stock.
              Product-level stock rolls up from these automatically.
            </p>
            <div className="mt-4">
              {liveProduct ? (
                <ProductVariantsManager product={liveProduct} onProductChange={setLiveProduct} />
              ) : (
                <div
                  className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center"
                  style={{ borderColor: "var(--a-border)" }}
                >
                  <Boxes size={26} style={{ color: "var(--a-faint)" }} />
                  <p className="mt-2 text-sm font-medium" style={{ color: "var(--a-fg)" }}>
                    Save the product first
                  </p>
                  <p className="text-xs" style={{ color: "var(--a-faint)" }}>
                    Variants are managed per product. Create this product, then add variants here.
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}

        {tab === "content" && (
          <Card>
            <SectionTitle icon={FileText} title="Rich content sections" />
            <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>
              These appear as tabs on the storefront product page (Details, Benefits, Certification…).
            </p>
            <div className="mt-4">
              <ContentSections sections={content} onChange={setContent} />
            </div>
          </Card>
        )}

        {tab === "media" && (
          <div className="space-y-6">
            <Card>
              <SectionTitle icon={ImageIcon} title="Gallery" />
              <div className="mt-4">
                <ProductGalleryField
                  images={images}
                  onChange={setImages}
                  alts={imageAlts}
                  onAltsChange={setImageAlts}
                />
              </div>
            </Card>
            <Card>
              <SectionTitle icon={Film} title="Video & 360° spin" />
              <div className="mt-4">
                <VideosEditor videos={videos} onChange={setVideos} />
              </div>
            </Card>
            <Card>
              <SectionTitle icon={FileText} title="Lab certificate (PDF)" />
              <div className="mt-4">
                <Field label="Certificate PDF URL" hint="Link to the gem's lab certification document">
                  <AdminInput
                    value={certificatePdf}
                    onChange={(e) => setCertificatePdf(e.target.value)}
                    placeholder="https://…/certificate.pdf"
                  />
                </Field>
              </div>
            </Card>
          </div>
        )}

        {tab === "seo" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <Card>
              <SectionTitle icon={SearchIcon} title="Search engine optimisation" />
              <div className="mt-4 space-y-4">
                <Field label="Meta title" hint={`${seoTitle.length}/70 characters`}>
                  <AdminInput value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={70} placeholder="Natural Ruby (Manik) — Certified | Astrounkle" />
                </Field>
                <Field label="Meta description" hint={`${seoDesc.length}/180 characters`}>
                  <AdminTextarea value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} maxLength={180} rows={3} placeholder="Buy certified natural ruby…" />
                </Field>
                <Field label="OG / social image" hint="Shown when the product is shared on social media">
                  <ImagePickerField value={seoOg} onChange={setSeoOg} />
                </Field>
                <Field label="Focus keywords">
                  <TagInput tags={seoKeywords} onChange={setSeoKeywords} placeholder="Add keyword + Enter" />
                </Field>
                <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>No-index</p>
                    <p className="text-xs" style={{ color: "var(--a-faint)" }}>Hide this product from search engines</p>
                  </div>
                  <Toggle checked={noindex} onChange={setNoindex} />
                </div>
              </div>
            </Card>

            {/* google preview */}
            <Card>
              <SectionTitle icon={SearchIcon} title="Search preview" />
              <div className="mt-4 rounded-lg border p-4" style={{ borderColor: "var(--a-border)", background: "var(--a-surface-2)" }}>
                <p className="truncate text-xs" style={{ color: "var(--a-muted)" }}>
                  astrounkle.com › product › {editing?.slug ?? "new-gemstone"}
                </p>
                <p className="mt-1 truncate text-base font-medium text-[#1a0dab]">
                  {seoTitle || editing?.name || "Product title"}
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm" style={{ color: "var(--a-muted)" }}>
                  {seoDesc || editing?.shortDescription || "Your meta description preview appears here."}
                </p>
              </div>
            </Card>
          </div>
        )}

        {tab === "organise" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <div className="space-y-6">
              <Card>
                <SectionTitle icon={Layers} title="Collections" />
                <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>
                  Dynamic storefront groupings this product belongs to.
                </p>
                <div className="mt-4">
                  <CollectionsSelect all={allCollections} selected={collectionIds} onChange={setCollectionIds} />
                </div>
              </Card>
              <Card>
                <SectionTitle icon={Gem} title="Related products" />
                <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>
                  Shown as &ldquo;Frequently bought with&rdquo; on the product page.
                </p>
                <div className="mt-4">
                  <RelatedProductsPicker all={allProducts} selected={related} onChange={setRelated} currentId={editing?.id} />
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <SectionTitle icon={Boxes} title="Badges & Tags" />
                <div className="mt-4 space-y-4">
                  <Field label="Category" hint="Managed in the General tab">
                    <div
                      className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm"
                      style={{ borderColor: "var(--a-border)", color: category ? "var(--a-fg)" : "var(--a-faint)" }}
                    >
                      <span>
                        {category
                          ? categoryOptions.find((c) => c.value === category)?.label ?? category
                          : "Not set — choose in General"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTab("general")}
                        className="text-xs font-medium text-[var(--a-gold)] hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                  </Field>
                  <Field label="Badge">
                    <AdminDropdown value={badge} options={BADGES} onChange={setBadge} className="w-full" />
                  </Field>
                  <Field label="Tags">
                    <TagInput tags={tags} onChange={setTags} suggestions={tagSuggestions} />
                  </Field>
                </div>
              </Card>
              <Card>
                <SectionTitle icon={Star} title="Visibility" />
                <div className="mt-4 flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>Featured</p>
                    <p className="text-xs" style={{ color: "var(--a-faint)" }}>Pin to the homepage</p>
                  </div>
                  <Toggle checked={featured} onChange={setFeatured} />
                </div>
              </Card>
            </div>
          </div>
        )}

        {tab === "workflow" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <SectionTitle icon={Layers} title="Publishing status" />
              <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>
                Move the product through its lifecycle: Draft → Review → Active.
              </p>
              <div className="mt-4 space-y-3">
                {[
                  { value: "draft", label: "Draft", desc: "Hidden — work in progress" },
                  { value: "review", label: "In review", desc: "Submitted, awaiting approval" },
                  { value: "active", label: "Active", desc: "Live on the storefront" },
                  { value: "archived", label: "Archived", desc: "Retired, hidden from store" },
                ].map((s) => {
                  const on = status === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setStatus(s.value)}
                      className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
                      style={{
                        borderColor: on ? "var(--a-gold)" : "var(--a-border)",
                        background: on ? "var(--a-gold-soft)" : "transparent",
                      }}
                    >
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full border"
                        style={{ borderColor: on ? "var(--a-gold)" : "var(--a-border-strong)" }}
                      >
                        {on && <span className="h-2.5 w-2.5 rounded-full bg-[var(--a-gold)]" />}
                      </span>
                      <div>
                        <p className="text-sm font-medium" style={{ color: on ? "var(--a-gold)" : "var(--a-fg)" }}>
                          {s.label}
                        </p>
                        <p className="text-xs" style={{ color: "var(--a-faint)" }}>{s.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>

            <Card>
              <SectionTitle icon={CalendarClock} title="Scheduled publish" />
              <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>
                Set a future date & time. While in Draft/Review, the product goes
                Active automatically once this time passes.
              </p>
              <div className="mt-4 space-y-3">
                <Field label="Publish at">
                  <input
                    type="datetime-local"
                    value={publishAt}
                    onChange={(e) => setPublishAt(e.target.value)}
                    className="w-full rounded-lg border bg-transparent px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--a-gold)]"
                    style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
                  />
                </Field>
                {publishAt && (
                  <button
                    type="button"
                    onClick={() => setPublishAt("")}
                    className="text-xs font-medium text-rose-600 hover:underline"
                  >
                    Clear schedule
                  </button>
                )}
              </div>
            </Card>
          </div>
        )}
      </motion.div>

      {/* sticky mobile save bar */}
      <div
        className="sticky bottom-0 mt-6 flex gap-2 border-t py-3 backdrop-blur-xl lg:hidden"
        style={{ borderColor: "var(--a-border)", background: "color-mix(in srgb, var(--a-bg) 85%, transparent)" }}
      >
        <AdminButton type="button" variant="outline" className="flex-1" onClick={() => router.push("/admin/products")}>
          Cancel
        </AdminButton>
        <AdminButton type="submit" className="flex-1" disabled={saving}>
          <Save size={16} /> {saving ? "Saving…" : "Save"}
        </AdminButton>
      </div>
    </form>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ background: "var(--a-surface-2)", color: "var(--a-gold)" }}
      >
        <Icon size={16} />
      </span>
      <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>
        {title}
      </h2>
    </div>
  );
}
