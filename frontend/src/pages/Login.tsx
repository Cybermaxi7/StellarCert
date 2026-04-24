import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, UserPlus, Shield, Eye, EyeOff } from "lucide-react";
import { authApi, UserRole } from "../api";
import { tokenStorage } from "../api";

// FIX #267 — Two distinct loading states so the user sees exactly which phase
// is in progress: "Creating account…" during registration, then
// "Signing in…" during the automatic login that follows.
type LoadingPhase = "idle" | "registering" | "logging-in";

const Login = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Replaces the single boolean `loading` with a granular phase value.
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>("idle");

  const [error, setError] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  const [formData, setFormData] = useState<{
    email: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  }>({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    role: UserRole.RECIPIENT,
  });

  // Password strength evaluation
  const evaluatePasswordStrength = (password: string) => {
    let score = 0;
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
      'admin', 'letmein', 'welcome', 'monkey', '1234567890', 'iloveyou',
      'princess', 'rockyou', '1234567', '12345678', 'password1', '123123'
    ];

    // Check for common passwords
    if (commonPasswords.includes(password.toLowerCase())) {
      return { strength: 'weak', score: 0 };
    }

    // Length check
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;

    // Character variety
    if (/[a-z]/.test(password)) score += 1; // lowercase
    if (/[A-Z]/.test(password)) score += 1; // uppercase
    if (/\d/.test(password)) score += 1; // numbers
    if (/[^a-zA-Z\d]/.test(password)) score += 1; // special characters

    // Determine strength
    if (score < 3) return { strength: 'weak', score };
    if (score < 5) return { strength: 'medium', score };
    return { strength: 'strong', score };
  };

  const passwordStrength = evaluatePasswordStrength(formData.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate password confirmation for registration
    if (!isLogin) {
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match. Please confirm your password.");
        return;
      }
      
      if (formData.password.length < 8) {
        setError("Password must be at least 8 characters long.");
        return;
      }
    }

    try {
      if (!isLogin) {
        // Phase 1 — Registration
        setLoadingPhase("registering");
        await authApi.register({
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role,
          email: formData.email,
          password: formData.password,
        });
      }

      // Phase 2 — Login (always reached, whether registering or just logging in)
      setLoadingPhase("logging-in");
      const res = await authApi.login({
        email: formData.email,
        password: formData.password,
      });

      if (res.accessToken) {
        tokenStorage.setAccessToken(res.accessToken);
        tokenStorage.setRefreshToken(res.refreshToken);
        localStorage.setItem("user", JSON.stringify(res.user));

        // Redirect to dashboard or home page
        navigate("/");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoadingPhase("idle");
    }
  };

  /** Label shown inside the submit button depending on current phase. */
  const buttonLabel = () => {
    if (loadingPhase === "registering") {
      return (
        <>
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
          Creating account…
        </>
      );
    }
    if (loadingPhase === "logging-in") {
      return (
        <>
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
          Signing in…
        </>
      );
    }
    // idle
    return isLogin ? (
      <>
        <LogIn className="w-4 h-4" />
        Sign In
      </>
    ) : (
      <>
        <UserPlus className="w-4 h-4" />
        Create Account
      </>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-900">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-8 w-full max-w-md transition-colors duration-250">
        <div className="flex justify-center mb-6">
          <Shield className="w-12 h-12 text-blue-600 dark:text-blue-400" />
        </div>

        <h1 className="text-2xl font-bold text-center mb-8 text-gray-900 dark:text-white">
          {isLogin ? "Welcome Back" : "Create Account"}
        </h1>

        {error && (
          <p className="text-red-600 dark:text-red-400 text-center mb-4">
            {error}
          </p>
        )}

        {/* Phase status banner shown during multi-step registration flow */}
        {!isLogin && loadingPhase !== "idle" && (
          <p className="text-sm text-blue-600 dark:text-blue-400 text-center mb-4">
            {loadingPhase === "registering"
              ? "Step 1 of 2 — Creating your account…"
              : "Step 2 of 2 — Signing you in…"}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  className="w-full px-4 py-2 border rounded-md 
                  bg-white dark:bg-slate-800
                  text-gray-900 dark:text-white
                  border-gray-300 dark:border-slate-700
                  focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  className="w-full px-4 py-2 border rounded-md 
                  bg-white dark:bg-slate-800
                  text-gray-900 dark:text-white
                  border-gray-300 dark:border-slate-700
                  focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full px-4 py-2 border rounded-md 
              bg-white dark:bg-slate-800
              text-gray-900 dark:text-white
              border-gray-300 dark:border-slate-700
              focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="w-full px-4 py-2 border rounded-md 
                bg-white dark:bg-slate-800
                text-gray-900 dark:text-white
                border-gray-300 dark:border-slate-700
                focus:ring-blue-500 focus:border-blue-500 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>

            {/* Password Strength Indicator - only show during registration */}
            {!isLogin && formData.password && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600 dark:text-slate-400">
                    Password Strength:
                  </span>
                  <span className={`text-xs font-medium ${
                    passwordStrength.strength === 'weak' ? 'text-red-600 dark:text-red-400' :
                    passwordStrength.strength === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-green-600 dark:text-green-400'
                  }`}>
                    {passwordStrength.strength.charAt(0).toUpperCase() + passwordStrength.strength.slice(1)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      passwordStrength.strength === 'weak' ? 'bg-red-500 w-1/3' :
                      passwordStrength.strength === 'medium' ? 'bg-yellow-500 w-2/3' :
                      'bg-green-500 w-full'
                    }`}
                  ></div>
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-slate-500">
                  {passwordStrength.strength === 'weak' && 'Use at least 8 characters with mixed case, numbers, and symbols'}
                  {passwordStrength.strength === 'medium' && 'Add more complexity for better security'}
                  {passwordStrength.strength === 'strong' && 'Great! Your password is secure'}
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password - only show during registration */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  className="w-full px-4 py-2 border rounded-md 
                  bg-white dark:bg-slate-800
                  text-gray-900 dark:text-white
                  border-gray-300 dark:border-slate-700
                  focus:ring-blue-500 focus:border-blue-500 pr-10"
                  required
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  {formData.confirmPassword && (
                    <span className={`text-sm ${
                      formData.password === formData.confirmPassword
                        ? 'text-green-500'
                        : 'text-red-500'
                    }`}>
                      {formData.password === formData.confirmPassword ? '✓' : '✗'}
                    </span>
                  )}
                </div>
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  Passwords do not match
                </p>
              )}
            </div>
          )}

          {/* Role (sign-up only) */}
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value as UserRole })
                }
                className="w-full px-4 py-2 border rounded-md 
                bg-white dark:bg-slate-800
                text-gray-900 dark:text-white
                border-gray-300 dark:border-slate-700
                focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value={UserRole.RECIPIENT}>Certificate Holder</option>
                <option value={UserRole.ISSUER}>Certificate Issuer</option>
                <option value={UserRole.VERIFIER}>Certificate Verifier</option>
              </select>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loadingPhase !== "idle"}
            className="w-full py-2 px-4 
            bg-blue-600 hover:bg-blue-700 disabled:opacity-60
            text-white rounded-md 
            flex items-center justify-center gap-2 
            transition-colors duration-200"
          >
            {buttonLabel()}
          </button>
        </form>

        {/* Forgot password flow */}
        {isLogin && (
          <div className="mt-4 text-center">
            {!showForgot ? (
              <button
                onClick={() => setShowForgot(true)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Forgot your password?
              </button>
            ) : (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">
                  Enter your account email to receive password reset
                  instructions.
                </p>
                {forgotSuccess ? (
                  <div className="text-sm text-green-600">{forgotSuccess}</div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="flex-1 px-3 py-2 border rounded-md"
                    />
                    <button
                      onClick={async () => {
                        setForgotLoading(true);
                        setError(null);
                        try {
                          await authApi.forgotPassword({ email: forgotEmail });
                          setForgotSuccess(
                            "If the email exists, a reset link has been sent.",
                          );
                        } catch (err: unknown) {
                          setError(
                            err instanceof Error
                              ? err.message
                              : "Failed to request password reset",
                          );
                        } finally {
                          setForgotLoading(false);
                        }
                      }}
                      disabled={forgotLoading}
                      className="px-3 py-2 bg-blue-600 text-white rounded-md"
                    >
                      {forgotLoading ? "Sending…" : "Send"}
                    </button>
                  </div>
                )}
                <div className="mt-2">
                  <button
                    onClick={() => setShowForgot(false)}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Toggle login / register */}
        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;