import { Link, useLocation } from "react-router-dom";
import { MessageSquare, Brain, BookOpen, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/chat", label: "Chat", icon: MessageSquare },
  { path: "/memory", label: "Memory", icon: Brain },
  { path: "/knowledge", label: "Knowledge", icon: BookOpen },
  { path: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="flex h-full w-16 flex-col items-center bg-sidebar py-4 border-r border-sidebar-border">
      <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
        <Sparkles className="h-5 w-5 text-sidebar-primary-foreground" />
      </div>
      
      <nav className="flex flex-1 flex-col gap-2">
        {navItems.map((item) => {
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
