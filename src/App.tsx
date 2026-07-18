import { Routes, Route, Navigate } from "react-router-dom";

import MapView from "@/pages/MapView";
import Methodology from "@/pages/Methodology";

const App = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/map" replace />} />
    <Route path="/map" element={<MapView />} />
    <Route path="/methodology" element={<Methodology />} />
    <Route path="*" element={<Navigate to="/map" replace />} />
  </Routes>
);

export default App;
