import { Switch, Route, Router, Link, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import StandingsPage from "@/pages/standings";
import TournamentPage from "@/pages/tournament";
import MajorsPage from "@/pages/majors";
import AdminPage from "@/pages/admin";
import { Flag, Trophy, Star, Sun, Moon } from "lucide-react";
import { useState, useEffect } from "react";
import { Analytics } from "@vercel/analytics/react";

function NavLink({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  const [location] = useLocation();
  const active = location === href || (href === "/" && location === "");
  return (
    <Link href={href}>
      <a className={`nav-link ${active ? "active" : ""}`} data-testid={`nav-${label.toLowerCase()}`}>
        <Icon size={18} />
        <span>{label}</span>
      </a>
    </Link>
  );
}

function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-label="Golf League" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2"/>
      <circle cx="16" cy="16" r="6" fill="currentColor" opacity="0.15"/>
      <circle cx="16" cy="16" r="3" fill="currentColor"/>
      <line x1="16" y1="2" x2="16" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="30" y1="16" x2="24" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function AppShell() {
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Logo />
          <div className="sidebar-title">
            <span className="brand">Golf League</span>
            <span className="season">2026 Season</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <NavLink href="/" icon={Trophy} label="Standings" />
          <NavLink href="/tournament" icon={Flag} label="Tournament" />
          <NavLink href="/majors" icon={Star} label="Majors" />
        </nav>
        <div className="sidebar-footer">
          <button
            className="theme-toggle"
            onClick={() => setDark(d => !d)}
            aria-label="Toggle theme"
            data-testid="theme-toggle"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
            <span>{dark ? "Light mode" : "Dark mode"}</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <Switch>
          <Route path="/" component={StandingsPage} />
          <Route path="/tournament" component={TournamentPage} />
          <Route path="/majors" component={MajorsPage} />
          <Route path="/admin" component={AdminPage} />
        </Switch>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AppShell />
      </Router>
      <Toaster />
      <Analytics />
    </QueryClientProvider>
  );
}
