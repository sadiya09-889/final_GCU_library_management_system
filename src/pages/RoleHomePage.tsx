import DashboardPage from "./DashboardPage";
import FacultyPage from "./FacultyPage";

export default function RoleHomePage() {
  const user = JSON.parse(sessionStorage.getItem("gcu_user") || "{}");

  if (user?.role === "faculty") {
    return <FacultyPage />;
  }

  return <DashboardPage />;
}
