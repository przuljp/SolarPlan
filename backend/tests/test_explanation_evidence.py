import pytest
from test_ai_explanations import narrative
from test_reports import simulation as simulation

from app.core.exceptions import AiInvalidResponseError
from app.services.ai_explanation_service import simulation_facts
from app.services.explanation_evidence import evidence_values, resolve_evidence


def test_resolves_saved_values_without_reapplying_losses(simulation):
    before = simulation.model_dump()
    values = evidence_values({"simulation": simulation_facts(simulation)})
    result = resolve_evidence(narrative(), values)
    assert "799.50 kWh" in result.summary
    assert "4.20 kWp" in result.summary
    assert "9.5%" in result.production_insights[0]
    assert "10.25 kWh" in result.seasonal_insights
    assert "{{" not in result.model_dump_json()
    assert simulation.model_dump() == before


@pytest.mark.parametrize(
    "text",
    [
        "Your annual production is 9999 kWh.",
        "Your annual production is {{simulation.unknown}}.",
        "Your annual production is {simulation.annual_kwh}.",
        "This is a general description of solar production.",
    ],
)
def test_rejects_invented_numbers_unknown_refs_and_generic_summaries(simulation, text):
    values = evidence_values({"simulation": simulation_facts(simulation)})
    with pytest.raises(AiInvalidResponseError):
        resolve_evidence(narrative(summary=text), values)


def test_missing_consumption_cannot_be_referenced(simulation):
    values = evidence_values({"simulation": simulation_facts(simulation), "consumption": None})
    with pytest.raises(AiInvalidResponseError):
        resolve_evidence(
            narrative(consumption_insights="Balance is {{consumption.annual_balance_kwh}}."), values
        )


def test_units_months_negative_deltas_and_zero_are_preserved():
    values = evidence_values(
        {
            "comparison": {"deltas": {"annual_kwh": -520.25, "system_loss_percent": 0}},
            "consumption": {"annual_balance_kwh": 0, "annual_coverage_ratio_percent": 100},
            "simulation": {"monthly_results": [{"month": 2, "energy_kwh": 0}]},
        }
    )
    assert values["comparison.deltas.annual_kwh"] == "-520.25 kWh"
    assert values["comparison.deltas.system_loss_percent"] == "0 percentage points"
    assert values["consumption.annual_balance_kwh"] == "0.00 kWh"
    assert values["consumption.annual_coverage_ratio_percent"] == "100%"
    assert values["simulation.monthly_results.0.month"] == "February"
