"""Read-only freshness checks; project metadata is deliberately excluded."""

import hashlib
import json
from datetime import UTC

GEOMETRY = (
    "shape_type",
    "bottom_width_m",
    "top_width_m",
    "top_offset_m",
    "length_m",
    "tilt_deg",
    "azimuth_deg",
    "edge_margin_m",
    "panel_gap_m",
)
PANEL = ("power_wp", "width_mm", "length_mm")


def configuration_fingerprint(location, surfaces, overrides=None):
    rows = []
    for surface in sorted(surfaces, key=lambda item: str(item.id)):
        layout = (overrides or {}).get(str(surface.id), getattr(surface, "panel_layout", None))

        def value(key, layout=layout):
            return layout.get(key) if isinstance(layout, dict) else getattr(layout, key, None)

        panel = value("panel_snapshot") or {}
        solar = value("solar_panel")
        rows.append(
            {
                "id": str(surface.id),
                **{key: getattr(surface, key, None) for key in GEOMETRY},
                "panel_id": str(value("solar_panel_id")),
                "panel": {key: panel.get(key, getattr(solar, key, None)) for key in PANEL},
                **{key: value(key) for key in ("orientation", "panel_count", "installed_kwp")},
            }
        )
    payload = {"location": [location.lat, location.lon] if location else None, "surfaces": rows}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()


def analysis_status(project, simulation):
    surfaces = project.roof_surfaces
    location = project.location
    if simulation is None:
        return "in_progress" if location or surfaces else "not_started"
    if (
        not location
        or not surfaces
        or any(not s.panel_layout or s.panel_layout.panel_count <= 0 for s in surfaces)
    ):
        return "needs_recalculation"
    snapshot = simulation.input_snapshot
    fingerprint = snapshot.get("configuration_fingerprint")
    if fingerprint:
        return (
            "analyzed"
            if fingerprint == configuration_fingerprint(location, surfaces)
            else "needs_recalculation"
        )

    # Legacy snapshots lack full geometry. Use relevant entity timestamps as a conservative
    # fallback, together with the saved calculation inputs. Never use project.updated_at.
    def utc(value):
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value

    if any(
        getattr(item, "updated_at", None) and utc(item.updated_at) > utc(simulation.created_at)
        for item in [location, *surfaces, *(s.panel_layout for s in surfaces)]
    ):
        return "needs_recalculation"
    point = snapshot.get("location", {})
    saved = {str(s.get("roof_surface_id")): s for s in snapshot.get("surfaces", [])}
    if (
        point.get("lat") != location.lat
        or point.get("lon") != location.lon
        or set(saved) != {str(s.id) for s in surfaces}
    ):
        return "needs_recalculation"
    for surface in surfaces:
        old = saved[str(surface.id)]
        layout = surface.panel_layout
        panel = old.get("panel", snapshot.get("panel", {}))
        if (
            old.get("tilt_deg") != surface.tilt_deg
            or old.get("azimuth_deg") != surface.azimuth_deg
            or old.get("panel_count") != layout.panel_count
            or str(panel.get("id")) != str(layout.solar_panel_id)
            or abs(old.get("installed_kwp", -1) - layout.installed_kwp) > 0.001
        ):
            return "needs_recalculation"
    return "analyzed"
