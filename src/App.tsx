import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import DashboardLayout from "./components/DashboardLayout";
import BooksPage from "./pages/BooksPage";
import IssueBookPage from "./pages/IssueBookPage";
import UsersPage from "./pages/UsersPage";
import ProfilePage from "./pages/ProfilePage";
import OPACPage from "./pages/OPACPage";
import DELNETPage from "./pages/DELNETPage";
import IRINSPage from "./pages/IRINSPage";
import EResourcesPage from "./pages/EResourcesPage";
import ReportsPage from "./pages/ReportsPage";
import OverduePage from "./pages/OverduePage";
import ReturnBooksPage from "./pages/ReturnBooksPage";
import ReservationsPage from "./pages/ReservationsPage";
import MyBooksPage from "./pages/MyBooksPage";
import FineDetailsPage from "./pages/FineDetailsPage";
import NotificationsPage from "./pages/NotificationsPage";
import SignupPage from "./pages/SignupPage";
import VerifyOTPPage from "./pages/VerifyOTPPage";
import AcademicProfilePage from "./pages/AcademicProfilePage";
import RoleHomePage from "./pages/RoleHomePage";
import NotFound from "./pages/NotFound";
import { RequireAuth, RequireRole } from "./components/AuthGuards";

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
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/verify-otp" element={<VerifyOTPPage />} />
          <Route
            path="/academic-profile"
            element={(
              <RequireAuth>
                <AcademicProfilePage />
              </RequireAuth>
            )}
          />
          <Route
            path="/dashboard"
            element={(
              <RequireAuth>
                <DashboardLayout />
              </RequireAuth>
            )}
          >
            <Route index element={<RoleHomePage />} />
            <Route
              path="books"
              element={(
                <RequireRole allowedRoles={["admin", "librarian"]}>
                  <BooksPage />
                </RequireRole>
              )}
            />
            <Route
              path="issue"
              element={(
                <RequireRole allowedRoles={["admin", "librarian"]}>
                  <IssueBookPage />
                </RequireRole>
              )}
            />
            <Route
              path="return"
              element={(
                <RequireRole allowedRoles={["admin", "librarian"]}>
                  <ReturnBooksPage />
                </RequireRole>
              )}
            />
            <Route
              path="reservations"
              element={(
                <RequireRole allowedRoles={["admin", "librarian"]}>
                  <ReservationsPage />
                </RequireRole>
              )}
            />
            <Route
              path="overdue"
              element={(
                <RequireRole allowedRoles={["admin", "librarian"]}>
                  <OverduePage />
                </RequireRole>
              )}
            />
            <Route
              path="users"
              element={(
                <RequireRole allowedRoles={["admin"]}>
                  <UsersPage />
                </RequireRole>
              )}
            />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="opac" element={<OPACPage />} />
            <Route path="delnet" element={<DELNETPage />} />
            <Route
              path="e-resources"
              element={(
                <RequireRole allowedRoles={["admin", "librarian", "student", "faculty"]}>
                  <EResourcesPage />
                </RequireRole>
              )}
            />
            <Route
              path="irins"
              element={(
                <RequireRole allowedRoles={["admin", "librarian", "faculty"]}>
                  <IRINSPage />
                </RequireRole>
              )}
            />
            <Route
              path="reports"
              element={(
                <RequireRole allowedRoles={["admin", "librarian"]}>
                  <ReportsPage />
                </RequireRole>
              )}
            />
            <Route
              path="my-books"
              element={(
                <RequireRole allowedRoles={["student", "faculty"]}>
                  <MyBooksPage />
                </RequireRole>
              )}
            />
            <Route
              path="fines"
              element={(
                <RequireRole allowedRoles={["student", "faculty"]}>
                  <FineDetailsPage />
                </RequireRole>
              )}
            />
            <Route
              path="notifications"
              element={(
                <RequireRole allowedRoles={["student", "faculty"]}>
                  <NotificationsPage />
                </RequireRole>
              )}
            />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
