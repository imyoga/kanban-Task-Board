import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import BoardPage from "@/pages/BoardPage";
import StatsPage from "@/pages/StatsPage";
import HomeRedirect from "@/pages/HomeRedirect";
import LoginPage from "@/pages/LoginPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import TeamsPage from "@/pages/TeamsPage";
import AccountPage from "@/pages/AccountPage";
import TaskPage from "@/pages/TaskPage";
import Layout from "@/components/Layout";
import { useMe } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useMe();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <LoginPage />;
  return <>{children}</>;
}

function Router() {
  const [location] = useLocation();

  if (location === "/reset-password" || location.startsWith("/reset-password")) {
    return <ResetPasswordPage />;
  }

  return (
    <AuthGate>
      <Layout>
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/teams" component={TeamsPage} />
          <Route path="/account" component={AccountPage} />
          <Route path="/boards/:boardId/stats" component={StatsPage} />
          <Route path="/boards/:boardId/:taskKey" component={TaskPage} />
          <Route path="/boards/:boardId" component={BoardPage} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </AuthGate>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
