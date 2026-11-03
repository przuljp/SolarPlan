import pytest
from pydantic import ValidationError

from app.schemas.roof_surface import RoofSurfaceInput


def valid_payload() -> dict:
    return {
        "name": "South roof",
        "shape_type": "rectangle",
        "bottom_width_m": 8.0,
        "top_width_m": None,
        "top_offset_m": 2.0,
        "length_m": 6.0,
        "tilt_deg": 30,
        "azimuth_deg": 180,
        "edge_margin_m": 0.3,
        "panel_gap_m": 0.02,
    }


def test_rectangle_normalizes_its_top_edge() -> None:
    surface = RoofSurfaceInput.model_validate(valid_payload())

    assert surface.top_width_m == 8.0
    assert surface.top_offset_m == 0


def test_trapezoid_accepts_an_asymmetric_top_edge() -> None:
    payload = valid_payload() | {
        "shape_type": "trapezoid",
        "top_width_m": 5.0,
        "top_offset_m": 1.25,
    }

    surface = RoofSurfaceInput.model_validate(payload)

    assert surface.top_width_m == 5.0
    assert surface.top_offset_m == 1.25


@pytest.mark.parametrize(
    ("top_width_m", "top_offset_m"),
    [(9.0, 0.0), (5.0, 3.5), (None, 0.0)],
)
def test_trapezoid_rejects_edges_outside_the_bottom_width(
    top_width_m: float | None, top_offset_m: float
) -> None:
    payload = valid_payload() | {
        "shape_type": "trapezoid",
        "top_width_m": top_width_m,
        "top_offset_m": top_offset_m,
    }

    with pytest.raises(ValidationError):
        RoofSurfaceInput.model_validate(payload)


def test_margin_must_fit_the_narrowest_edge() -> None:
    payload = valid_payload() | {
        "shape_type": "trapezoid",
        "top_width_m": 1.0,
        "top_offset_m": 3.5,
        "edge_margin_m": 0.5,
    }

    with pytest.raises(ValidationError, match="edge margin"):
        RoofSurfaceInput.model_validate(payload)