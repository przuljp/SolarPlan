"""On-demand exports of immutable simulation snapshots; no persisted report files."""

import calendar
import csv
from datetime import UTC
from io import BytesIO, StringIO
from pathlib import Path
from typing import Literal
from uuid import UUID
from xml.sax.saxutils import escape

import reportlab
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    LongTable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    TableStyle,
)
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.schemas.energy_simulation import EnergySimulationRead
from app.services import energy_simulation_service

ReportFormat = Literal["pdf", "csv"]
INK = colors.HexColor("#153d45")
SOFT = colors.HexColor("#536d71")
LINE = colors.HexColor("#cad6d2")
PAPER = colors.HexColor("#f2f1eb")
LIMITATIONS = (
    "Preliminary PVGIS estimate for a typical year, based on historical solar radiation "
    "at the saved location. Actual production varies by year. Nearby shading, structural "
    "limits and inverter selection are not modelled. System losses are already included "
    "in the saved production values. This report is not an official engineering design."
)
SNAPSHOT_NOTE = (
    "All inputs and production values come from the selected saved simulation. "
    "Current roof edits and household consumption are not included in this snapshot report."
)

# ReportLab ships these redistributable TrueType fonts, including Latin extended glyphs.
_fonts = Path(reportlab.__file__).parent / "fonts"
pdfmetrics.registerFont(TTFont("ReportSans", str(_fonts / "Vera.ttf")))
pdfmetrics.registerFont(TTFont("ReportSans-Bold", str(_fonts / "VeraBd.ttf")))
pdfmetrics.registerFontFamily("ReportSans", normal="ReportSans", bold="ReportSans-Bold")


async def export_simulation(
    session: AsyncSession,
    project_id: UUID,
    simulation_id: UUID,
    owner_id: UUID,
    report_format: ReportFormat,
) -> bytes:
    simulation = await energy_simulation_service.get_simulation(
        session, project_id, simulation_id, owner_id
    )
    # Validate and detach before rendering in a worker; never read current configuration.
    snapshot = EnergySimulationRead.model_validate(simulation)
    renderer = build_pdf if report_format == "pdf" else build_csv
    return await run_in_threadpool(renderer, snapshot)


def _date(simulation: EnergySimulationRead) -> str:
    value = simulation.created_at
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).strftime("%d %b %Y, %H:%M UTC")


def _source(simulation: EnergySimulationRead) -> str:
    return (
        "Optimizer configuration"
        if simulation.input_snapshot.get("source") == "configuration_optimizer"
        else "Manual analysis"
    )


def _surface_input(simulation: EnergySimulationRead, surface_id: UUID) -> dict:
    return next(
        (
            item
            for item in simulation.input_snapshot.get("surfaces", [])
            if str(item.get("roof_surface_id")) == str(surface_id)
        ),
        {},
    )


def _panel(simulation: EnergySimulationRead, surface: dict) -> dict:
    return surface.get("panel") or simulation.input_snapshot.get("panel") or {}


def _safe_cell(value: object) -> object:
    # Quoting alone does not stop spreadsheets evaluating user-controlled formulas.
    if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")):
        return "'" + value
    return value


def build_csv(simulation: EnergySimulationRead) -> bytes:
    stream = StringIO(newline="")
    writer = csv.writer(stream)
    writer.writerow(["section", "roof_surface_id", "name", "metric", "month", "value", "unit"])

    def row(section, metric, value, unit="", *, surface_id="", name="", month=""):
        writer.writerow(
            [_safe_cell(cell) for cell in [section, surface_id, name, metric, month, value, unit]]
        )

    for metric, value in {
        "simulation_id": str(simulation.id),
        "project_id": str(simulation.project_id),
        "calculated_at": simulation.created_at.isoformat(),
        "source": _source(simulation),
        "provider": f"PVGIS {simulation.provider_version}",
        "method": simulation.method_version,
    }.items():
        row("metadata", metric, value)
    location = simulation.input_snapshot.get("location", {})
    for metric in ("location_label", "lat", "lon"):
        row("location", metric, location.get(metric, ""))
    for metric, value, unit in (
        ("installed_power", simulation.installed_kwp, "kWp"),
        ("annual_production", simulation.annual_kwh, "kWh/year"),
        ("specific_yield", simulation.specific_yield_kwh_per_kwp, "kWh/kWp"),
        ("system_losses", simulation.system_loss_percent, "%"),
        ("roof_surfaces", len(simulation.surface_results), "count"),
    ):
        row("summary", metric, value, unit)
    for item in sorted(simulation.monthly_results, key=lambda item: item.month):
        row("monthly", "production", item.energy_kwh, "kWh", month=item.month)
    for surface in simulation.surface_results:
        saved = _surface_input(simulation, surface.roof_surface_id)
        panel = _panel(simulation, saved)
        identity = {"surface_id": str(surface.roof_surface_id), "name": surface.name}
        for metric, value, unit in (
            ("installed_power", surface.installed_kwp, "kWp"),
            ("annual_production", surface.annual_kwh, "kWh/year"),
            ("specific_yield", surface.specific_yield_kwh_per_kwp, "kWh/kWp"),
            ("tilt", surface.tilt_deg, "degrees"),
            ("azimuth", surface.azimuth_deg, "degrees clockwise from north"),
            ("shape", saved.get("shape_type", ""), ""),
            ("panel_count", saved.get("panel_count", ""), "count"),
            ("panel_manufacturer", panel.get("manufacturer", ""), ""),
            ("panel_model", panel.get("model_sku", ""), ""),
            ("panel_power", panel.get("power_wp", ""), "Wp"),
        ):
            row("surface", metric, value, unit, **identity)
        for item in sorted(surface.monthly_results, key=lambda item: item.month):
            row(
                "surface_monthly",
                "production",
                item.energy_kwh,
                "kWh",
                month=item.month,
                **identity,
            )
    row("notes", "snapshot_scope", SNAPSHOT_NOTE)
    row("notes", "limitations", LIMITATIONS)
    return stream.getvalue().encode("utf-8-sig")


def build_pdf(simulation: EnergySimulationRead) -> bytes:
    output = BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=42,
        leftMargin=42,
        topMargin=48,
        bottomMargin=48,
        title="SolarPlan energy report",
        author="SolarPlan",
    )
    width = A4[0] - 84
    body = ParagraphStyle(
        "Body",
        fontName="ReportSans",
        fontSize=9,
        leading=14,
        textColor=INK,
        spaceAfter=7,
        splitLongWords=True,
    )
    heading = ParagraphStyle(
        "Heading",
        parent=body,
        fontName="ReportSans-Bold",
        fontSize=16,
        leading=21,
        spaceBefore=16,
        spaceAfter=10,
        keepWithNext=True,
    )
    title = ParagraphStyle("Title", parent=heading, fontSize=27, leading=34)
    small = ParagraphStyle("Small", parent=body, fontSize=8, leading=12, textColor=SOFT)

    def p(value, style=body):
        return Paragraph(escape(str(value)).replace("\n", "<br/>"), style)

    def table(rows, widths, *, header=True):
        result = LongTable(
            [[p(cell) for cell in row] for row in rows],
            colWidths=widths,
            repeatRows=1 if header else 0,
            hAlign="LEFT",
        )
        commands = [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 9),
            ("RIGHTPADDING", (0, 0), (-1, -1), 9),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
        ]
        if header:
            commands.append(("BACKGROUND", (0, 0), (-1, 0), PAPER))
        result.setStyle(TableStyle(commands))
        return result

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(LINE)
        canvas.line(42, 34, A4[0] - 42, 34)
        canvas.setFont("ReportSans", 8)
        canvas.setFillColor(SOFT)
        canvas.drawString(42, 21, "SolarPlan | Preliminary energy analysis")
        canvas.drawRightString(A4[0] - 42, 21, f"Page {doc.page}")
        canvas.restoreState()

    story = [p("SolarPlan energy report", title), p(f"Calculated: {_date(simulation)}", small)]
    story += [
        p(f"Simulation: {simulation.id}", small),
        p(f"Project: {simulation.project_id}", small),
    ]
    location = simulation.input_snapshot.get("location", {})
    story += [p("Saved system", heading)]
    story += [
        table(
            [
                ["Location", location.get("location_label") or "Not recorded"],
                [
                    "Coordinates (latitude, longitude)",
                    f"{location.get('lat', 'Not recorded')}, {location.get('lon', 'Not recorded')}",
                ],
                [
                    "Source / provider",
                    f"{_source(simulation)} / PVGIS {simulation.provider_version}",
                ],
                ["Calculation method", simulation.method_version],
                ["System losses (included)", f"{simulation.system_loss_percent:g}%"],
            ],
            [width * 0.42, width * 0.58],
            header=False,
        )
    ]
    story += [
        p("Estimated production", heading),
        table(
            [
                ["Annual production", "Installed power", "Specific yield"],
                [
                    f"{simulation.annual_kwh:,.2f} kWh/year",
                    f"{simulation.installed_kwp:,.3f} kWp",
                    f"{simulation.specific_yield_kwh_per_kwp:,.2f} kWh/kWp",
                ],
            ],
            [width / 3] * 3,
        ),
    ]

    chart = Drawing(width, 150)
    maximum = max((item.energy_kwh for item in simulation.monthly_results), default=1) or 1
    step = width / 12
    for item in sorted(simulation.monthly_results, key=lambda item: item.month):
        x = (item.month - 1) * step + 8
        height = item.energy_kwh / maximum * 100
        chart.add(Rect(x, 24, step - 16, height, fillColor=INK, strokeColor=None))
        chart.add(
            String(
                x + (step - 16) / 2,
                9,
                calendar.month_abbr[item.month],
                fontName="ReportSans",
                fontSize=8,
                textAnchor="middle",
                fillColor=SOFT,
            )
        )
    story += [
        Spacer(1, 10),
        chart,
        p("Typical monthly production; exact kWh values follow.", small),
    ]
    story += [p("Scope and limitations", heading), p(SNAPSHOT_NOTE, small), p(LIMITATIONS, small)]
    story += [PageBreak(), p("Monthly production", heading)]
    story += [
        table(
            [["Month", "Estimated production (kWh)"]]
            + [
                [calendar.month_name[item.month], f"{item.energy_kwh:,.2f}"]
                for item in sorted(simulation.monthly_results, key=lambda item: item.month)
            ],
            [width * 0.5, width * 0.5],
        )
    ]
    story += [p(f"Saved roof surfaces ({len(simulation.surface_results)})", heading)]
    for surface in simulation.surface_results:
        saved = _surface_input(simulation, surface.roof_surface_id)
        panel = _panel(simulation, saved)
        panel_name = " ".join(str(panel.get(key) or "") for key in ("manufacturer", "model_sku"))
        story += [
            p(surface.name, heading),
            p(
                f"Panel: {panel_name.strip() or 'Not recorded'} | "
                f"Count: {saved.get('panel_count', 'Not recorded')} | "
                f"Module power: {panel.get('power_wp', 'Not recorded')} Wp",
                small,
            ),
        ]
        story += [
            table(
                [
                    ["Power / production", "Direction / tilt", "Specific yield"],
                    [
                        f"{surface.installed_kwp:,.3f} kWp / {surface.annual_kwh:,.2f} kWh/year",
                        f"{surface.azimuth_deg:g} deg / {surface.tilt_deg:g} deg",
                        f"{surface.specific_yield_kwh_per_kwp:,.2f} kWh/kWp",
                    ],
                ],
                [width * 0.4, width * 0.3, width * 0.3],
            )
        ]
    story += [
        Spacer(1, 12),
        p("Azimuth is measured clockwise from north (180 deg = south).", small),
    ]
    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()
