import { Link } from "react-router-dom";

export function NotFoundPage() {
  return <main className="centered-state"><p className="page-context">404</p><h1>This page is not on the plan.</h1><p>Return to your dashboard and continue from a known project.</p><Link className="button button-primary" to="/dashboard">Go to dashboard</Link></main>;
}
