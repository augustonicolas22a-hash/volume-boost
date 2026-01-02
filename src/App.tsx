import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Recarregar from "@/pages/Recarregar";
import CriarMaster from "@/pages/CriarMaster";
import CriarRevendedor from "@/pages/CriarRevendedor";
import Revendedores from "@/pages/Revendedores";
import Transferir from "@/pages/Transferir";
import Estatisticas from "@/pages/Estatisticas";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/recarregar" element={<Recarregar />} />
            <Route path="/criar-master" element={<CriarMaster />} />
            <Route path="/criar-revendedor" element={<CriarRevendedor />} />
            <Route path="/revendedores" element={<Revendedores />} />
            <Route path="/transferir" element={<Transferir />} />
            <Route path="/estatisticas" element={<Estatisticas />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
