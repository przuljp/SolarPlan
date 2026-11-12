import type { Project } from "../types/api";
export const statusLabels = { not_started:"Not started", in_progress:"In progress", analyzed:"Analyzed", needs_recalculation:"Needs recalculation" };
export function projectStatus(project: Project) { return project.analysis_status ?? "in_progress"; }
