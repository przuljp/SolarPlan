import type { RoofSurfaceShape } from "../types/api";

export function RoofShapeChoices({ shape, onChange }: { shape: RoofSurfaceShape; onChange: (shape: RoofSurfaceShape) => void }) {
  return <div className="roof-shape-options" role="radiogroup" aria-label="Roof surface shape">
    {([
      { value: "rectangle", name: "Rectangle", description: "Equal top and bottom widths.", points: "25,14 95,14 95,78 25,78" },
      { value: "trapezoid", name: "Trapezoid", description: "Narrower at the top.", points: "39,14 81,14 105,78 15,78" },
    ] as const).map((option) => <label className={`roof-choice roof-shape-choice ${shape === option.value ? "is-selected" : ""}`} key={option.value}>
      <input type="radio" name="shape" aria-label={option.name} checked={shape === option.value} onChange={() => onChange(option.value)} />
      <span>
        <svg className="roof-shape-illustration" viewBox="0 0 120 92" aria-hidden="true" focusable="false">
          <polygon points={option.points} />
          <path d={option.value === "rectangle" ? "M21 7H99M105 14V78" : "M35 7H85M113 16V77"} />
        </svg>
        <strong>{option.name}</strong>
        <small>{option.description}</small>
      </span>
    </label>)}
  </div>;
}
