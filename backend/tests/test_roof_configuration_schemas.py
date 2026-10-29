import pytest
from pydantic import ValidationError

from app.schemas.roof_configuration import RoofConfigurationUpsert


def valid_roof_payload() -> dict[str, object]:
    return {
        "width_m": 8.4,
        "length_m": 11.2,
        "tilt_deg": 32,
        "azimuth_deg": 180,
        "edge_margin_m": 0.3,
        "panel_gap_m": 0.02,
        "lat": 43.8563,
        "lon": 18.4131,
        "location_label": "  Family   house, Sarajevo  ",
    }


def test_roof_configuration_accepts_and_normalizes_valid_input() -> None:
    data = RoofConfigurationUpsert.model_validate(valid_roof_payload())

    assert data.location_label == "Family house, Sarajevo"
    assert data.lat == 43.8563
    assert data.azimuth_deg == 180


def test_blank_location_label_is_stored_as_none() -> None:
    payload = valid_roof_payload()
    payload["location_label"] = "   "

    data = RoofConfigurationUpsert.model_validate(payload)

    assert data.location_label is None


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("width_m", 0),
        ("width_m", float("inf")),
        ("length_m", -1),
        ("tilt_deg", 91),
        ("azimuth_deg", 360),
        ("edge_margin_m", -0.1),
        ("panel_gap_m", -0.01),
        ("lat", 90.1),
        ("lat", float("nan")),
        ("lon", -180.1),
    ],
)
def test_roof_configuration_rejects_values_outside_allowed_ranges(
    field: str,
    value: float,
) -> None:
    payload = valid_roof_payload()
    payload[field] = value

    with pytest.raises(ValidationError):
        RoofConfigurationUpsert.model_validate(payload)


def test_roof_configuration_requires_remaining_area_inside_edge_margin() -> None:
    payload = valid_roof_payload()
    payload["width_m"] = 1
    payload["edge_margin_m"] = 0.5

    with pytest.raises(
        ValidationError,
        match="Twice the edge margin must be smaller than both roof dimensions",
    ):
        RoofConfigurationUpsert.model_validate(payload)
