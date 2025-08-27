// app/dashboard/layout.tsx
import { AuthGuard } from "@/app/components/authGuard";
import { HeaderDashboard } from "../components/HeaderDashboard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return(
    <AuthGuard>
      <HeaderDashboard>
        {children}
      </HeaderDashboard>
    </AuthGuard>
  )
 
   
}
