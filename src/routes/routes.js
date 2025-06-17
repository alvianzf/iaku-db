
import React from "react";

const routes = [
  {
    path: "/",
    component: React.lazy(() => import("../pages/Home")),
  },
  {
    path: "/stats",
    component: React.lazy(() => import("../pages/Statistik")),
  },
  {
    path: "/form-alumni",
    component: React.lazy(() => import("../pages/Form")),
  },
  {
    path: '/dashboard',
    component: React.lazy(() => import("../pages/admin/Dashboard")),
  },
  {
    path: '/auth',
    component: React.lazy(() => import("../pages/admin/Login")),
  }
];

export default routes;
