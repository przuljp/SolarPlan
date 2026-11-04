import { Link } from "react-router-dom";

import type { Project } from "../types/api";
import { ArrowIcon, PlusIcon, RoofIcon } from "./Icons";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(value),
  );
}

const projectStatus = {
  draft: { label: "Draft", complete: false },
  ready_for_analysis: { label: "Ready", complete: true },
  analyzed: { label: "Analyzed", complete: true },
} as const;

export function ProjectList({
  projects,
  emptyTitle = "No solar projects yet",
}: {
  projects: Project[];
  emptyTitle?: string;
}) {
  if (projects.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-illustration" aria-hidden="true"><RoofIcon /></span>
        <h2>{emptyTitle}</h2>
        <p>Create your first project to connect a real location, roof, and panel configuration.</p>
        <Link className="button button-primary" to="/projects/new"><PlusIcon />Create your first project</Link>
      </div>
    );
  }

  return (
    <div className="project-list">
      {projects.map((project, index) => {
        const status = projectStatus[project.status];
        return <Link className="project-row" to={`/projects/${project.id}`} key={project.id}>
          <span className="project-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <span className="project-main">
            <strong>{project.name}</strong>
            <small>{project.description || "No project description yet."}</small>
          </span>
          <span className="project-meta">
            <small>Updated</small>
            <span>{formatDate(project.updated_at)}</span>
          </span>
          <span className={`status-badge ${status.complete ? "status-complete" : ""}`}>{status.label}</span>
          <ArrowIcon className="row-arrow" />
        </Link>;
      })}
    </div>
  );
}
