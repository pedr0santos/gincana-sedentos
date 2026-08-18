import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Admin from "./pages/Admin";
import History from "./pages/History";
import Home from "./pages/Home";
import ForgotPassword from "./pages/ForgotPassword";
import LiveRanking from "./pages/LiveRanking";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";
import Ranking from "./pages/Ranking";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import RoundPlay from "./pages/RoundPlay";
import Team from "./pages/Team";

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/login" component={Login} />
    <Route path="/cadastro-conta" component={Register} />
    <Route path="/esqueci-senha" component={ForgotPassword} />
    <Route path="/redefinir-senha" component={ResetPassword} />
    <Route path="/cadastro" component={Onboarding} />
    <Route path="/rodada/:id" component={RoundPlay} />
    <Route path="/equipe" component={Team} />
    <Route path="/historico" component={History} />
    <Route path="/ranking" component={Ranking} />
    <Route path="/ao-vivo" component={LiveRanking} />
    <Route path="/admin" component={Admin} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster richColors position="top-center" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
