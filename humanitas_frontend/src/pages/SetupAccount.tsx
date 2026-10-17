import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import humanitasLogo from "../assets/humanitas_logo.png";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/config/api.config';
import { ModeToggle } from "@/components/mode-toggle";

// Shared Layout Wrapper (defined outside to prevent remounting and input focus loss)
function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative">
      {/* Top Navigation */}
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>

      <div className="flex flex-col items-center mb-8">
        <img src={humanitasLogo} alt="Humanitas Logo" width={200} className="mb-4" />
        <h1 className="text-2xl font-bold text-brand-blue tracking-tight">HUMANITAS</h1>
      </div>
      {children}
    </div>
  );
}

function SetupAccount() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  const tenant = searchParams.get('tenant');

  const [isVerifying, setIsVerifying] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [userName, setUserName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const [formData, setFormData] = useState({
    password: '',
    confirm_password: '',
  });

  useEffect(() => {
    if (!token || !email || !tenant) {
      setError('Invalid setup link - missing required parameters');
      setIsVerifying(false);
      return;
    }

    verifyToken();
  }, [token, email, tenant]);

  const verifyToken = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/verify-setup-token?token=${token}&email=${encodeURIComponent(email!)}&tenant=${tenant}`,
        {
          headers: {
            'x-tenant-slug': tenant!,
          },
        }
      );
      const data = await response.json();

      if (response.ok && data.valid) {
        setIsValid(true);
        setUserName(data.user?.full_name || email);
      } else {
        setError(data.message || 'Invalid or expired setup token');
      }
    } catch (err) {
      setError('Failed to verify setup token');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirm_password) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/complete-setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-slug': tenant!,
        },
        body: JSON.stringify({
          token,
          email,
          password: formData.password,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: 'Setup failed' }));
        throw new Error(data.message || 'Setup failed');
      }

      setIsComplete(true);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isVerifying) {
    return (
      <PageLayout>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Verifying setup token...</p>
      </PageLayout>
    );
  }

  if (!isValid) {
    return (
      <PageLayout>
        <AlertCircle className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold text-foreground mt-4">Invalid Setup Link</h1>
        <p className="text-muted-foreground mt-2 text-center max-w-md">{error || 'This setup link is invalid or has expired.'}</p>
        <Button
          className="mt-6 bg-primary text-primary-foreground"
          onClick={() => navigate('/login')}
        >
          Go to Login
        </Button>
      </PageLayout>
    );
  }

  if (isComplete) {
    return (
      <PageLayout>
        <CheckCircle className="h-16 w-16 text-green-500" />
        <h1 className="text-2xl font-bold text-foreground mt-4">Account Setup Complete!</h1>
        <p className="text-muted-foreground mt-2">Your password has been set successfully.</p>
        <p className="text-muted-foreground/80 mt-2">Redirecting to login...</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <Card className="w-full max-w-[450px] shadow-lg border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Set Up Your Account</CardTitle>
          <CardDescription className="text-muted-foreground">
            Welcome, <strong>{userName}</strong>! Please set your password to complete your account setup.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive px-4 py-2 rounded text-sm text-center">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-foreground">
                Email
              </label>
              <Input
                type="email"
                value={email || ''}
                disabled
                className="bg-muted text-muted-foreground"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-foreground">
                Password *
              </label>
              <Input
                type="password"
                placeholder="Min 8 characters"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={8}
                disabled={isSubmitting}
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-foreground">
                Confirm Password *
              </label>
              <Input
                type="password"
                placeholder="Confirm your password"
                value={formData.confirm_password}
                onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                required
                minLength={8}
                disabled={isSubmitting}
                className="bg-background"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Setting up...
                </>
              ) : (
                'Complete Setup'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </PageLayout>
  );
}

export default SetupAccount;
