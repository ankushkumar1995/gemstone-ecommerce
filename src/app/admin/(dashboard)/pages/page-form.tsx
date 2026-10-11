"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Save, FileText, Settings2 } from "lucide-react";
import type { CmsPage } from "@/modules/pages";
import type { CreatePageDto } from "@/modules/pages";
import { adminApi } from "@/lib/admin-api";
import {
  Card,
  AdminButton,
  AdminInput,
  AdminTextarea,
  AdminDropdown,
  Field,
  Toggle,
  AdminBreadcrumb,
  RichTextEditor,
  useAdminToast,
} from "../../_components";

export function PageForm({ editing }: { editing?: CmsPage | null }) {
  const router = useRouter();
  const { toast } = useAdminToast();
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(editing?.title ?? "");
  const [content, setContent] = useState(editing?.content ?? "");
  const [status, setStatus] = useState<string>(editing?.status ?? "draft");
  const [showInFooter, setShowInFooter] = useState(editing?.showInFooter ?? false);
  const [seoTitle, setSeoTitle] = useState(editing?.seoTitle ?? "");
  const [seoDesc, setSeoDesc] = useState(editing?.seoDescription ?? "");

  const isEdit = Boolean(editing);

  const submit = async () => {
    if (!title.trim()) return toast("Title is required", "error");
    const dto: CreatePageDto = {
      title,
      content,
      status: status as CreatePageDto["status"],
      showInFooter,
      seoTitle,
      seoDescription: seoDesc,
    };
    setSaving(true);
    const res = editing ? await adminApi.pages.update(editing.id, dto) : await adminApi.pages.create(dto);
    setSaving(false);
    if (res.ok) {
      toast(isEdit ? "Page updated" : "Page created", "success");
      router.push("/admin/pages");
      router.refresh();
    } else toast(res.message, "error");
  };

  return (
    <div>
      <AdminBreadcrumb items={[{ label: "Pages", href: "/admin/pages" }, { label: isEdit ? "Edit" : "New" }]} />
      <div className="mt-3 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/admin/pages")}
            className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-black/[0.04]"
            style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--a-fg)" }}>
            {isEdit ? "Edit Page" : "New Page"}
          </h1>
        </div>
        <div className="flex gap-2">
          <AdminButton type="button" variant="outline" onClick={() => router.push("/admin/pages")}>
            Cancel
          </AdminButton>
          <AdminButton onClick={submit} disabled={saving}>
            <Save size={16} /> {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Page"}
          </AdminButton>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card>
            <SectionTitle icon={FileText} title="Content" />
            <div className="mt-4 space-y-4">
              <Field label="Title" required>
                <AdminInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. About Us" />
              </Field>
              <Field label="Body">
                <RichTextEditor value={content} onChange={setContent} placeholder="Write the page content…" />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <SectionTitle icon={Settings2} title="Settings" />
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
                  <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>Show in footer</p>
                  <p className="text-xs" style={{ color: "var(--a-faint)" }}>Add a link in the storefront footer</p>
                </div>
                <Toggle checked={showInFooter} onChange={setShowInFooter} />
              </div>
            </div>
          </Card>
          <Card>
            <SectionTitle icon={Settings2} title="SEO" />
            <div className="mt-4 space-y-4">
              <Field label="Meta title" hint={`${seoTitle.length}/70`}>
                <AdminInput value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={70} />
              </Field>
              <Field label="Meta description" hint={`${seoDesc.length}/180`}>
                <AdminTextarea value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} maxLength={180} rows={3} />
              </Field>
            </div>
          </Card>
        </div>
      </div>
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
