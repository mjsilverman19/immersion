import { AuthProvider } from "@/lib/supabase/auth-provider";
import BottomNav from "@/components/layout/BottomNav";

export const dynamic = "force-dynamic";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen pb-20">
        {children}
      </div>
      <BottomNav />
    </AuthProvider>
  );
}
