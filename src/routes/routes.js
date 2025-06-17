
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
  }
];

export default routes;
