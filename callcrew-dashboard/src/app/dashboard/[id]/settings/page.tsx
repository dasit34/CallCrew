import SettingsPageClient from "./settings-page-client";

export function generateStaticParams() {
  return [{ id: "new" }];
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SettingsPageClient id={id} />;
}
