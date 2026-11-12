from app.repositories import workspace_repository
from app.schemas.project import ProjectRead
from app.services.energy_simulation_service import simulation_summary
from app.services.project_freshness import analysis_status


async def workspace(session, owner_id, project_id=None):
    projects, simulations = await workspace_repository.load_workspace(session, owner_id, project_id)
    items = [
        ProjectRead.model_validate(p).model_copy(
            update={"analysis_status": analysis_status(p, simulations.get(p.id))}
        )
        for p in projects
    ]
    latest = max(simulations.values(), key=lambda s: (s.created_at, str(s.id)), default=None)
    latest_analysis = None
    if latest:
        project = next(p for p in items if p.id == latest.project_id)
        latest_analysis = {
            **simulation_summary(latest).model_dump(mode="json"),
            "project_name": project.name,
            "analysis_status": project.analysis_status,
        }
    return {
        "projects": items,
        "latest_analysis": latest_analysis,
        "total_projects": len(items),
        "analyzed_projects": sum(p.analysis_status == "analyzed" for p in items),
        "in_progress": sum(
            p.analysis_status in ("in_progress", "needs_recalculation") for p in items
        ),
    }
