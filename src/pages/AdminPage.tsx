import { AppLayout } from "@/components/layout/AppLayout";
import { useIsAdmin } from "@/hooks/useAdmin";
import { UserManagement } from "@/components/admin/UserManagement";
import { UsageDashboard } from "@/components/admin/UsageDashboard";
import { InsightsApproval } from "@/components/admin/InsightsApproval";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, BarChart3, Users, Lightbulb } from "lucide-react";
import { Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

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
        <div className="border-b border-border p-3 md:p-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">管理者</h1>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 md:p-6">
            <Tabs defaultValue="dashboard" className="space-y-4 md:space-y-6">
              <TabsList className="w-full md:w-auto">
                <TabsTrigger value="dashboard" className="gap-2 flex-1 md:flex-none">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden sm:inline">ダッシュボード</span>
                  <span className="sm:hidden">統計</span>
                </TabsTrigger>
                <TabsTrigger value="users" className="gap-2 flex-1 md:flex-none">
                  <Users className="h-4 w-4" />
                  <span className="hidden sm:inline">ユーザー管理</span>
                  <span className="sm:hidden">ユーザー</span>
                </TabsTrigger>
                <TabsTrigger value="insights" className="gap-2 flex-1 md:flex-none">
                  <Lightbulb className="h-4 w-4" />
                  <span className="hidden sm:inline">Insights承認</span>
                  <span className="sm:hidden">承認</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard">
                <UsageDashboard />
              </TabsContent>

              <TabsContent value="users">
                <UserManagement />
              </TabsContent>

              <TabsContent value="insights">
                <InsightsApproval />
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </div>
    </AppLayout>
  );
}
