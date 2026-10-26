/**
 * <JsonLd> — renders a schema.org object as a JSON-LD <script> tag.
 *
 * Server component (no "use client") so the structured data is present in the
 * initial HTML that crawlers read. Pass any schema object built by the helpers
 * in `@/lib/seo`.
 */

export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      // Schema is build-time/server data we control — safe to inject.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
