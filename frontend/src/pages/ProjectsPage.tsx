import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { PlusIcon } from "../components/Icons";
import { ProjectList } from "../components/ProjectList";
import { api } from "../lib/api";
import { ProjectListSkeleton, QueryError } from "./DashboardPage";

export function ProjectsPage() {
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects });

  return (
    <main className="workspace-page">
      <header className="workspace-heading">
        <div><h1>Your solar projects</h1><p>Each property keeps its inputs, configurations, and saved results separate.</p></div>
        <Link className="button button-primary" to="/projects/new"><PlusIcon />New project</Link>
      </header>
      <section className="content-panel project-panel">
        <div className="panel-heading">
          <div><h2>All projects</h2><p>{projects.data ? `${projects.data.length} total` : "Loading project count…"}</p></div>
        </div>
        {projects.isPending && <ProjectListSkeleton />}
        {projects.isError && <QueryError onRetry={() => projects.refetch()} />}
        {projects.data && <ProjectList projects={projects.data} />}
      </section>
    </main>
  );
}
