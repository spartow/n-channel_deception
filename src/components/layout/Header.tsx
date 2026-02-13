import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Radio, BarChart3, Waves, FlaskConical } from "lucide-react";

export function Header() {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Playground", icon: Radio },
    { path: "/sweep", label: "Sweep Study", icon: BarChart3 },
    { path: "/equilibrium", label: "Equilibrium", icon: FlaskConical, experimental: true },
  ];

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="relative p-2 rounded-lg bg-primary/10">
              <Waves className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                N-Channel Deception Jammer
              </h1>
              <p className="text-xs text-muted-foreground font-mono">
                Stackelberg Game Simulator
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            {navItems.map(({ path, label, icon: Icon, experimental }) => (
              <Link
                key={path}
                to={path}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  location.pathname === path
                    ? experimental 
                      ? "bg-accent text-accent-foreground shadow-md"
                      : "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
                {experimental && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-background/20 uppercase tracking-wider">
                    β
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}