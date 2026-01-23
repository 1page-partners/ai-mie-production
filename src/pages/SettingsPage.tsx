import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, LogOut } from "lucide-react";

export default function SettingsPage() {
  const { user, isAuthenticated, signOut, loading } = useAuth();

  return (
    <AppLayout>
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        <h1 className="text-2xl font-bold text-foreground">設定</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dify設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">エンドポイント</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">環境変数で設定</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">APIキー</span>
              <Badge variant="outline">未設定</Badge>
            </div>
            <p className="text-xs text-muted-foreground">APIキー設定後に利用可能</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Supabase接続</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">状態</span>
              <div className="flex items-center gap-2">
                {isAuthenticated ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-600">接続中</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-600">未ログイン</span>
                  </>
                )}
              </div>
            </div>
            {user && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">ユーザー</span>
                <span className="text-sm text-foreground">{user.email}</span>
              </div>
            )}
            {isAuthenticated && (
              <Button variant="outline" onClick={signOut} className="w-full">
                <LogOut className="mr-2 h-4 w-4" />
                ログアウト
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
