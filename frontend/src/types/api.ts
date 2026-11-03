export type User = { id: string; full_name: string; email: string; created_at: string; updated_at: string };
export type ProjectStatus = "draft" | "analyzed";
export type Project = { id: string; name: string; description: string | null; status: ProjectStatus; created_at: string; updated_at: string };
export type ProjectInput = { name: string; description?: string | null };

export type ProjectLocationInput = { lat: number; lon: number; location_label?: string | null };
export type ProjectLocation = ProjectLocationInput & { id: string; project_id: string; created_at: string; updated_at: string };

export type RoofSurfaceShape = "rectangle" | "trapezoid";
export type RoofSurfaceInput = {
  name: string;
  shape_type: RoofSurfaceShape;
  bottom_width_m: number;
  top_width_m: number | null;
  top_offset_m: number;
  length_m: number;
  tilt_deg: number;
  azimuth_deg: number;
  edge_margin_m: number;
  panel_gap_m: number;
};
export type RoofSurface = RoofSurfaceInput & {
  id: string;
  project_id: string;
  top_width_m: number;
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
export type PolygonPoint = { x_m: number; y_m: number };
export type LayoutPreview = {
  solar_panel: SolarPanel; orientation: PanelOrientation; rows: number; columns: number;
  maximum_panel_count: number; panel_count: number; installed_kwp: number;
  occupied_area_m2: number; usable_roof_area_m2: number; utilization_percent: number;
  panel_width_m: number; panel_length_m: number; roof_shape_type: RoofSurfaceShape;
  roof_bottom_width_m: number; roof_top_width_m: number; roof_top_offset_m: number; roof_length_m: number;
  edge_margin_m: number; panel_gap_m: number; roof_polygon: PolygonPoint[];
  usable_polygon: PolygonPoint[]; positions: PanelPosition[];
};
export type PanelLayout = LayoutPreview & {
  id: string; project_id: string; roof_surface_id: string; solar_panel_id: string;
  created_at: string; updated_at: string;
};
export type RegisterInput = LoginInput & { full_name: string };
export type TokenResponse = { access_token: string; token_type: string; expires_in: number };

export type EnergySimulationInput = { system_loss_percent: number };
export type MonthlyEnergyResult = { month: number; energy_kwh: number };
export type SurfaceEnergyResult = {
  roof_surface_id: string;
  name: string;
  installed_kwp: number;
  tilt_deg: number;
  azimuth_deg: number;
  pvgis_aspect: number;
  annual_kwh: number;
  specific_yield_kwh_per_kwp: number;
  monthly_results: MonthlyEnergyResult[];
};
export type EnergySimulation = {
  id: string;
  project_id: string;
  provider_version: string;
  method_version: string;
  system_loss_percent: number;
  installed_kwp: number;
  annual_kwh: number;
  specific_yield_kwh_per_kwp: number;
  input_snapshot: Record<string, unknown>;
  monthly_results: MonthlyEnergyResult[];
  surface_results: SurfaceEnergyResult[];
  created_at: string;
};

export type MonthlyConsumptionValue = { month: number; consumption_kwh: number };
export type ConsumptionProfileInput = {
  annual_consumption_kwh: number | null;
  monthly_values: MonthlyConsumptionValue[];
};
export type ConsumptionProfile = ConsumptionProfileInput & {
  id: string;
  project_id: string;
  source: "manual" | "bill_extracted" | "estimated";
  known_months: number;
  total_known_consumption_kwh: number;
  average_known_monthly_kwh: number | null;
  coverage_percent: number;
  profile_kind: "annual_only" | "partial_monthly" | "complete_monthly";
  created_at: string;
  updated_at: string;
};

export type MonthlyEnergyComparison = {
  month: number;
  production_kwh: number;
  consumption_kwh: number | null;
  balance_kwh: number | null;
  status: "surplus" | "deficit" | "balanced" | "unavailable";
};
export type EnergyComparison = {
  project_id: string;
  simulation_id: string;
  consumption_profile_id: string;
  annual_production_kwh: number;
  annual_consumption_kwh: number | null;
  annual_balance_kwh: number | null;
  annual_coverage_ratio_percent: number | null;
  consumption_profile_kind: "annual_only" | "partial_monthly" | "complete_monthly";
  known_months: number;
  months_with_surplus: number;
  months_with_deficit: number;
  months_balanced: number;
  monthly_comparison: MonthlyEnergyComparison[];
};
