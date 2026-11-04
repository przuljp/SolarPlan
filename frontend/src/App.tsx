import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthPage } from "./pages/AuthPage";
import { ConsumptionPage } from "./pages/ConsumptionPage";
import { ConfigurationOptimizerPage } from "./pages/ConfigurationOptimizerPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LandingPage } from "./pages/LandingPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PanelLayoutPage } from "./pages/PanelLayoutPage";
import { PanelSelectionPage } from "./pages/PanelSelectionPage";
import { ProductionAnalysisPage } from "./pages/ProductionAnalysisPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { ProjectFormPage } from "./pages/ProjectFormPage";
import { ProjectLocationPage } from "./pages/ProjectLocationPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { RoofSurfaceFormPage } from "./pages/RoofSurfaceFormPage";
import { RoofSurfacesPage } from "./pages/RoofSurfacesPage";
import { SimulationHistoryDetailPage, SimulationHistoryPage } from "./pages/SimulationHistoryPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  return <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route element={<ProtectedRoute />}><Route element={<AppShell />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/new" element={<ProjectFormPage mode="create" />} />
      <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
      <Route path="/projects/:projectId/edit" element={<ProjectFormPage mode="edit" />} />
      <Route path="/projects/:projectId/location" element={<ProjectLocationPage />} />
      <Route path="/projects/:projectId/roof-surfaces" element={<RoofSurfacesPage />} />
      <Route path="/projects/:projectId/roof-surfaces/new" element={<RoofSurfaceFormPage />} />
      <Route path="/projects/:projectId/roof-surfaces/:surfaceId/edit" element={<RoofSurfaceFormPage />} />
      <Route path="/projects/:projectId/roof-surfaces/:surfaceId/panels" element={<PanelSelectionPage />} />
      <Route path="/projects/:projectId/roof-surfaces/:surfaceId/layout" element={<PanelLayoutPage />} />
      <Route path="/projects/:projectId/analysis" element={<ProductionAnalysisPage />} />
      <Route path="/projects/:projectId/simulations" element={<SimulationHistoryPage />} />
      <Route path="/projects/:projectId/simulations/:simulationId" element={<SimulationHistoryDetailPage />} />
      <Route path="/projects/:projectId/optimizer" element={<ConfigurationOptimizerPage />} />
      <Route path="/projects/:projectId/consumption" element={<ConsumptionPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Route></Route>
    <Route path="/404" element={<NotFoundPage />} />
    <Route path="*" element={<Navigate to="/404" replace />} />
  </Routes>;
}
