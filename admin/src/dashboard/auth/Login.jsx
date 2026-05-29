// Admin sign-in — centred card on a soft emerald gradient. Plain
// HTML form + the new design system Button so the look matches the
// dashboard the user lands on after sign-in.

import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { IoMailOutline, IoLockClosedOutline, IoEyeOutline, IoEyeOffOutline } from "react-icons/io5";

import baseUrl from "../../baseUrl";
import Button from "../../common/Button";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // AdminRoute stashes the page the user was trying to reach into
  // location.state.from when it bounces an unauthenticated request.
  // Build the canonical post-login target so a deep-link survives the
  // sign-in detour (e.g. /dashboard/orders → login → /dashboard/orders,
  // not just /dashboard).
  const fromState = location.state?.from;
  const intendedPath =
    fromState?.pathname &&
    fromState.pathname.startsWith("/") &&
    !fromState.pathname.startsWith("//") &&
    fromState.pathname !== "/"
      ? `${fromState.pathname}${fromState.search || ""}`
      : "/dashboard";

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data?.code !== 200) {
        toast.error(data?.message || "Check your email and password and try again.");
        return;
      }
      const user = data.data.attributes?.user;
      if (user?.role !== "admin") {
        toast.error("This sign-in is for the admin dashboard.");
        return;
      }
      localStorage.setItem("token", data.data.attributes.tokens.access.token);
      localStorage.setItem("user", JSON.stringify(user));
      toast.success(`Welcome back, ${user.fullName || "admin"}`);
      navigate(intendedPath, { replace: true });
    } catch (err) {
      toast.error(err?.message || "Network error — couldn't sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-sky-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-ink-200 rounded-2xl shadow-card p-6 md:p-8">
        <div className="flex items-center gap-2 mb-6">
          <span className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold">
            Q
          </span>
          <div>
            <div className="text-lg font-bold text-ink-900">Qwlee Admin</div>
            <div className="text-xs text-ink-500">Sign in to manage the marketplace</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">
              Email
            </label>
            <div className="flex items-center bg-white border border-ink-200 rounded-lg focus-within:border-primary focus-within:ring-2 focus-within:ring-primary-100 transition">
              <IoMailOutline className="ml-3 text-ink-400 w-4 h-4" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">
              Password
            </label>
            <div className="flex items-center bg-white border border-ink-200 rounded-lg focus-within:border-primary focus-within:ring-2 focus-within:ring-primary-100 transition">
              <IoLockClosedOutline className="ml-3 text-ink-400 w-4 h-4" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="flex-1 px-3 py-2.5 text-sm bg-transparent outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="px-3 text-ink-400 hover:text-ink-700"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <IoEyeOffOutline /> : <IoEyeOutline />}
              </button>
            </div>
          </div>

          <div className="text-right">
            <Link to="/forgotpassword" className="text-sm font-medium text-primary-700 hover:text-primary-800">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" loading={loading} className="w-full" size="lg">
            Sign in
          </Button>
        </form>

        <p className="text-xs text-ink-400 text-center mt-6">
          Need access? Contact your Qwlee administrator.
        </p>
      </div>
    </div>
  );
}
