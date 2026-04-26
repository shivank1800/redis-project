/**
 * React entry point.
 *
 * This is intentionally small. The educational value lives in services, hooks,
 * and components where we explain how the UI maps onto the Redis-heavy backend.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
