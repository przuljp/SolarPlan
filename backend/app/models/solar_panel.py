from datetime import date

from sqlalchemy import CheckConstraint, Date, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class SolarPanel(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """A verified commercial module available through a Bosnia and Herzegovina seller."""

    __tablename__ = "solar_panels"
    __table_args__ = (
        CheckConstraint("power_wp > 0", name="ck_solar_panels_power_positive"),
        CheckConstraint(
            "width_mm > 0 AND length_mm > 0 AND thickness_mm > 0",
            name="ck_solar_panels_dimensions_positive",
        ),
        CheckConstraint(
            "efficiency_percent > 0 AND efficiency_percent <= 100",
            name="ck_solar_panels_efficiency_range",
        ),
    )

    manufacturer: Mapped[str] = mapped_column(String(100), nullable=False)
    model_sku: Mapped[str] = mapped_column(String(160), nullable=False, unique=True)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    power_wp: Mapped[int] = mapped_column(Integer, nullable=False)
    width_mm: Mapped[int] = mapped_column(Integer, nullable=False)
    length_mm: Mapped[int] = mapped_column(Integer, nullable=False)
    thickness_mm: Mapped[int] = mapped_column(Integer, nullable=False)
    efficiency_percent: Mapped[float] = mapped_column(Float, nullable=False)
    cell_technology: Mapped[str] = mapped_column(String(180), nullable=False)
    temperature_coefficient_pmax: Mapped[float] = mapped_column(Float, nullable=False)
    datasheet_url: Mapped[str] = mapped_column(Text, nullable=False)
    bih_source_name: Mapped[str] = mapped_column(String(160), nullable=False)
    bih_source_url: Mapped[str] = mapped_column(Text, nullable=False)
    verified_at: Mapped[date] = mapped_column(Date, nullable=False)
