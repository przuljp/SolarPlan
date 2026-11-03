from collections import Counter
from types import SimpleNamespace

import pytest

from app.services.layout_engine import calculate_layout


@pytest.fixture
def roof():
    return SimpleNamespace(
        shape_type="rectangle",
        bottom_width_m=6.0,
        top_width_m=6.0,
        top_offset_m=0.0,
        length_m=10.0,
        edge_margin_m=0.3,
        panel_gap_m=0.02,
    )


@pytest.fixture
def trapezoid_roof():
    return SimpleNamespace(
        shape_type="trapezoid",
        bottom_width_m=8.0,
        top_width_m=4.0,
        top_offset_m=2.0,
        length_m=8.0,
        edge_margin_m=0.3,
        panel_gap_m=0.02,
    )


@pytest.fixture
def panel():
    return SimpleNamespace(width_mm=1134, length_mm=1722, power_wp=430)


def test_portrait_layout_uses_saved_margin_and_gap(roof, panel) -> None:
    layout = calculate_layout(roof, panel, "portrait")

    assert layout["columns"] == 4
    assert layout["rows"] == 5
    assert layout["panel_count"] == 20
    assert layout["installed_kwp"] == 8.6
    assert layout["positions"][0]["x_m"] == 0.3
    assert layout["positions"][1]["x_m"] == 1.454
    assert layout["roof_polygon"][0] == {"x_m": 0.0, "y_m": 0.0}


def test_landscape_swaps_panel_dimensions(roof, panel) -> None:
    layout = calculate_layout(roof, panel, "landscape")

    assert layout["panel_width_m"] == 1.722
    assert layout["panel_length_m"] == 1.134
    assert layout["columns"] == 3
    assert layout["rows"] == 8
    assert layout["maximum_panel_count"] == 24


def test_trapezoid_rows_follow_sloped_edges(trapezoid_roof, panel) -> None:
    layout = calculate_layout(trapezoid_roof, panel, "portrait")
    panels_per_row = Counter(position["row"] for position in layout["positions"])
    row_counts = [panels_per_row[row] for row in sorted(panels_per_row)]

    assert layout["roof_shape_type"] == "trapezoid"
    assert layout["roof_polygon"] == [
        {"x_m": 2.0, "y_m": 0.0},
        {"x_m": 6.0, "y_m": 0.0},
        {"x_m": 8.0, "y_m": 8.0},
        {"x_m": 0.0, "y_m": 8.0},
    ]
    assert row_counts == sorted(row_counts)
    assert row_counts[0] < row_counts[-1]
    assert layout["maximum_panel_count"] == sum(row_counts)
    assert 0 < layout["usable_roof_area_m2"] < 48


def test_user_can_save_fewer_panels_than_the_maximum(roof, panel) -> None:
    layout = calculate_layout(roof, panel, "portrait", requested_count=7)

    assert layout["maximum_panel_count"] == 20
    assert layout["panel_count"] == 7
    assert len(layout["positions"]) == 7
    assert layout["installed_kwp"] == 3.01


def test_count_above_roof_capacity_is_rejected(roof, panel) -> None:
    with pytest.raises(ValueError, match="exceeds"):
        calculate_layout(roof, panel, "portrait", requested_count=21)


def test_zero_fit_returns_an_empty_layout(panel) -> None:
    tiny_roof = SimpleNamespace(
        shape_type="rectangle",
        bottom_width_m=1.0,
        top_width_m=1.0,
        top_offset_m=0.0,
        length_m=1.0,
        edge_margin_m=0.1,
        panel_gap_m=0.02,
    )

    layout = calculate_layout(tiny_roof, panel, "portrait")

    assert layout["maximum_panel_count"] == 0
    assert layout["positions"] == []
    assert layout["installed_kwp"] == 0