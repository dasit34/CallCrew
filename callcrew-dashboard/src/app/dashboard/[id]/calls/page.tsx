import CallsPageClient from "./calls-page-client";

export function generateStaticParams() {
  return [{ id: "new" }];
}

export default async function CallsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CallsPageClient id={id} />;
}
