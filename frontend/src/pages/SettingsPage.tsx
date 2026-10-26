import { useAuth } from "../auth/AuthContext";

export function SettingsPage() {
  const { user } = useAuth();
  return (
    <main className="workspace-page narrow-page">
      <header className="form-page-heading"><h1>Your profile</h1><p>Profile editing will be connected when the matching backend endpoint is implemented.</p></header>
      <section className="content-panel profile-panel"><dl><div><dt>Full name</dt><dd>{user?.full_name}</dd></div><div><dt>Email address</dt><dd>{user?.email}</dd></div></dl></section>
    </main>
  );
}
