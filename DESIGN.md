---
name: SolarPlan
description: A clear energy workspace shaped with the precision of a residential roof survey sheet.
colors:
  survey-ink: "#153d45"
  survey-ink-soft: "#536d71"
  warm-paper: "#fffdf8"
  warm-ground: "#f2f1eb"
  survey-line: "#cad6d2"
  survey-line-strong: "#9db1ad"
  action-copper: "#a94724"
  action-copper-dark: "#8c3519"
  survey-sun: "#e5a13b"
  field-teal: "#dfeae6"
  danger-red: "#a53c36"
  danger-paper: "#fff9f7"
typography:
  display: { fontFamily: "Newsreader, Georgia, serif", fontSize: "clamp(3.5rem, 6.5vw, 5.65rem)", fontWeight: 500, lineHeight: 0.96, letterSpacing: "-0.04em" }
  headline: { fontFamily: "Newsreader, Georgia, serif", fontSize: "clamp(2.4rem, 4vw, 4.25rem)", fontWeight: 500, lineHeight: 1.02, letterSpacing: "-0.035em" }
  title: { fontFamily: "Newsreader, Georgia, serif", fontSize: "1.45rem", fontWeight: 600, lineHeight: 1.12 }
  body: { fontFamily: "Aptos, Segoe UI, sans-serif", fontSize: "1rem", fontWeight: 400, lineHeight: 1.65 }
  label: { fontFamily: "Aptos, Segoe UI, sans-serif", fontSize: "0.79rem", fontWeight: 750, lineHeight: 1.4, letterSpacing: "0.04em" }
  technical: { fontFamily: "Cascadia Mono, Consolas, monospace", fontSize: "0.79rem", fontWeight: 400, lineHeight: 1.4 }
rounded: { control-sm: "0.3rem", field: "0.42rem", control: "0.5rem", pill: "99px" }
spacing: { hairline-gap: "0.35rem", compact: "0.65rem", control-x: "1.15rem", panel: "1.7rem", page: "clamp(2rem, 4.5vw, 4.5rem)" }
components:
  button-primary: { backgroundColor: "{colors.action-copper}", textColor: "{colors.warm-paper}", typography: "{typography.label}", rounded: "{rounded.control}", padding: "0.78rem 1.15rem", height: "3rem" }
  button-secondary: { backgroundColor: "transparent", textColor: "{colors.survey-ink}", typography: "{typography.label}", rounded: "{rounded.control}", padding: "0.78rem 1.15rem", height: "3rem" }
  input: { backgroundColor: "#ffffff", textColor: "{colors.survey-ink}", typography: "{typography.body}", rounded: "{rounded.field}", padding: "0.76rem 0.9rem", height: "3.2rem" }
  card: { backgroundColor: "{colors.warm-paper}", textColor: "{colors.survey-ink}", rounded: "0", padding: "{spacing.panel}" }
  status-badge: { backgroundColor: "#fff5e4", textColor: "#815020", typography: "{typography.label}", rounded: "{rounded.pill}", padding: "0.4rem 0.62rem" }
---

# Design System: SolarPlan

## Overview

**Creative North Star: "The Clear Energy Survey"**

SolarPlan combines the familiarity of a practical household workspace with the exactness of a field survey sheet. Warm paper and deep teal ink make technical choices approachable; hairlines, measured labels, tabular figures, and roof geometry ground estimates in observable inputs.

Newsreader gives explanations a human editorial voice while Aptos or Segoe UI keeps controls familiar. Burnt orange is reserved for consequential actions. The skewed roof diagram is the identity-bearing move: an assessor's worksheet, never generic green-tech decoration.

**Key Characteristics:**

- Warm paper on a quiet mineral ground.
- Deep teal navigation and ink with strong contrast.
- Editorial serif headings with practical sans-serif controls.
- Fine rules, visible units, and tabular figures.
- Roof-survey geometry used selectively as the signature.

## Colors

The palette is architectural and sun-warmed: teal carries trust and structure, copper signals action, and off-whites keep technical work humane.

### Primary
- **Action Copper:** Primary buttons, important links, measurement callouts, and next steps.
- **Deep Action Copper:** Hover states and high-contrast inline actions.

### Secondary
- **Survey Ink:** Principal ink, navigation field, outlines, and focus.
- **Field Teal:** Instructional guides, diagrams, and empty-state illustrations.

### Tertiary
- **Survey Sun:** A scarce highlight inside dark brand contexts, not a general action color.

### Neutral
- **Warm Paper / Warm Ground:** Reading surfaces and workspace background.
- **Soft Survey Ink:** Supporting copy, metadata, and placeholders.
- **Survey Line / Strong Survey Line:** Dividers, panels, inputs, and diagram frames.
- **Danger Red / Danger Paper:** Destructive actions and recoverable errors.

**The Copper Rarity Rule.** Copper marks decisions and direction; never spread it across passive surfaces.

**The Ink Carries Structure Rule.** Use Survey Ink—not black—for type, navigation, diagram frames, and focus outlines.

## Typography

**Display Font:** Newsreader (Georgia fallback)  
**Body Font:** Aptos (Segoe UI and sans-serif fallbacks)  
**Technical Font:** Cascadia Mono (Consolas and monospace fallbacks)

**Character:** Newsreader brings measured editorial warmth; the system sans-serif keeps workflows plainspoken. Monospace is limited to identifiers and machine-shaped values.

### Hierarchy
- **Display** (500, fluid 3.5–5.65rem, 0.96): Short landing and authentication statements.
- **Headline** (500, fluid 2.4–4.25rem, 1.02): Workspace and project page titles.
- **Title** (600, 1.45rem, 1.12): Panel headings.
- **Body** (400, 1rem, 1.65): Explanations and form context, usually no wider than 65ch.
- **Label** (700–800, about 0.79rem): Controls, metadata, measurements, and statuses.
- **Technical** (400, about 0.79rem, tabular figures): IDs and aligned values.

**The Two Voices Rule.** Newsreader explains and frames; Aptos or Segoe UI operates. Never use serif for inputs, buttons, lists, or navigation.

**The Units Stay Visible Rule.** Keep units beside values and use tabular numerals where figures are compared.

## Layout

Public pages use a centered 1240px container and a two-column hero with explanation left and roof evidence right. Below 1000px the hero stacks; below 720px margins reduce to 1rem and supporting data reflows.

The workspace uses a 255px sidebar and a fluid content column capped at 1280px. Working surfaces use 1.5rem gaps and 1.7rem padding; forms stay near 700px and prose near 65ch. At 720px, the sidebar becomes a sticky paper header plus fixed three-item bottom navigation; actions stack and secondary row metadata yields.

**The Survey Rhythm Rule.** Major groups breathe in 1.5–2rem intervals; related labels and controls stay within 0.35–0.8rem.

## Elevation & Depth

The system is flat by default and uses borders before shadow. Paper panels get low ambient separation; stronger lift belongs to the roof survey and focused forms. Hover lift becomes color-only feedback under reduced motion.

### Shadow Vocabulary
- **Paper Lift** (`0 12px 30px rgba(21, 61, 69, 0.05)`): Standard panels.
- **Survey Lift** (`0 18px 45px rgba(21, 61, 69, 0.09)`): Roof surveys and focused forms.
- **Action Lift** (`0 8px 20px rgba(159, 69, 35, 0.2)`): Primary buttons.
- **Focus Halo** (`0 0 0 6px #fffdf8`): Isolation around the 3px teal outline.

**The Hairline Before Shadow Rule.** Borders and tonal fields define structure; elevation only supports it.

## Shapes

Cards and diagram sheets stay square. Controls use compact 0.3–0.5rem radii; badges and avatars may be fully rounded. Fine rules, dashed placeholders, registration marks, and a -3° roof-plane skew create the measured-sheet identity.

**The Square Sheet Rule.** Rounded corners belong to controls, badges, and account elements—not primary containers.

**The Roof Geometry Rule.** Reserve skewed rectangles, panel grids, dimension tags, and crop marks for roof or survey meaning.

## Components

### Buttons
- **Shape:** Compact 0.5rem radius, 3rem minimum height, 700–800 weight.
- **Primary:** Warm Paper on Action Copper with 0.78rem × 1.15rem padding.
- **Hover / Focus:** Deepen, lift 2px, and retain the teal-and-paper halo. Disabled controls remain labeled at 58% opacity.
- **Secondary / Danger:** Transparent strong-line secondary; Danger Red on Danger Paper only for destructive actions.

### Chips
- **Style:** Pale solar wash, warm brown text, fine amber border, compact padding, full pill.
- **State:** Describe workflow state; never use as decoration.

### Cards / Containers
- **Corner Style:** Square, like survey sheets.
- **Background:** Warm Paper for work; Field Teal for instruction.
- **Shadow Strategy:** Paper Lift normally; Survey Lift only for signature diagrams and focused forms.
- **Border / Padding:** 1px Survey Line and 1.7rem desktop padding, reducing on mobile.

### Inputs / Fields
- **Style:** White, strong-line border, 0.42rem radius, visible label, and plain-language help.
- **Focus:** Action Copper border with a translucent copper ring; keyboard focus stays unmistakable.
- **Error / Disabled:** Danger palette with actionable recovery; preserve entered values when possible.

### Navigation
Desktop uses a deep-teal rail with muted light labels and a pale active item. Mobile uses a sticky paper header and fixed three-item bottom bar with copper active emphasis. Identity and logout remain explicit at both sizes.

### Roof Survey Diagram
The signature square-edged sheet contains a skewed roof plane, dark teal modules, dimension labels, and a compact results register. Labels must be real and units visible.

### Project Rows and Loading States
Rows read like a register: index, truncated title, date, status, direction. Skeletons reserve height and expose accessible live status; reduced motion resolves their breathing immediately.

## Do's and Don'ts

### Do:
- **Do** explain solar terms beside the control or result and keep units visible.
- **Do** organize with paper, fine rules, and spacing before elevation.
- **Do** reserve Copper for decisions, direction, and measured callouts.
- **Do** preserve the serif/sans division between explanation and operation.
- **Do** keep focus, loading labels, recovery, mobile login/logout, and reduced motion explicit.
- **Do** use roof geometry as precise, content-bearing identity.

### Don't:
- **Don't** present estimates as guarantees, verified savings, or engineering approval.
- **Don't** substitute generic green gradients or glossy solar imagery for evidence.
- **Don't** round paper panels into soft app tiles or let shadows become the main separator.
- **Don't** scatter Copper, Sun, or skewed geometry across passive decoration.
- **Don't** hide labels, assumptions, units, or important metadata behind hover.
- **Don't** squeeze the desktop roof canvas onto mobile without reflowing it.
