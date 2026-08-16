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

interface TenantInfo {
  slug: string;
  company_name: string;
  contact_email: string;
  subscription_plan?: string;
}

function Setup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [isVerifying, setIsVerifying] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const [formData, setFormData] = useState({
    owner_email: '',
    owner_name: '',
    password: '',
    confirm_password: '',
    phone: '',
  });

  useEffect(() => {
    if (!token) {
      setError('No setup token provided');
      setIsVerifying(false);
      return;
    }

    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/setup/verify?token=${token}`);
      const data = await response.json();

      if (data.valid && data.tenant) {
        setIsValid(true);
        setTenant(data.tenant);
        setFormData(prev => ({
          ...prev,
          owner_email: data.tenant.contact_email || '',
        }));
      } else {
        setError('Invalid or expired setup token');
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
      const response = await fetch(`${API_BASE_URL}/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setup_token: token,
          owner_email: formData.owner_email,
          owner_name: formData.owner_name,
          password: formData.password,
          phone: formData.phone || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: 'Setup failed' }));
        throw new Error(data.message || 'Setup failed');
      }

      const data = await response.json();

      // Store auth data
      localStorage.setItem('tenant_auth_token', data.access_token);
      localStorage.setItem('tenant_refresh_token', data.refresh_token);
      localStorage.setItem('tenant_user', JSON.stringify(data.user));
      localStorage.setItem('tenant_info', JSON.stringify(data.tenant));

      setIsComplete(true);

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Shared Layout Wrapper
  const PageLayout = ({ children }: { children: React.ReactNode }) => (
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
        <h1 className="text-2xl font-bold text-foreground mt-4">Setup Complete!</h1>
        <p className="text-muted-foreground mt-2">Your account has been created successfully.</p>
        <p className="text-muted-foreground/80 mt-2">Redirecting to dashboard...</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <Card className="w-full max-w-[500px] shadow-lg border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Complete Your Setup</CardTitle>
          <CardDescription className="text-muted-foreground">
            Setting up <strong>{tenant?.company_name}</strong>
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
                Your Email *
              </label>
              <Input
                type="email"
                value={formData.owner_email}
                onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
                required
                disabled={isSubmitting}
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-foreground">
                Your Full Name *
              </label>
              <Input
                type="text"
                placeholder="John Doe"
                value={formData.owner_name}
                onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                required
                disabled={isSubmitting}
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none text-foreground">
                Phone Number
              </label>
              <Input
                type="tel"
                placeholder="+1-555-0100"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={isSubmitting}
                className="bg-background"
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

export default Setup;
