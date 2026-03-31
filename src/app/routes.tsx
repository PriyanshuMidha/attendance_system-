import { createBrowserRouter } from "react-router";
import { Dashboard } from "./components/Dashboard";
import { AddEmployee } from "./components/AddEmployee";
import { EmployeeDetail } from "./components/EmployeeDetail";
import { Reports } from "./components/Reports";
import { Login } from "./components/Login";
import { ProtectedLayout } from "./components/ProtectedLayout";

export const router = createBrowserRouter([
  { path: "/login", Component: Login },
  {
    path: "/",
    Component: ProtectedLayout,
    children: [
      { index: true, Component: Dashboard },
      { path: "add", Component: AddEmployee },
      { path: "employee/:id", Component: EmployeeDetail },
      { path: "reports", Component: Reports },
    ],
  },
]);
