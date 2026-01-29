import DashboardPageClient from "./dashboard-page-client";

export function generateStaticParams() {
  return [{ id: "new" }];
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DashboardPageClient id={id} />;
}
