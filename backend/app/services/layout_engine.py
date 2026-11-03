from math import floor, hypot
from typing import Protocol

from app.models.solar_panel import SolarPanel


class RoofGeometry(Protocol):
    shape_type: str
    bottom_width_m: float
    top_width_m: float
    top_offset_m: float
    length_m: float
    edge_margin_m: float
    panel_gap_m: float


Point = tuple[float, float]


def roof_polygon(roof: RoofGeometry) -> list[Point]:
    """Return the roof plane as top-left, top-right, bottom-right, bottom-left."""
    return [
        (roof.top_offset_m, 0.0),
        (roof.top_offset_m + roof.top_width_m, 0.0),
        (roof.bottom_width_m, roof.length_m),
        (0.0, roof.length_m),
    ]


def _line_intersection(first: tuple[Point, Point], second: tuple[Point, Point]) -> Point:
    (x1, y1), (x2, y2) = first
    (x3, y3), (x4, y4) = second
    denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(denominator) < 1e-9:
        raise ValueError("Roof geometry cannot be inset by the selected edge margin.")
    first_cross = x1 * y2 - y1 * x2
    second_cross = x3 * y4 - y3 * x4
    return (
        (first_cross * (x3 - x4) - (x1 - x2) * second_cross) / denominator,
        (first_cross * (y3 - y4) - (y1 - y2) * second_cross) / denominator,
    )


def inset_polygon(points: list[Point], distance: float) -> list[Point]:
    """Inset a convex roof polygon by a perpendicular distance."""
    if distance == 0:
        return points.copy()

    offset_lines: list[tuple[Point, Point]] = []
    for index, start in enumerate(points):
        end = points[(index + 1) % len(points)]
        dx, dy = end[0] - start[0], end[1] - start[1]
        edge_length = hypot(dx, dy)
        if edge_length == 0:
            raise ValueError("Roof edges must have a positive length.")
        normal_x, normal_y = -dy / edge_length, dx / edge_length
        shift_x, shift_y = normal_x * distance, normal_y * distance
        offset_lines.append(
            (
                (start[0] + shift_x, start[1] + shift_y),
                (end[0] + shift_x, end[1] + shift_y),
            )
        )

    return [
        _line_intersection(offset_lines[index - 1], offset_lines[index])
        for index in range(len(offset_lines))
    ]


def polygon_area(points: list[Point]) -> float:
    return abs(
        sum(
            start[0] * points[(index + 1) % len(points)][1]
            - points[(index + 1) % len(points)][0] * start[1]
            for index, start in enumerate(points)
        )
        / 2
    )


def _horizontal_bounds(points: list[Point], y: float) -> tuple[float, float]:
    top_left, top_right, bottom_right, bottom_left = points
    height = bottom_left[1] - top_left[1]
    if height <= 0:
        raise ValueError("Usable roof height must be positive.")
    progress = min(1.0, max(0.0, (y - top_left[1]) / height))
    left = top_left[0] + progress * (bottom_left[0] - top_left[0])
    right = top_right[0] + progress * (bottom_right[0] - top_right[0])
    return left, right


def _serialize_points(points: list[Point]) -> list[dict[str, float]]:
    return [{"x_m": round(x, 4), "y_m": round(y, 4)} for x, y in points]


def calculate_layout(
    roof: RoofGeometry,
    panel: SolarPanel,
    orientation: str,
    requested_count: int | None = None,
) -> dict:
    """Place rectangular panels row by row inside the inset roof polygon."""
    original_width = panel.width_mm / 1000
    original_length = panel.length_mm / 1000
    if orientation == "landscape":
        panel_width, panel_length = original_length, original_width
    else:
        panel_width, panel_length = original_width, original_length

    outer_polygon = roof_polygon(roof)
    usable_polygon = inset_polygon(outer_polygon, roof.edge_margin_m)
    usable_area = polygon_area(usable_polygon)
    min_y = usable_polygon[0][1]
    max_y = usable_polygon[3][1]
    row_step = panel_length + roof.panel_gap_m
    column_step = panel_width + roof.panel_gap_m

    all_positions: list[dict[str, float | int]] = []
    row_capacities: list[int] = []
    row = 0
    y = min_y
    while y + panel_length <= max_y + 1e-9:
        top_left, top_right = _horizontal_bounds(usable_polygon, y)
        bottom_left, bottom_right = _horizontal_bounds(usable_polygon, y + panel_length)
        available_left = max(top_left, bottom_left)
        available_right = min(top_right, bottom_right)
        available_width = max(0.0, available_right - available_left)
        columns = max(0, floor((available_width + roof.panel_gap_m) / column_step))
        row_capacities.append(columns)
        for column in range(columns):
            all_positions.append(
                {
                    "index": len(all_positions),
                    "row": row,
                    "column": column,
                    "x_m": round(available_left + column * column_step, 4),
                    "y_m": round(y, 4),
                    "width_m": round(panel_width, 4),
                    "length_m": round(panel_length, 4),
                }
            )
        row += 1
        y = min_y + row * row_step

    maximum_count = len(all_positions)
    if requested_count is not None and requested_count > maximum_count:
        raise ValueError("Requested panel count exceeds the calculated roof capacity.")
    panel_count = maximum_count if requested_count is None else requested_count
    positions = all_positions[:panel_count]

    panel_area = original_width * original_length
    occupied_area = panel_count * panel_area
    return {
        "orientation": orientation,
        "rows": sum(capacity > 0 for capacity in row_capacities),
        "columns": max(row_capacities, default=0),
        "maximum_panel_count": maximum_count,
        "panel_count": panel_count,
        "installed_kwp": round(panel_count * panel.power_wp / 1000, 3),
        "occupied_area_m2": round(occupied_area, 3),
        "usable_roof_area_m2": round(usable_area, 3),
        "utilization_percent": round((occupied_area / usable_area * 100) if usable_area else 0, 1),
        "panel_width_m": round(panel_width, 4),
        "panel_length_m": round(panel_length, 4),
        "roof_shape_type": roof.shape_type,
        "roof_bottom_width_m": roof.bottom_width_m,
        "roof_top_width_m": roof.top_width_m,
        "roof_top_offset_m": roof.top_offset_m,
        "roof_length_m": roof.length_m,
        "edge_margin_m": roof.edge_margin_m,
        "panel_gap_m": roof.panel_gap_m,
        "roof_polygon": _serialize_points(outer_polygon),
        "usable_polygon": _serialize_points(usable_polygon),
        "positions": positions,
    }