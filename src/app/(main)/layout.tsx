import { AuthProvider } from "@/lib/supabase/auth-provider";
import BottomNav from "@/components/layout/BottomNav";
import { LogSheetProvider } from "@/components/log/LogSheetContext";
import LogSheet from "@/components/log/LogSheet";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <LogSheetProvider>
        <div className="min-h-screen pb-20">
          {children}
        </div>
        <BottomNav />
        <LogSheet />
      </LogSheetProvider>
    </AuthProvider>
  );
}
