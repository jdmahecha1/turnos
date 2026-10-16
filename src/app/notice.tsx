import { isNoticeKey, NOTICES } from "@/lib/auth-notices";

/** Banner for `?aviso=...` messages, rendered inside <Suspense> (searchParams is per-request). */
export async function Notice({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { aviso } = await searchParams;
  if (!isNoticeKey(aviso)) return null;
  const notice = NOTICES[aviso];
  const styles =
    notice.tone === "success"
      ? "border-brand-100 bg-brand-50 text-brand-900"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <div role="status" className={`mb-6 rounded-2xl border px-5 py-4 ${styles}`}>
      <p className="font-semibold">{notice.title}</p>
      <p className="mt-1 text-sm">{notice.text}</p>
    </div>
  );
}
