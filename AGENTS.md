# SolarPlan — Codex Instructions

## Project Overview
SolarPlan is a user-focused web application for planning residential solar panel systems and analyzing potential energy production.

Stack:
- Backend: FastAPI, SQLAlchemy, PostgreSQL
- Frontend: React
- External integrations: PVGIS, Open-Meteo, mapping services
- Optional AI integration: OpenAI API

## Architecture
- Follow the existing DAO → Service → Router architecture.
- Keep database operations in the DAO layer.
- Keep business logic in the Service layer.
- Keep API endpoints thin.
- Reuse existing schemas, dependencies and authentication patterns.
- Follow established project conventions before introducing new patterns.

## Scope
- The application currently has no admin role.
- Prioritize user-facing functionality.
- Focus on energy analysis, not financial ROI.
- Do not implement advanced satellite roof polygon detection or LiDAR features unless explicitly requested.

## Token Efficiency
- Inspect relevant files before modifying code.
- Prefer targeted searches over reading entire directories.
- Read only files needed for the current task.
- Avoid repeatedly reading unchanged files.
- Keep tool output concise.
- Do not print entire files unless necessary.
- Do not generate lengthy explanations or documentation unless requested.

## Development Rules
- Implement only the requested functionality.
- Do not refactor unrelated code.
- Avoid unnecessary dependencies and abstractions.
- Preserve existing behavior and API compatibility.
- Never expose secrets, credentials or API keys.
- Do not change database schemas without explaining migration implications.
- Ask for clarification when a decision would significantly affect architecture or requirements.

## Testing
- Run focused tests for affected functionality.
- Run broader tests when changes impact shared components.
- Fix failures caused by the implementation.
- Do not silently ignore failing tests.

## Response Format
After implementation, provide:
1. Short summary of changes.
2. Modified files.
3. Tests executed and results.
4. Remaining issues, if any.

Keep the final response concise.