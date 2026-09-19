import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ReservationProvider } from "./context/ReservationProvider";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ReservationProvider>
      <App />
    </ReservationProvider>
  </StrictMode>,
);
