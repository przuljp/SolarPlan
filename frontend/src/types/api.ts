export type User = { id: string; full_name: string; email: string; created_at: string; updated_at: string };
export type ProjectStatus = "draft";
export type Project = { id: string; name: string; description: string | null; status: ProjectStatus; created_at: string; updated_at: string };
export type ProjectInput = { name: string; description?: string | null };

export type ProjectLocationInput = { lat: number; lon: number; location_label?: string | null };
export type ProjectLocation = ProjectLocationInput & { id: string; project_id: string; created_at: string; updated_at: string };

export type RoofSurfaceInput = {
  name: string;
  width_m: number;
  length_m: number;
  tilt_deg: number;
  azimuth_deg: number;
  edge_margin_m: number;
  panel_gap_m: number;
};
export type RoofSurface = RoofSurfaceInput & {
  id: string;
  project_id: string;
  panel_layout: PanelLayout | null;
  created_at: string;
  updated_at: string;
};

export type GeocodingResult = { display_name: string; latitude: number; longitude: number; category: string | null; type: string | null };
export type LoginInput = { email: string; password: string };
export type SolarPanelCategory = "compact" | "standard" | "high-power";
export type SolarPanel = {
  id: string; manufacturer: string; model_sku: string; category: SolarPanelCategory;
  power_wp: number; width_mm: number; length_mm: number; thickness_mm: number;
  efficiency_percent: number; cell_technology: string; temperature_coefficient_pmax: number;
  datasheet_url: string; bih_source_name: string; bih_source_url: string;
  verified_at: string; created_at: string; updated_at: string;
};
export type PanelOrientation = "portrait" | "landscape";
export type LayoutInput = { solar_panel_id: string; orientation: PanelOrientation; panel_count?: number | null };
export type PanelPosition = { index: number; row: number; column: number; x_m: number; y_m: number; width_m: number; length_m: number };
export type LayoutPreview = {
  solar_panel: SolarPanel; orientation: PanelOrientation; rows: number; columns: number;
  maximum_panel_count: number; panel_count: number; installed_kwp: number;
  occupied_area_m2: number; usable_roof_area_m2: number; utilization_percent: number;
  panel_width_m: number; panel_length_m: number; roof_width_m: number; roof_length_m: number;
  edge_margin_m: number; panel_gap_m: number; positions: PanelPosition[];
};
export type PanelLayout = LayoutPreview & {
  id: string; project_id: string; roof_surface_id: string; solar_panel_id: string;
  created_at: string; updated_at: string;
};
export type RegisterInput = LoginInput & { full_name: string };
export type TokenResponse = { access_token: string; token_type: string; expires_in: number };
