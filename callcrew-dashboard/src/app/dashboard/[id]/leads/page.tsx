import LeadsPageClient from "./leads-page-client";

export function generateStaticParams() {
  return [{ id: "new" }];
}

export default async function LeadsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LeadsPageClient id={id} />;
}
