import { useUsageStats, useDailyUsage } from "@/hooks/useAdmin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";
import { 
  Users, 
  MessageSquare, 
  Brain, 
  BookOpen, 
  TrendingUp,
  Activity
} from "lucide-react";

function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon,
  loading 
}: { 
  title: string; 
  value: number | string; 
  description?: string;
  icon: React.ElementType;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value.toLocaleString()}</div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function UsageDashboard() {
  const { data: stats, isLoading: statsLoading } = useUsageStats();
  const { data: dailyUsage, isLoading: chartLoading } = useDailyUsage(30);

  const chartData = (dailyUsage || []).map(d => ({
    date: new Date(d.date).toLocaleDateString("ja-JP", { month: "short", day: "numeric" }),
    会話: d.conversations,
    メッセージ: d.messages,
    メモリ: d.new_memories,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">利用状況ダッシュボード</h2>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="総ユーザー数"
          value={stats?.total_users ?? 0}
          icon={Users}
          loading={statsLoading}
        />
        <StatCard
          title="アクティブユーザー"
          value={stats?.active_users ?? 0}
          description="過去30日間"
          icon={TrendingUp}
          loading={statsLoading}
        />
        <StatCard
          title="総会話数"
          value={stats?.total_conversations ?? 0}
          description="過去30日間"
          icon={MessageSquare}
          loading={statsLoading}
        />
        <StatCard
          title="総メッセージ数"
          value={stats?.total_messages ?? 0}
          description="過去30日間"
          icon={MessageSquare}
          loading={statsLoading}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="総メモリ数"
          value={stats?.total_memories ?? 0}
          icon={Brain}
          loading={statsLoading}
        />
        <StatCard
          title="承認済みメモリ"
          value={stats?.approved_memories ?? 0}
          icon={Brain}
          loading={statsLoading}
        />
        <StatCard
          title="未確認メモリ"
          value={stats?.candidate_memories ?? 0}
          description="レビュー待ち"
          icon={Brain}
          loading={statsLoading}
        />
        <StatCard
          title="ナレッジソース"
          value={stats?.total_knowledge_sources ?? 0}
          description={`${stats?.total_knowledge_chunks ?? 0} チャンク`}
          icon={BookOpen}
          loading={statsLoading}
        />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>日別利用状況</CardTitle>
          <CardDescription>過去30日間の利用推移</CardDescription>
        </CardHeader>
        <CardContent>
          {chartLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : chartData.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              データがありません
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="会話" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="メッセージ" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="メモリ" 
                  stroke="hsl(var(--chart-3))" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
