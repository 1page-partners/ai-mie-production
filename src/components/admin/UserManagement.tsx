import { useState } from "react";
import { useUsers, useGrantRole, useRevokeRole } from "@/hooks/useAdmin";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, ShieldOff, User, UserCog, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AppRole } from "@/lib/services/admin";

export function UserManagement() {
  const { toast } = useToast();
  const { data: users, isLoading, error } = useUsers();
  const grantRole = useGrantRole();
  const revokeRole = useRevokeRole();
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

  const handleSetRole = async (userId: string, currentRoles: AppRole[], newRole: AppRole) => {
    // Check if user already has this role
    if (currentRoles.includes(newRole)) {
      toast({ title: "既に付与済み", description: `${newRole}権限は既に付与されています` });
      return;
    }

    setLoadingUserId(userId);

    try {
      // Remove existing roles first
      for (const role of currentRoles) {
        await revokeRole.mutateAsync({ userId, role });
      }
      // Grant new role
      await grantRole.mutateAsync({ userId, role: newRole });
      toast({ title: "権限を変更", description: `${newRole}権限を付与しました` });
    } catch (e) {
      toast({
        title: "エラー",
        description: "権限の変更に失敗しました",
        variant: "destructive",
      });
    } finally {
      setLoadingUserId(null);
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          ユーザー情報の取得に失敗しました
        </CardContent>
      </Card>
    );
  }

  const getRoleBadge = (roles: AppRole[]) => {
    if (roles.includes("admin")) {
      return (
        <Badge variant="default" className="bg-primary">
          <Shield className="mr-1 h-3 w-3" />
          Admin
        </Badge>
      );
    }
    if (roles.includes("origin")) {
      return (
        <Badge variant="default" className="bg-accent text-accent-foreground">
          <Eye className="mr-1 h-3 w-3" />
          Origin
        </Badge>
      );
    }
    return <Badge variant="secondary">User</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          ユーザー管理
        </CardTitle>
        <CardDescription>
          登録済みユーザーの一覧と権限管理
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : !users || users.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            ユーザーが登録されていません
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ユーザー</TableHead>
                <TableHead>権限</TableHead>
                <TableHead>登録日</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const isAdmin = user.roles.includes("admin");
                const isLoading = loadingUserId === user.user_id;

                return (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.avatar_url ?? undefined} />
                          <AvatarFallback>
                            {user.display_name?.charAt(0) ?? "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {user.display_name ?? "名前未設定"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {user.user_id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">{getRoleBadge(user.roles)}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString("ja-JP")}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="outline" disabled={isLoading}>
                            {isLoading ? "..." : (
                              <>
                                <UserCog className="mr-1 h-4 w-4" />
                                ロール変更
                              </>
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleSetRole(user.user_id, user.roles, "admin")}
                            disabled={user.roles.includes("admin")}
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            Admin に変更
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleSetRole(user.user_id, user.roles, "origin")}
                            disabled={user.roles.includes("origin")}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Origin に変更
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleSetRole(user.user_id, user.roles, "user")}
                            disabled={user.roles.includes("user")}
                          >
                            <User className="mr-2 h-4 w-4" />
                            User に変更
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
