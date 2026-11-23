// app/dashboard/layout.tsx
import { AuthGuard } from "@/app/components/authGuard";
import { HeaderDashboard } from "../components/HeaderDashboard";
import { Notification } from "../components/notification";
import { SoundProvider } from "@/app/Context/SoundContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <SoundProvider>
        <HeaderDashboard>
          <Notification />
          {children}
        </HeaderDashboard>
      </SoundProvider>
    </AuthGuard>
  );
}
