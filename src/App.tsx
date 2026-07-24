import { Routes, Route, Navigate } from "react-router-dom";

import Home from "@/pages/Home";
import MapView from "@/pages/MapView";
import Methodology from "@/pages/Methodology";

const App = () => (
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/map" element={<MapView />} />
    <Route path="/methodology" element={<Methodology />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default App;
