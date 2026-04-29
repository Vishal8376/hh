import { useAuth } from "../utils/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="nav">
      <div className="nav-logo">
        ▲ <span>KYC</span>Verify
      </div>
      {user && (
        <div className="nav-actions">
          <span className="nav-email">{user.email}</span>
          <button className="btn btn-ghost" onClick={logout} style={{ padding: "7px 16px", fontSize: "0.8rem" }}>
            Sign out
          </button>
        </div>
      )}
    </nav>
  );
}
