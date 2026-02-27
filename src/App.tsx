import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import DashboardLayout from "./components/DashboardLayout";
import DashboardPage from "./pages/DashboardPage";
import BooksPage from "./pages/BooksPage";
import IssueBookPage from "./pages/IssueBookPage";
import UsersPage from "./pages/UsersPage";
import ProfilePage from "./pages/ProfilePage";
import OPACPage from "./pages/OPACPage";
import DELNETPage from "./pages/DELNETPage";
import IRINSPage from "./pages/IRINSPage";
import ReportsPage from "./pages/ReportsPage";
import OverduePage from "./pages/OverduePage";
import ReturnBooksPage from "./pages/ReturnBooksPage";
import MyBooksPage from "./pages/MyBooksPage";
import FineDetailsPage from "./pages/FineDetailsPage";
import NotificationsPage from "./pages/NotificationsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="books" element={<BooksPage />} />
            <Route path="issue" element={<IssueBookPage />} />
            <Route path="return" element={<ReturnBooksPage />} />
            <Route path="overdue" element={<OverduePage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="opac" element={<OPACPage />} />
            <Route path="delnet" element={<DELNETPage />} />
            <Route path="irins" element={<IRINSPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="my-books" element={<MyBooksPage />} />
            <Route path="fines" element={<FineDetailsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
