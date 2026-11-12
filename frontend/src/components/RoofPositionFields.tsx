const directions = [
  { code: "N", name: "North", degrees: 0 },
  { code: "NE", name: "Northeast", degrees: 45 },
  { code: "E", name: "East", degrees: 90 },
  { code: "SE", name: "Southeast", degrees: 135 },
  { code: "S", name: "South", degrees: 180 },
  { code: "SW", name: "Southwest", degrees: 225 },
  { code: "W", name: "West", degrees: 270 },
  { code: "NW", name: "Northwest", degrees: 315 },
] as const;

const slopes = [
  { name: "Flat roof", degrees: 3, description: "An almost level roof surface", ridge: 47 },
  { name: "Gentle slope", degrees: 20, description: "A roof with a modest slope", ridge: 34 },
  { name: "Steep slope", degrees: 40, description: "A roof with a pronounced slope", ridge: 14 },
] as const;

type Props = {
  azimuth: string;
  tilt: string;
  savedAzimuth?: number;
  savedTilt?: number;
  onAzimuthChange: (value: string) => void;
  onTiltChange: (value: string) => void;
};

export function RoofPositionFields({ azimuth, tilt, savedAzimuth, savedTilt, onAzimuthChange, onTiltChange }: Props) {
  const customAzimuth = savedAzimuth !== undefined && !directions.some((item) => item.degrees === savedAzimuth);
  const customTilt = savedTilt !== undefined && !slopes.some((item) => item.degrees === savedTilt);

  return <>
    <fieldset className="form-section roof-position-section" aria-describedby="roof-direction-help">
      <legend>Which way does this roof surface face?</legend>
      <p className="section-copy" id="roof-direction-help">Choose the direction this roof surface slopes toward. Each surface can face a different direction.</p>
      <div className="roof-direction-options">
        {directions.map((direction) => <label className={`roof-choice ${azimuth === String(direction.degrees) ? "is-selected" : ""}`} key={direction.code}>
          <input type="radio" name="roof-direction" aria-label={`${direction.code} — ${direction.name}`} value={direction.degrees} checked={azimuth === String(direction.degrees)} onChange={() => onAzimuthChange(String(direction.degrees))} required />
          <span><strong>{direction.code}</strong><span>{direction.name}</span><small>{direction.degrees}°</small></span>
        </label>)}
      </div>
      {customAzimuth && <label className={`roof-choice roof-saved-choice ${azimuth === String(savedAzimuth) ? "is-selected" : ""}`}>
        <input type="radio" name="roof-direction" aria-label={`Previously saved direction: ${savedAzimuth}°`} checked={azimuth === String(savedAzimuth)} onChange={() => onAzimuthChange(String(savedAzimuth))} required />
        <span><strong>Previously saved direction: {savedAzimuth}°</strong><small>Kept exactly as saved unless you choose a different direction.</small></span>
      </label>}
    </fieldset>

    <fieldset className="form-section roof-position-section" aria-describedby="roof-slope-help">
      <legend>How steep is this roof surface?</legend>
      <p className="section-copy" id="roof-slope-help">Choose the closest shape. These angles are estimates, not measurements. Your choice affects estimated electricity production.</p>
      <div className="roof-slope-options">
        {slopes.map((slope) => <label className={`roof-choice roof-slope-choice ${tilt === String(slope.degrees) ? "is-selected" : ""}`} key={slope.name}>
          <input type="radio" name="roof-slope" aria-label={`${slope.name} — estimated ${slope.degrees}°`} value={slope.degrees} checked={tilt === String(slope.degrees)} onChange={() => onTiltChange(String(slope.degrees))} required />
          <span>
            <svg className="roof-slope-illustration" viewBox="0 0 120 80" aria-hidden="true" focusable="false">
              <path className="roof-slope-wall" d="M18 51V72H102V51" />
              <path className="roof-slope-plane" d={`M10 51L60 ${slope.ridge}L110 51`} />
              <path className="roof-slope-ground" d="M8 73H112" />
            </svg>
            <strong>{slope.name}</strong><span className="roof-slope-estimate">Estimated {slope.degrees}°</span><small>{slope.description}</small>
          </span>
        </label>)}
      </div>
      {customTilt && <label className={`roof-choice roof-saved-choice ${tilt === String(savedTilt) ? "is-selected" : ""}`}>
        <input type="radio" name="roof-slope" aria-label={`Previously saved slope: ${savedTilt}°`} checked={tilt === String(savedTilt)} onChange={() => onTiltChange(String(savedTilt))} required />
        <span><strong>Previously saved slope: {savedTilt}°</strong><small>Kept exactly as saved unless you choose a different slope.</small></span>
      </label>}
    </fieldset>
  </>;
}
