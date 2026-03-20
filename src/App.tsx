import { Switch, Route } from "wouter";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import HomePage from "@/pages/HomePage";
import VerifyPage from "@/pages/VerifyPage";
import ManualVerifyPage from "@/pages/ManualVerifyPage";
import TransparencyLogPage from "@/pages/TransparencyLogPage";
import AboutPage from "@/pages/AboutPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <Header />
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/verify" component={ManualVerifyPage} />
          <Route path="/verify/:jobId" component={VerifyPage} />
          <Route path="/transparency" component={TransparencyLogPage} />
          <Route path="/about" component={AboutPage} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </QueryClientProvider>
  );
}

export default App;
