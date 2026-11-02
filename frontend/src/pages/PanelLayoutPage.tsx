import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useState } from "react";

import { api } from "../lib/api";
import type { PanelOrientation } from "../types/api";

export function PanelLayoutPage() {
  const { projectId, surfaceId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const panelId = searchParams.get("panel");
  const queryClient = useQueryClient();
  const [orientation, setOrientation] = useState<PanelOrientation>("portrait");
  const [panelCount, setPanelCount] = useState<number | null>(null);

  const preview = useQuery({
    queryKey: ["layout-preview", projectId, panelId, orientation],
    queryFn: () => api.previewLayout(projectId!, surfaceId!, {
      solar_panel_id: panelId!,
      orientation,
    }),
    enabled: Boolean(projectId && panelId),
  });

  const effectiveCount = Math.max(0, Math.min(
    Number.isFinite(panelCount) ? panelCount! : preview.data?.maximum_panel_count ?? 0,
    preview.data?.maximum_panel_count ?? 0,
  ));
  const save = useMutation({
    mutationFn: () => api.savePanelLayout(projectId!, surfaceId!, {
      solar_panel_id: panelId!,
      orientation,
      panel_count: effectiveCount,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects", projectId, "roof-surfaces"] });
      navigate(`/projects/${projectId}/roof-surfaces?saved=1`);
    },
  });

  if (!panelId) {
    return <main className="workspace-page"><div className="query-error"><div><strong>No panel has been selected.</strong><p>Choose a module before calculating the layout.</p></div><Link className="button button-secondary" to={`/projects/${projectId}/roof-surfaces/${surfaceId}/panels`}>Choose panel</Link></div></main>;
  }
  if (preview.isPending) return <main className="workspace-page"><div className="form-page-skeleton" /></main>;
  if (preview.isError) return <main className="workspace-page"><div className="query-error"><strong>Layout could not be calculated.</strong><Link className="button button-secondary" to={`/projects/${projectId}/roof-surfaces/${surfaceId}/panels`}>Back to catalog</Link></div></main>;

  const layout = preview.data;
  const positions = layout.positions.slice(0, effectiveCount);
  const scale = 100;
  const svgWidth = layout.roof_width_m * scale;
  const svgHeight = layout.roof_length_m * scale;
  const installedKwp = effectiveCount * layout.solar_panel.power_wp / 1000;
  const occupiedArea = effectiveCount * layout.solar_panel.width_mm * layout.solar_panel.length_mm / 1_000_000;
  const utilization = layout.usable_roof_area_m2 ? occupiedArea / layout.usable_roof_area_m2 * 100 : 0;

  return (
    <main className="workspace-page">
      <Link className="back-link" to={`/projects/${projectId}/roof-surfaces`}>← Roof surfaces</Link>
      <header className="workspace-heading">
        <div>
          <h1>Fit the panel array</h1>
          <p>The calculation uses the saved roof dimensions, edge margin and panel gap. You can install fewer panels than the geometric maximum.</p>
        </div>
      </header>

      <div className="layout-workbench">
        <section className="content-panel layout-sheet">
          <div className="layout-sheet-heading">
            <div><small>{layout.solar_panel.manufacturer}</small><h2>{layout.solar_panel.model_sku}</h2></div>
            <span>{layout.roof_width_m} × {layout.roof_length_m} m roof</span>
          </div>
          {layout.maximum_panel_count === 0 ? (
            <div className="layout-empty"><strong>This module does not fit.</strong><p>Try landscape orientation, reduce the saved roof margin, or choose a smaller panel.</p></div>
          ) : (
            <svg className="roof-layout-svg" viewBox={`0 0 ${svgWidth} ${svgHeight}`} role="img" aria-label={`Roof layout with ${effectiveCount} panels`}>
              <rect className="roof-svg-plane" x="1" y="1" width={svgWidth - 2} height={svgHeight - 2} />
              <rect
                className="roof-svg-usable"
                x={layout.edge_margin_m * scale}
                y={layout.edge_margin_m * scale}
                width={(layout.roof_width_m - 2 * layout.edge_margin_m) * scale}
                height={(layout.roof_length_m - 2 * layout.edge_margin_m) * scale}
              />
              {positions.map((position) => (
                <g key={position.index}>
                  <rect
                    className="roof-svg-panel"
                    x={position.x_m * scale}
                    y={position.y_m * scale}
                    width={position.width_m * scale}
                    height={position.length_m * scale}
                  />
                  <line
                    className="roof-svg-cell-line"
                    x1={(position.x_m + position.width_m / 2) * scale}
                    y1={(position.y_m + 0.04) * scale}
                    x2={(position.x_m + position.width_m / 2) * scale}
                    y2={(position.y_m + position.length_m - 0.04) * scale}
                  />
                </g>
              ))}
            </svg>
          )}
          <div className="layout-legend"><span><i className="legend-panel" />Installed module</span><span><i className="legend-margin" />Usable roof boundary</span></div>
        </section>

        <aside className="content-panel layout-controls">
          <div><h2>Layout controls</h2></div>
          <fieldset className="orientation-control">
            <legend>Panel orientation</legend>
            <label><input type="radio" name="orientation" checked={orientation === "portrait"} onChange={() => { setOrientation("portrait"); setPanelCount(null); }} /> Portrait</label>
            <label><input type="radio" name="orientation" checked={orientation === "landscape"} onChange={() => { setOrientation("landscape"); setPanelCount(null); }} /> Landscape</label>
          </fieldset>
          <label>Installed panel count
            <input type="number" min="0" max={layout.maximum_panel_count} value={effectiveCount} onChange={(event) => setPanelCount(Number(event.target.value))} />
            <small>Calculated maximum: {layout.maximum_panel_count} panels ({layout.rows} rows × {layout.columns} columns).</small>
          </label>

          <dl className="layout-metrics">
            <div><dt>System size</dt><dd>{installedKwp.toFixed(2)} kWp</dd></div>
            <div><dt>Panel area</dt><dd>{occupiedArea.toFixed(2)} m²</dd></div>
            <div><dt>Usable roof</dt><dd>{layout.usable_roof_area_m2.toFixed(2)} m²</dd></div>
            <div><dt>Area utilization</dt><dd>{utilization.toFixed(1)}%</dd></div>
          </dl>

          {save.isSuccess && <div className="form-success" role="status">Layout saved to this project.</div>}
          {save.isError && <div className="form-error" role="alert">The layout could not be saved. Your previous data is unchanged.</div>}
          <button className="button button-primary button-full" type="button" disabled={save.isPending || layout.maximum_panel_count === 0} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save panel layout"}
          </button>
          <Link className="text-link layout-return-link" to={`/projects/${projectId}/roof-surfaces`}>Cancel and return to roof surfaces</Link>
        </aside>
      </div>
    </main>
  );
}
