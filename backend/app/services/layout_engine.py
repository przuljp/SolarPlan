from math import floor

from app.models.roof_configuration import RoofConfiguration
from app.models.solar_panel import SolarPanel


def calculate_layout(
    roof: RoofConfiguration,
    panel: SolarPanel,
    orientation: str,
    requested_count: int | None = None,
) -> dict:
    """Calculate a deterministic rectangular layout using metres as the working unit."""

    original_width = panel.width_mm / 1000
    original_length = panel.length_mm / 1000
    if orientation == "landscape":
        panel_width, panel_length = original_length, original_width
    else:
        panel_width, panel_length = original_width, original_length

    usable_width = roof.width_m - 2 * roof.edge_margin_m
    usable_length = roof.length_m - 2 * roof.edge_margin_m
    columns = max(0, floor((usable_width + roof.panel_gap_m) / (panel_width + roof.panel_gap_m)))
    rows = max(0, floor((usable_length + roof.panel_gap_m) / (panel_length + roof.panel_gap_m)))
    maximum_count = rows * columns

    if requested_count is not None and requested_count > maximum_count:
        raise ValueError("Requested panel count exceeds the calculated roof capacity.")
    panel_count = maximum_count if requested_count is None else requested_count

    positions: list[dict[str, float | int]] = []
    for index in range(panel_count):
        row, column = divmod(index, columns)
        positions.append(
            {
                "index": index,
                "row": row,
                "column": column,
                "x_m": round(roof.edge_margin_m + column * (panel_width + roof.panel_gap_m), 4),
                "y_m": round(roof.edge_margin_m + row * (panel_length + roof.panel_gap_m), 4),
                "width_m": round(panel_width, 4),
                "length_m": round(panel_length, 4),
            }
        )

    panel_area = original_width * original_length
    usable_area = usable_width * usable_length
    occupied_area = panel_count * panel_area
    return {
        "orientation": orientation,
        "rows": rows,
        "columns": columns,
        "maximum_panel_count": maximum_count,
        "panel_count": panel_count,
        "installed_kwp": round(panel_count * panel.power_wp / 1000, 3),
        "occupied_area_m2": round(occupied_area, 3),
        "usable_roof_area_m2": round(usable_area, 3),
        "utilization_percent": round((occupied_area / usable_area * 100) if usable_area else 0, 1),
        "panel_width_m": round(panel_width, 4),
        "panel_length_m": round(panel_length, 4),
        "roof_width_m": roof.width_m,
        "roof_length_m": roof.length_m,
        "edge_margin_m": roof.edge_margin_m,
        "panel_gap_m": roof.panel_gap_m,
        "positions": positions,
    }
