import { Sidebar } from "@/components/dashboard/sidebar";

export default function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <DashboardLayoutInner params={params}>{children}</DashboardLayoutInner>
    </div>
  );
}

async function DashboardLayoutInner({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  return (
    <>
      <Sidebar businessId={id} />
      <main className="ml-[280px] p-8 transition-all duration-300">
        {children}
      </main>
    </>
  );
}
