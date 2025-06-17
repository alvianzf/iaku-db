import { Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import routes from "./routes/routes";
import "./index.css";
import Layout from "./components/Layout";

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
    <Layout>
      <Routes>
        {routes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={<route.component />}
          />
        ))}
      </Routes>
      </Layout>
    </Suspense>
  );
}

export default App;
