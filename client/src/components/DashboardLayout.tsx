import { useAuth } from "@/_core/hooks/useAuth";
import { BarChart3, CalendarClock, ChevronLeft, LogOut, RadioTower, ShieldCheck, UsersRound } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "./ui/button";

const items = [
  { path: "/admin", label: "Visão geral", icon: BarChart3 },
  { path: "/admin?tab=rodadas", label: "Rodadas", icon: CalendarClock },
  { path: "/admin?tab=participantes", label: "Participantes", icon: UsersRound },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <button className="brand-mark sidebar-brand" onClick={() => setLocation("/")}><span className="brand-orbit" /><span>SEDENTOS</span></button>
        <div className="admin-identity"><ShieldCheck size={18} /><span>Central de comando</span></div>
        <nav className="admin-nav">
          {items.map(item => {
            const Icon = item.icon;
            const active = item.path === "/admin" ? location === "/admin" : location.startsWith("/admin");
            return <button key={item.label} onClick={() => setLocation(item.path)} className={active ? "admin-nav-item active" : "admin-nav-item"}><Icon size={18} />{item.label}</button>;
          })}
        </nav>
        <div className="admin-sidebar-footer">
          <p>{user?.name ?? "Administrador"}</p>
          <Button variant="ghost" className="w-full justify-start text-slate-300 hover:bg-white/5 hover:text-white" onClick={logout}><LogOut size={17} /> Sair</Button>
        </div>
      </aside>
      <section className="admin-main">
        <header className="admin-mobile-header"><button onClick={() => setLocation("/")}><ChevronLeft size={18} /> Voltar à gincana</button><span>Admin</span></header>
        {children}
      </section>
    </div>
  );
}
