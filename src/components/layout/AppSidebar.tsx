import { Link, useLocation } from "react-router-dom";
import { MessageSquare, Brain, BookOpen, Settings, Sparkles, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/useAdmin";

interface AppSidebarProps {
  mobile?: boolean;
}

const navItems = [
  { path: "/chat", label: "チャット", icon: MessageSquare },
  { path: "/memory", label: "メモリ", icon: Brain },
  { path: "/knowledge", label: "ナレッジ", icon: BookOpen },
  { path: "/settings", label: "設定", icon: Settings },
];

const adminNavItems = [
  { path: "/admin", label: "管理者", icon: Shield },
];

export function AppSidebar({ mobile = false }: AppSidebarProps) {
  const location = useLocation();
  const { data: isAdmin } = useIsAdmin();

  const allNavItems = isAdmin ? [...navItems, ...adminNavItems] : navItems;

  // Mobile layout - horizontal list with labels
  if (mobile) {
    return (
      <nav className="flex flex-col gap-1 p-3">
        {allNavItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path === "/chat" && location.pathname === "/");
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive 
                  ? "bg-sidebar-accent text-sidebar-primary font-medium" 
                  : "text-sidebar-foreground/70"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  // Desktop layout - icon only
  return (
    <aside className="flex h-full w-16 flex-col items-center bg-sidebar py-4 border-r border-sidebar-border">
      <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
        <Sparkles className="h-5 w-5 text-sidebar-primary-foreground" />
      </div>
      
      <nav className="flex flex-1 flex-col gap-2">
        {allNavItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path === "/chat" && location.pathname === "/");
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive 
                  ? "bg-sidebar-accent text-sidebar-primary" 
                  : "text-sidebar-foreground/70"
              )}
              title={item.label}
            >
              <item.icon className="h-5 w-5" />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
