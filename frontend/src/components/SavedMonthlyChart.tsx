import type { MonthlyEnergyResult } from "../types/api";

export const savedNumber = (value: unknown, digits = 0) => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "Unavailable";
export function annualDifference(older: number, newer: number) {
  if (!Number.isFinite(older) || !Number.isFinite(newer)) return null;
  const amount = newer - older;
  return { amount, percent: older === 0 ? null : amount / older * 100 };
}
const months = Array.from({ length: 12 }, (_, i) => new Date(2026, i).toLocaleString("en-GB", { month: "long" }));
function complete(values: MonthlyEnergyResult[]) {
  return months.every((_, i) => values.filter(v => v.month === i + 1 && Number.isFinite(v.energy_kwh) && v.energy_kwh >= 0).length === 1);
}
export function SavedMonthlyChart({ older = [], newer, olderLabel = "Older simulation", newerLabel = "Newer simulation" }: { older?: MonthlyEnergyResult[]; newer?: MonthlyEnergyResult[]; olderLabel?: string; newerLabel?: string }) {
  const paired = newer !== undefined;
  if (!complete(older) || (paired && !complete(newer))) return <p className="saved-monthly-unavailable">Complete saved monthly production is unavailable for {paired ? "one or both simulations" : "this simulation"}. No new PVGIS calculation has been requested.</p>;
  const values = months.map((name, i) => ({ name, older: older.find(v => v.month === i + 1)!.energy_kwh, newer: newer?.find(v => v.month === i + 1)?.energy_kwh }));
  const max = Math.max(1, ...values.flatMap(v => [v.older, v.newer ?? 0]));
  return <>
    <div className="saved-chart-legend"><span><i />{olderLabel}</span>{paired && <span><i />{newerLabel}</span>}</div>
    <figure className="saved-monthly-chart">
      <div className="saved-chart-scroll"><div className="saved-chart-plot"><div className="saved-chart-axis"><span>{savedNumber(max)} kWh</span><span>{savedNumber(max / 2)}</span><span>0</span></div><div className="saved-chart-months">
        {values.map(v => <div className="saved-chart-month" key={v.name}><div className="saved-chart-pair" tabIndex={0} aria-label={`${v.name}: ${olderLabel} ${savedNumber(v.older)} kWh${paired ? `; ${newerLabel} ${savedNumber(v.newer)} kWh` : ""}`}>
          <i style={{height:`${v.older / max * 100}%`}} />{paired && <i style={{height:`${(v.newer ?? 0) / max * 100}%`}} />}
          <span className="saved-chart-tooltip">{v.name}<br />{olderLabel}: {savedNumber(v.older)} kWh{paired && <><br />{newerLabel}: {savedNumber(v.newer)} kWh</>}</span>
        </div><span>{v.name.slice(0,3)}</span></div>)}
      </div></div></div>
      <figcaption>Saved monthly PVGIS production in kWh. Scroll the chart on small screens or open the data table.</figcaption>
    </figure>
    <details className="saved-chart-table"><summary>View monthly values as a table</summary><div className="table-scroll"><table><thead><tr><th scope="col">Month</th><th scope="col">{olderLabel} (kWh)</th>{paired && <th scope="col">{newerLabel} (kWh)</th>}</tr></thead><tbody>{values.map(v => <tr key={v.name}><th scope="row">{v.name}</th><td>{savedNumber(v.older)}</td>{paired && <td>{savedNumber(v.newer)}</td>}</tr>)}</tbody></table></div></details>
  </>;
}
