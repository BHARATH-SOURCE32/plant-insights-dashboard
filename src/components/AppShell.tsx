import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FlaskConical, LayoutDashboard, Database, Calculator, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/quality", label: "Quality Data", icon: Database },
  { to: "/recipe", label: "Recipe Calculator", icon: Calculator },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col p-4 sticky top-0 h-screen">
        <div className="flex items-center gap-2 mb-8 px-2">
          <div className="h-9 w-9 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold tracking-tight">Plant System</div>
            <div className="text-xs text-sidebar-foreground/60">Recipe & Quality</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = location.pathname === n.to;
            return (
              <Link key={n.to} to={n.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
                )}>
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border pt-4">
          <div className="px-2 mb-2">
            <div className="text-xs text-sidebar-foreground/60">Signed in as</div>
            <div className="text-sm truncate">{user?.email}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
