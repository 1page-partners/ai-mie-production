import { AppLayout } from "@/components/layout/AppLayout";
import { useIsAdmin } from "@/hooks/useAdmin";
import { UserManagement } from "@/components/admin/UserManagement";
import { UsageDashboard } from "@/components/admin/UsageDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, BarChart3, Users } from "lucide-react";
import { Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminPage() {
  const { data: isAdmin, isLoading } = useIsAdmin();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center">
          <Skeleton className="h-8 w-32" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/chat" replace />;
  }

  return (
    <AppLayout>
      <div className="flex h-full flex-col">
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">管理者</h1>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList>
              <TabsTrigger value="dashboard" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                ダッシュボード
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-2">
                <Users className="h-4 w-4" />
                ユーザー管理
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
              <UsageDashboard />
            </TabsContent>

            <TabsContent value="users">
              <UserManagement />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
