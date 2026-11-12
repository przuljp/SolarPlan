import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowIcon, PlusIcon, RoofIcon } from "../components/Icons";
import { api } from "../lib/api";
import { projectStatus, statusLabels } from "../lib/project-status";
import type { Project, Workspace } from "../types/api";
const date = (value:string) => new Date(value).toLocaleDateString("en-GB", {day:"numeric",month:"short",year:"numeric"});
function WorkspaceProjects({ projects }: {projects:Project[]}) {
  return <section className="content-panel workspace-projects"><header><h2>Your projects</h2><Link className="text-link" to="/projects">View all</Link></header>
    <ul>{projects.slice(0,4).map(project=><li key={project.id}><Link to={`/projects/${project.id}`}><div><strong>{project.name}</strong>{project.description && <p>{project.description}</p>}<small>Updated {date(project.updated_at)}</small></div><span className={`status-badge ${projectStatus(project)==="analyzed" ? "status-complete" : ""}`}>{statusLabels[projectStatus(project)]}</span><ArrowIcon /></Link></li>)}</ul>
  </section>;
}
function LatestAnalysis({ data }: {data:Workspace}) {
  const latest=data.latest_analysis;
  return <aside className="content-panel workspace-latest"><h2>Latest analysis</h2>{latest ? <>
    <Link className="workspace-analysis-project" to={`/projects/${latest.project_id}`}>{latest.project_name}</Link><p className="workspace-analysis-date">Saved {date(latest.created_at)}</p>
    {latest.analysis_status !== "analyzed" && <p className="workspace-stale">Previous configuration — recalculate after reviewing your current roof plan.</p>}
    <dl><div className="workspace-latest-production"><dt>Estimated annual production</dt><dd>{latest.annual_kwh.toLocaleString("en-GB",{maximumFractionDigits:0})} <small>kWh/year</small></dd></div><div><dt>Installed capacity</dt><dd>{latest.installed_kwp.toFixed(2)} <small>kWp</small></dd></div><div><dt>Number of panels</dt><dd>{latest.panel_count}</dd></div></dl>
    <Link className="button button-secondary" to={`/projects/${latest.project_id}/simulations/${latest.id}`}>View analysis <ArrowIcon /></Link>
  </> : <div className="workspace-no-analysis"><p>No saved analysis yet.</p><p>Complete your project location, roof surfaces and panel layouts to explore its energy potential.</p><Link className="button button-secondary" to={`/projects/${data.projects[0].id}`}>Continue project <ArrowIcon /></Link></div>}</aside>;
}
export function DashboardPage() {
 const workspace=useQuery({queryKey:["projects","workspace"],queryFn:api.workspace});
 return <main className="workspace-page dashboard-workspace"><header className="workspace-heading"><div><h1>Your solar workspace</h1><p>Manage your solar projects and explore their energy potential.</p></div><Link className="button button-primary" to="/projects/new"><PlusIcon />New project</Link></header>
 {workspace.isPending && <ProjectListSkeleton/>}
 {workspace.isError && <QueryError onRetry={()=>workspace.refetch()}/>}
 {workspace.data && (workspace.data.projects.length ? <>
   <dl className="workspace-statistics"><div><dt>Total projects</dt><dd>{workspace.data.total_projects}</dd></div><div><dt>Analyzed projects</dt><dd>{workspace.data.analyzed_projects}</dd></div><div><dt>In progress</dt><dd>{workspace.data.in_progress}</dd></div></dl>
   <div className="workspace-dashboard-grid"><WorkspaceProjects projects={workspace.data.projects}/><LatestAnalysis data={workspace.data}/></div>
 </> : <section className="content-panel workspace-first-project"><RoofIcon/><h2>Start your first solar project</h2><p>Explore how much solar energy your property could generate.</p><Link className="button button-primary" to="/projects/new">Create first project</Link><ol><li>Choose your location.</li><li>Describe your roof and select panels.</li><li>Analyze and compare energy production.</li></ol></section>)}
 </main>;
}
export function ProjectListSkeleton() { return <div className="skeleton-list" role="status"><span className="sr-only">Loading projects…</span>{Array.from({length:3},(_,i)=><span key={i} aria-hidden="true"/>)}</div>; }
export function QueryError({onRetry}:{onRetry:()=>void}) {return <div className="query-error" role="alert"><div><strong>We could not load your projects.</strong><p>Check the connection and try again.</p></div><button className="button button-secondary" onClick={onRetry}>Try again</button></div>;}
