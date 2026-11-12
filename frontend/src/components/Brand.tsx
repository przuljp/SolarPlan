import { Link } from "react-router-dom";

export function Brand({ compact = false, to }: { compact?: boolean; to?: string }) {
  return (
    <Link className="brand" to={to ?? (compact ? "/dashboard" : "/")} aria-label="SolarPlan home">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span><strong>Solar</strong>Plan</span>
    </Link>
  );
}
