"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Save, FileText, Search as SearchIcon, Image as ImageIcon, Settings2, X } from "lucide-react";
import type { Article } from "@/types";
import type { CreateArticleDto } from "@/modules/blog";

/** Convert legacy block body → HTML so old articles open in the rich editor. */
function blocksToHtml(a?: Article | null): string {
  if (!a) return "";
  if (a.content) return a.content;
  return (a.body ?? [])
    .map((b) => {
      if (b.type === "h2") return `<h2>${escapeHtml(b.text ?? "")}</h2>`;
      if (b.type === "quote") return `<blockquote>${escapeHtml(b.text ?? "")}</blockquote>`;
      if (b.type === "list")
        return `<ul>${(b.items ?? []).map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
      return `<p>${escapeHtml(b.text ?? "")}</p>`;
    })
    .join("");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
import { adminApi } from "@/lib/admin-api";
import {
  Card,
  AdminButton,
  AdminInput,
  AdminTextarea,
  AdminDropdown,
  Field,
  Tabs,
  Toggle,
  AdminBreadcrumb,
  ImagePickerField,
  RichTextEditor,
  useAdminToast,
} from "../../_components";

type TabKey = "content" | "media" | "seo";
const fade = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export function ArticleFormPage({ editing }: { editing?: Article | null }) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<TabKey>("content");

  const [title, setTitle] = useState(editing?.title ?? "");
  const [excerpt, setExcerpt] = useState(editing?.excerpt ?? "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [author, setAuthor] = useState(editing?.author ?? "");
  const [authorRole, setAuthorRole] = useState(editing?.authorRole ?? "");
  const [image, setImage] = useState(editing?.image ?? "");
  const [status, setStatus] = useState<string>(editing?.status ?? "draft");
  const [featured, setFeatured] = useState(editing?.featured ?? false);
  const [tags, setTags] = useState<string[]>(editing?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [content, setContent] = useState<string>(blocksToHtml(editing));

  const [seoTitle, setSeoTitle] = useState(editing?.seo?.metaTitle ?? "");
  const [seoDesc, setSeoDesc] = useState(editing?.seo?.metaDescription ?? "");
  const [seoOg, setSeoOg] = useState(editing?.seo?.ogImage ?? "");

  const isEdit = Boolean(editing);

  const submit = async () => {
    if (!title.trim()) {
      toast("Title is required", "error");
      setTab("content");
      return;
    }
    if (!category.trim()) {
      toast("Category is required", "error");
      setTab("content");
      return;
    }

    const dto: CreateArticleDto = {
      title,
      excerpt,
      category,
      author,
      authorRole,
      image,
      status: status as CreateArticleDto["status"],
      featured,
      tags,
      content,
      seo: { metaTitle: seoTitle, metaDescription: seoDesc, ogImage: seoOg },
    };

    setSaving(true);
    const res = editing
      ? await adminApi.articles.update(editing.id, dto)
      : await adminApi.articles.create(dto);
    setSaving(false);

    if (res.ok) {
      toast(isEdit ? "Article updated" : "Article created", "success");
      router.push("/admin/blog");
      router.refresh();
    } else toast(res.message, "error");
  };

  const tabs: { value: TabKey; label: string }[] = [
    { value: "content", label: "Content" },
    { value: "media", label: "Media" },
    { value: "seo", label: "SEO" },
  ];

  return (
    <div>
      <AdminBreadcrumb items={[{ label: "Blog", href: "/admin/blog" }, { label: isEdit ? "Edit" : "New" }]} />
      <div className="mt-3 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/admin/blog")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-black/[0.04]"
            style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: "var(--a-fg)" }}>
              {isEdit ? "Edit Article" : "New Article"}
            </h1>
            <p className="text-sm" style={{ color: "var(--a-muted)" }}>
              {isEdit ? editing?.title : "Write a new blog post"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <AdminButton type="button" variant="outline" onClick={() => router.push("/admin/blog")}>
            Cancel
          </AdminButton>
          <AdminButton onClick={submit} disabled={saving}>
            <Save size={16} /> {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Article"}
          </AdminButton>
        </div>
      </div>

      <div className="mb-5 overflow-x-auto">
        <Tabs tabs={tabs} value={tab} onChange={(v) => setTab(v)} />
      </div>

      <motion.div key={tab} variants={fade} initial="hidden" animate="show" transition={{ duration: 0.3 }}>
        {tab === "content" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <div className="space-y-6">
              <Card>
                <SectionTitle icon={FileText} title="Article" />
                <div className="mt-4 space-y-4">
                  <Field label="Title" required>
                    <AdminInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. How to choose your gemstone" />
                  </Field>
                  <Field label="Excerpt" hint="Short summary shown on cards">
                    <AdminTextarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} />
                  </Field>
                </div>
              </Card>
              <Card>
                <SectionTitle icon={FileText} title="Body" />
                <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>
                  Write with the rich editor — formatting, headings, lists, quotes, links and images.
                </p>
                <div className="mt-4">
                  <RichTextEditor value={content} onChange={setContent} />
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <SectionTitle icon={Settings2} title="Publish" />
                <div className="mt-4 space-y-4">
                  <Field label="Status">
                    <AdminDropdown
                      value={status}
                      options={[
                        { value: "draft", label: "Draft" },
                        { value: "published", label: "Published" },
                      ]}
                      onChange={setStatus}
                      className="w-full"
                    />
                  </Field>
                  <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>Featured</p>
                      <p className="text-xs" style={{ color: "var(--a-faint)" }}>Highlight on the blog page</p>
                    </div>
                    <Toggle checked={featured} onChange={setFeatured} />
                  </div>
                </div>
              </Card>
              <Card>
                <SectionTitle icon={Settings2} title="Meta" />
                <div className="mt-4 space-y-4">
                  <Field label="Category" required>
                    <AdminInput value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Guide / Astrology / Education…" />
                  </Field>
                  <Field label="Author">
                    <AdminInput value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Pandit Nakshatra Sharma" />
                  </Field>
                  <Field label="Author role">
                    <AdminInput value={authorRole} onChange={(e) => setAuthorRole(e.target.value)} placeholder="Vedic Astrologer" />
                  </Field>
                  <Field label="Tags">
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: "var(--a-gold-soft)", color: "var(--a-gold)" }}>
                          {t}
                          <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))}>
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <AdminInput
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const t = tagInput.trim();
                          if (t && !tags.includes(t)) setTags([...tags, t]);
                          setTagInput("");
                        }
                      }}
                      placeholder="Add tag + Enter"
                      className="mt-2"
                    />
                  </Field>
                </div>
              </Card>
            </div>
          </div>
        )}

        {tab === "media" && (
          <Card className="max-w-2xl">
            <SectionTitle icon={ImageIcon} title="Cover image" />
            <div className="mt-4">
              <ImagePickerField value={image} onChange={setImage} />
            </div>
          </Card>
        )}

        {tab === "seo" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <Card>
              <SectionTitle icon={SearchIcon} title="Search optimisation" />
              <div className="mt-4 space-y-4">
                <Field label="Meta title" hint={`${seoTitle.length}/70`}>
                  <AdminInput value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={70} />
                </Field>
                <Field label="Meta description" hint={`${seoDesc.length}/180`}>
                  <AdminTextarea value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} maxLength={180} rows={3} />
                </Field>
                <Field label="OG / social image">
                  <ImagePickerField value={seoOg} onChange={setSeoOg} />
                </Field>
              </div>
            </Card>
            <Card>
              <SectionTitle icon={SearchIcon} title="Search preview" />
              <div className="mt-4 rounded-lg border p-4" style={{ borderColor: "var(--a-border)", background: "var(--a-surface-2)" }}>
                <p className="truncate text-xs" style={{ color: "var(--a-muted)" }}>
                  nakshatra.com › blog › {editing?.slug ?? "new-article"}
                </p>
                <p className="mt-1 truncate text-base font-medium text-[#1a0dab]">
                  {seoTitle || title || "Article title"}
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm" style={{ color: "var(--a-muted)" }}>
                  {seoDesc || excerpt || "Your meta description preview appears here."}
                </p>
              </div>
            </Card>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--a-surface-2)", color: "var(--a-gold)" }}>
        <Icon size={16} />
      </span>
      <h2 className="font-semibold" style={{ color: "var(--a-fg)" }}>{title}</h2>
    </div>
  );
}
