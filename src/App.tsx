import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import ChatPage from "./pages/ChatPage";
import MemoryPage from "./pages/MemoryPage";
import KnowledgePage from "./pages/KnowledgePage";
import SettingsPage from "./pages/SettingsPage";
import AdminPage from "./pages/AdminPage";
import NotFound from "./pages/NotFound";
 import SetupOriginPage from "./pages/SetupOriginPage";
 import OriginIncidentsPage from "./pages/OriginIncidentsPage";
 import OriginFeedbackPage from "./pages/OriginFeedbackPage";
 import SetupReviewPage from "./pages/SetupReviewPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="/memory" element={<ProtectedRoute><MemoryPage /></ProtectedRoute>} />
          <Route path="/knowledge" element={<ProtectedRoute><KnowledgePage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
          <Route path="/setup-origin" element={<ProtectedRoute><SetupOriginPage /></ProtectedRoute>} />
          <Route path="/origin-incidents" element={<ProtectedRoute><OriginIncidentsPage /></ProtectedRoute>} />
          <Route path="/origin-feedback" element={<ProtectedRoute><OriginFeedbackPage /></ProtectedRoute>} />
          <Route path="/setup-review" element={<ProtectedRoute><SetupReviewPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
