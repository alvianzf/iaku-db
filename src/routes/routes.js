
import React from "react";

const routes = [
  {
    path: "/",
    component: React.lazy(() => import("../pages/Home")),
  },
  {
    path: "/stats",
    component: React.lazy(() => import("../pages/Statistik")),
  }
];

export default routes;
