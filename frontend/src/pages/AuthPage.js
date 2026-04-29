import { useState } from "react";
import { useAuth } from "../utils/AuthContext";
import API from "../utils/api";

export default function AuthPage() {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!email || !password) { setError("Please fill in all fields."); return; }

    setLoading(true);
    try {
      const endpoint = isLogin ? "/login" : "/signup";
      const res = await API.post(endpoint, { email, password });
      login(res.data.token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg" />
      <div className="auth-card fade-up">
        <div className="auth-header">
          <div className="auth-logo">
            Identity<em>Vault</em>
          </div>
          <p className="auth-subtitle">
            {isLogin ? "Welcome back. Sign in to continue." : "Create your account to get started."}
          </p>
        </div>

        <div className="auth-form">
          {error && <div className="error-box">{error}</div>}

          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              className="form-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder={isLogin ? "Your password" : "Min. 6 characters"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
          </div>

          <button
            className="btn btn-primary btn-full"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <><div className="spinner" /> {isLogin ? "Signing in..." : "Creating account..."}</>
              : isLogin ? "Sign in" : "Create account"
            }
          </button>

          <div className="auth-divider"><span>or</span></div>

          <p className="auth-toggle">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <button onClick={() => { setIsLogin(!isLogin); setError(""); }}>
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
