# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

SolarPlan is primarily for registered owners of houses, holiday homes, and other small properties in Bosnia and Herzegovina who want to evaluate a residential photovoltaic system. Users are not expected to have prior solar-energy or electrical-engineering expertise. Public visitors may access the landing page, registration, and login; project analysis requires authentication.

## Product Purpose

SolarPlan helps a user understand what solar-panel configuration can physically fit on a specific roof, how much energy it could approximately produce, and how that production compares with household electricity consumption. Success means the user can complete this evaluation independently and understand the assumptions behind the result.

## Positioning

The product combines documented real panel models, a transparent rectangular-roof layout, PVGIS production estimates, weather context, and household consumption in one explainable energy-planning workflow. It is an educational preliminary analysis tool, not a financial calculator or official electrical-design document.

## Operating Context

The core workflow is: create an account, create a project, choose a location, describe the roof, select a documented panel model, review the generated two-dimensional layout, enter optional consumption data, run an energy analysis, compare configurations, and save simulation history. A new project uses a guided wizard; an analysed project uses a dashboard with project navigation.

## Capabilities and Constraints

- The only business role is a registered end user, and every private resource is owner-scoped.
- The application language is English.
- Expert terminology is allowed when paired with plain-language explanations and explicit units such as kWp, kWh, m², degrees, and percent.
- Desktop is primary for the two-dimensional roof planner, with a functional responsive mobile experience.
- Version 1 focuses on energy and technical estimates. It excludes pricing, installation cost, return on investment, financial savings, batteries, three-dimensional modelling, automatic roof detection, precise shading, structural checks, inverter selection, and official engineering documentation.
- Artificial intelligence may explain results and assist workflows, but it is not the source of numerical energy calculations.

## Brand Commitments

The product name is SolarPlan. Product copy should be calm, transparent, educational, and honest about estimates and limitations. The interface must not imply guaranteed production or professional engineering approval.

## Evidence on Hand

The private master specification is the source of truth for scope, routes, acceptance criteria, architecture, and the planned end-to-end workflow. It must not be published to the GitHub repository. No testimonials, customer logos, production benchmarks, verified savings claims, or final brand assets currently exist; future work must not fabricate them.

## Product Principles

1. Explain the result, not only the number.
2. Keep technical assumptions and measurement units visible.
3. Guide non-experts through one understandable decision at a time.
4. Distinguish estimates from verified facts and never invent evidence.
5. Preserve privacy and ownership boundaries across every project workflow.

## Accessibility & Inclusion

Forms must use visible labels, clear validation and recovery messages, keyboard-accessible controls, strong contrast, and meaningful focus states. Charts must provide a textual or tabular alternative. The interface must remain understandable without prior photovoltaic-system knowledge.
