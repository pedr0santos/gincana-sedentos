import { useAuth } from "@/_core/hooks/useAuth";
import { LogOut, RadioTower, Shield, Trophy, UsersRound } from "lucide-react";
import { useLocation } from "wouter";
import { InstallAppPrompt } from "./InstallAppPrompt";

const navItems = [
  { path: "/", label: "Início", icon: RadioTower },
  { path: "/equipe", label: "Equipe", icon: UsersRound },
  { path: "/ranking", label: "Ranking", icon: Trophy },
];

export function GameNav() {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  return (
    <>
      <header className="game-header">
        <button className="brand-mark" onClick={() => setLocation("/")} aria-label="Ir para início">
          <span className="brand-orbit" />
          <span>SEDENTOS</span>
        </button>
        <nav className="desktop-nav" aria-label="Navegação principal">
          {navItems.map(item => (
            <button key={item.path} onClick={() => setLocation(item.path)} className={location === item.path ? "nav-link active" : "nav-link"}>
              {item.label}
            </button>
          ))}
          <button onClick={() => setLocation("/ao-vivo")} className="nav-link">Ao vivo</button>
          {user?.role === "admin" && <button onClick={() => setLocation("/admin")} className="nav-link admin-link"><Shield size={15} /> Administração</button>}
        </nav>
        <button className="account-button" onClick={logout} title="Sair da conta">
          <span className="account-initial">{user?.name?.charAt(0).toUpperCase() ?? "S"}</span>
          <LogOut size={16} />
        </button>
      </header>
      <nav className="mobile-nav" aria-label="Navegação móvel">
        {navItems.map(item => {
          const Icon = item.icon;
          return <button key={item.path} onClick={() => setLocation(item.path)} className={location === item.path ? "mobile-nav-item active" : "mobile-nav-item"}><Icon size={18} /><span>{item.label}</span></button>;
        })}
      </nav>
      <InstallAppPrompt />
    </>
  );
}
