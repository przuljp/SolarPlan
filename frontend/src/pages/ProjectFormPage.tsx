import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ArrowIcon } from "../components/Icons";
import { api, ApiError } from "../lib/api";

export function ProjectFormPage({ mode }: { mode: "create" | "edit" }) {
  const isEdit = mode === "edit";
  const { projectId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const project = useQuery({
    queryKey: ["projects", projectId],
    queryFn: () => api.project(projectId!),
    enabled: isEdit && Boolean(projectId),
  });

  useEffect(() => {
    if (project.data) {
      setName(project.data.name);
      setDescription(project.data.description ?? "");
    }
  }, [project.data]);

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? api.updateProject(projectId!, { name, description: description || null })
        : api.createProject({ name, description: description || null }),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate(`/projects/${saved.id}`);
    },
    onError: (caught) => {
      setError(caught instanceof ApiError ? caught.message : "The project could not be saved.");
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    mutation.mutate();
  }

  if (project.isPending && isEdit) return <main className="workspace-page"><div className="form-page-skeleton" /></main>;
  if (project.isError && isEdit) return <main className="workspace-page"><div className="query-error"><strong>Project not found.</strong><Link to="/projects">Return to projects</Link></div></main>;

  return (
    <main className="workspace-page narrow-page">
      <Link className="back-link" to={isEdit && projectId ? `/projects/${projectId}` : "/projects"}>← Back to {isEdit ? "project" : "projects"}</Link>
      <header className="form-page-heading">
        <h1>{isEdit ? "Edit the project basics." : "Start with the property you want to assess."}</h1>
        <p>A clear name helps you recognise this project later. Roof and location details come next.</p>
      </header>
      <form className="project-form" onSubmit={submit}>
        {error && <div className="form-error" role="alert">{error}</div>}
        <label>
          Project name
          <input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={160} placeholder="e.g. Family house Sarajevo" autoFocus required />
          <small>Use the property or location name you will recognise.</small>
        </label>
        <label>
          Description <span className="optional">Optional</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={5} placeholder="Add a short note about the property or your assessment goal." />
        </label>
        <div className="form-actions">
          <Link className="button button-secondary" to={isEdit && projectId ? `/projects/${projectId}` : "/projects"}>Cancel</Link>
          <button className="button button-primary" type="submit" disabled={mutation.isPending || name.trim().length < 2}>
            {mutation.isPending ? <><span className="button-spinner" />Saving…</> : <>{isEdit ? "Save changes" : "Create project"}<ArrowIcon /></>}
          </button>
        </div>
      </form>
    </main>
  );
}
