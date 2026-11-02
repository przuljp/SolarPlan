import { useMutation } from "@tanstack/react-query";
import { useState, type KeyboardEvent } from "react";

import { api, ApiError } from "../lib/api";
import type { GeocodingResult } from "../types/api";
import { LocationMap, type Coordinates } from "./LocationMap";

type LocationPickerProps = {
  latitude: string;
  longitude: string;
  onLocationChange: (
    latitude: number,
    longitude: number,
    label?: string,
  ) => void;
};

function parsePosition(
  latitudeValue: string,
  longitudeValue: string,
): Coordinates | null {
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (
    latitudeValue.trim() === "" ||
    longitudeValue.trim() === "" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  return { latitude, longitude };
}

export function LocationPicker({
  latitude,
  longitude,
  onLocationChange,
}: LocationPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [feedback, setFeedback] = useState("");

  const search = useMutation({
    mutationFn: (locationQuery: string) => api.searchLocations(locationQuery),
    onSuccess: (locations) => {
      setResults(locations);
      setFeedback(
        locations.length === 0
          ? "No locations matched that search. Try a city, street, or postal code."
          : "",
      );
    },
    onError: (caught) => {
      setResults([]);
      setFeedback(
        caught instanceof ApiError
          ? caught.message
          : "Location search is unavailable. Enter coordinates manually.",
      );
    },
  });

  const reverse = useMutation({
    mutationFn: (coordinates: Coordinates) =>
      api.reverseLocation(coordinates.latitude, coordinates.longitude),
    onSuccess: (location, coordinates) => {
      onLocationChange(
        coordinates.latitude,
        coordinates.longitude,
        location.display_name,
      );
    },
    onError: () => {
      setFeedback(
        "The point was selected, but no address was found. You can add a label manually.",
      );
    },
  });

  function runSearch() {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setFeedback("Enter at least two characters before searching.");
      return;
    }
    setFeedback("");
    search.mutate(normalizedQuery);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    runSearch();
  }

  function selectResult(result: GeocodingResult) {
    onLocationChange(
      result.latitude,
      result.longitude,
      result.display_name,
    );
    setQuery(result.display_name);
    setResults([]);
    setFeedback("");
  }

  function selectMapPosition(coordinates: Coordinates) {
    const rounded = {
      latitude: Number(coordinates.latitude.toFixed(6)),
      longitude: Number(coordinates.longitude.toFixed(6)),
    };
    onLocationChange(rounded.latitude, rounded.longitude);
    setResults([]);
    setFeedback("");
    reverse.mutate(rounded);
  }

  const position = parsePosition(latitude, longitude);

  return (
    <div className="location-picker">
      <div className="location-search">
        <label htmlFor="location-search">Search for a place or address</label>
        <div className="location-search-row">
          <input
            id="location-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            maxLength={200}
            placeholder="e.g. Sarajevo or Hamze Hume 8"
            autoComplete="off"
          />
          <button
            className="button button-secondary"
            type="button"
            onClick={runSearch}
            disabled={search.isPending}
          >
            {search.isPending ? "Searching." : "Search location"}
          </button>
        </div>
        <small>Search runs only when you press the button or Enter.</small>
      </div>

      {feedback && (
        <div className="location-feedback" role="status">{feedback}</div>
      )}
      {results.length > 0 && (
        <ul className="location-results" aria-label="Location search results">
          {results.map((result) => (
            <li key={`${result.latitude}:${result.longitude}:${result.display_name}`}>
              <button type="button" onClick={() => selectResult(result)}>
                <span>{result.display_name}</span>
                <small>
                  {result.latitude.toFixed(5)}, {result.longitude.toFixed(5)}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}

      <LocationMap
        position={position}
        onPositionChange={selectMapPosition}
      />
      {reverse.isPending && (
        <p className="map-status" role="status">
          Looking up the selected address.
        </p>
      )}
    </div>
  );
}
