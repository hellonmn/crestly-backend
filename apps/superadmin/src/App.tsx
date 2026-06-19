import { Navigate, Route, Routes } from "react-router-dom";
import { useSuperAuth } from "@/lib/auth-store";
import { SuperShell } from "@/layouts/SuperShell";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { SchoolsPage } from "@/pages/SchoolsPage";
import { SchoolDetailPage } from "@/pages/SchoolDetailPage";
import { SchoolEditPage } from "@/pages/SchoolEditPage";
import { AdminsPage } from "@/pages/AdminsPage";
import { AccountPage } from "@/pages/AccountPage";
import { CatalogPage } from "@/pages/CatalogPage";
import { BillingPage } from "@/pages/BillingPage";
import { LedgerPage } from "@/pages/LedgerPage";
import { InvoicePage } from "@/pages/InvoicePage";
import { PricingPage } from "@/pages/PricingPage";
import { EnquiriesPage } from "@/pages/EnquiriesPage";
import { UpgradesPage } from "@/pages/UpgradesPage";
import { BrandStudioPage } from "@/pages/BrandStudioPage";
import { BrandSettingsPage } from "@/pages/BrandSettingsPage";
import { BrandGuidelinesPage } from "@/pages/BrandGuidelinesPage";

function RequireSuper({ children }: { children: React.ReactNode }) {
  const { token } = useSuperAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireSuper><SuperShell /></RequireSuper>}>
        <Route index element={<DashboardPage />} />

        <Route path="schools" element={<SchoolsPage />} />
        <Route path="onboard" element={<SchoolEditPage />} />
        <Route path="schools/:id" element={<SchoolDetailPage />} />
        <Route path="schools/:id/edit" element={<SchoolEditPage />} />

        <Route path="catalog" element={<CatalogPage />} />
        <Route path="pricing" element={<PricingPage />} />

        <Route path="billing" element={<BillingPage />} />
        <Route path="ledger" element={<LedgerPage />} />
        <Route path="invoice/:id" element={<InvoicePage />} />
        <Route path="enquiries" element={<EnquiriesPage />} />

        <Route path="upgrades" element={<UpgradesPage />} />

        <Route path="brand" element={<BrandStudioPage />} />
        <Route path="brand/settings" element={<BrandSettingsPage />} />
        <Route path="brand/guidelines" element={<BrandGuidelinesPage />} />

        <Route path="admins" element={<AdminsPage />} />
        <Route path="account" element={<AccountPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
