import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Database,
  Calculator,
  LogOut,
  CircleUserRound,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/quality", label: "Quality Data", icon: Database },
  { to: "/recipe", label: "Recipe Calculator", icon: Calculator },
];

interface AppShellProps {
  children: React.ReactNode;
  /** Page title shown in the sticky top-bar */
  title?: string;
  /** Optional subtitle beneath the title */
  subtitle?: string;
  /** Action buttons rendered in the top-bar (right side) */
  actions?: React.ReactNode;
}

export default function AppShell({ children, title, subtitle, actions }: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col sticky top-0 h-screen shrink-0">
        {/* Logo / brand */}
        <div className="h-16 px-6 flex items-center gap-3 border-b border-sidebar-border">
          <div className="h-16 w-16 rounded-lg flex items-center justify-center text-white shadow-md">
            <img src="public/aditya.png" alt="Aditya birla" />
          </div>
          <div className="flex flex-col leading-tight">
            {/* <span className="text-sm font-bold tracking-wide">ADITYA BIRLA</span> */}
            <span className="text-[14px] uppercase tracking-[0.18em] text-white/60">
              ADITYA BIRLA
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = location.pathname === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-md"
                    : "text-white/75 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer – system status + user info */}
        <div className="p-3 border-t border-sidebar-border space-y-3">
          <div className="flex items-center gap-2 px-1">
            <CircleUserRound className="h-4 w-4 text-white/60 shrink-0" />
            <span className="text-xs text-white/80 truncate">
              {user?.user_metadata?.full_name ?? user?.email}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start text-white/75 hover:text-white hover:bg-white/10"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky top-bar – only rendered when a title is provided */}
        {(title || actions) && (
          <header className="h-16 px-6 border-b border-border flex items-center justify-between bg-card/90 backdrop-blur-sm sticky top-0 z-20 shadow-card">
            <div>
              {title && (
                <h1 className="text-lg font-bold tracking-tight text-navy">{title}</h1>
              )}
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
              )}
            </div>
            {actions && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {actions}
              </div>
            )}
          </header>
        )}

        <main className="flex-1 overflow-auto p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
