import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./utils/AuthContext";
import Navbar from "./components/Navbar";
import AuthPage from "./pages/AuthPage";
import KYCPage from "./pages/KYCPage";
import ResultPage from "./pages/ResultPage";
import API from "./utils/api";
import "./index.css";

function AppContent() {
  const { user, logout, loading } = useAuth();
  const [kycData, setKycData] = useState(null);
  const [checkingKyc, setCheckingKyc] = useState(false);

  // When user logs in, check if they already have KYC done
  useEffect(() => {
    if (!user) { setKycData(null); return; }
    setCheckingKyc(true);
    API.get("/status")
      .then(res => {
        if (res.data.verified) setKycData(res.data);
      })
      .catch(() => {})
      .finally(() => setCheckingKyc(false));
  }, [user]);

  const handleVerified = (data) => setKycData(data);

  const handleReset = () => {
    logout();
    setKycData(null);
  };

  if (loading || checkingKyc) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spinner" style={{ width: 28, height: 28, borderColor: "var(--border)", borderTopColor: "var(--accent)" }} />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <div className="app-shell">
      <Navbar />
      {kycData
        ? <ResultPage data={kycData} onReset={handleReset} />
        : <KYCPage onVerified={handleVerified} />
      }
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
