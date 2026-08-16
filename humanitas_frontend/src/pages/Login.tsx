import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/context/AuthContext';
import { Save, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { ModeToggle } from "@/components/mode-toggle";

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [tenantSlug, setTenantSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('humanitas_tenant_slug');
    if (saved) {
      setTenantSlug(saved);
    }
  }, []);

  const handleSaveTenant = () => {
    if (tenantSlug.trim()) {
      localStorage.setItem('humanitas_tenant_slug', tenantSlug.trim());
      toast.success('Organization ID saved locally');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(tenantSlug, email, password);
      // Auto-save on successful login if it matches
      localStorage.setItem('humanitas_tenant_slug', tenantSlug.trim());
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative">
      <div className="absolute top-4 left-4">
        <Button variant="ghost" onClick={() => navigate('/')} className="gap-2 text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>

      <div className="flex flex-col items-center mb-8">
        <div className="flex flex-col items-center">
          <img src="/humanitas.svg" alt="Humanitas Logo" width={170} className="mb-4" />
          <h1 className="text-3xl font-bold text-brand-blue tracking-tight">HUMANITAS</h1>
          <p className="text-muted-foreground mt-2 text-center">Human Intelligence for Human Resource</p>
        </div>
      </div>

      <Card className="w-full max-w-[380px] shadow-lg border-border bg-card">
        <form onSubmit={handleSubmit}>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center text-foreground">Sign in to your account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive px-4 py-2 rounded text-sm text-center">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground">
                Organization ID
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="e.g., abcd_corporation"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value.toLowerCase())}
                  required
                  disabled={isLoading}
                  className="bg-background"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleSaveTenant}
                  title="Save Organization ID"
                  disabled={isLoading}
                >
                  <Save className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[0.8rem] text-muted-foreground">
                Your organization's unique identifier
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground">
                Email
              </label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground">
                Password
              </label>
              <Input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="bg-background"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}

export default Login;
