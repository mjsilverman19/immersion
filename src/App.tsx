import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

import MapView from "@/pages/MapView";
import VenuePage from "@/pages/VenuePage";
import Methodology from "@/pages/Methodology";
import SavedPage from "@/pages/SavedPage";
import Storybook from "@/pages/Storybook";

const App = () => (
  <>
    <Routes>
      <Route path="/" element={<Navigate to="/map" replace />} />
      <Route path="/map" element={<MapView />} />
      <Route path="/venue/:id" element={<VenuePage />} />
      <Route path="/methodology" element={<Methodology />} />
      <Route path="/saved" element={<SavedPage />} />
      <Route path="/storybook" element={<Storybook />} />
      <Route path="*" element={<Navigate to="/map" replace />} />
    </Routes>
    <Toaster position="top-center" richColors />
  </>
);

export default App;
