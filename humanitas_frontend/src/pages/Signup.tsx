import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, Mail, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { ModeToggle } from '@/components/mode-toggle';
import {
  groupModules,
  neededBy,
  signupApi,
  slugFormatProblem,
  suggestSlug,
  withDependencies,
  type SignupOptions,
  type SignupResult,
} from '@/lib/signup';

type SlugState = { status: 'idle' | 'checking' | 'ok' | 'bad'; reason?: string };

/** Website "Start free trial": a company signs up, picks its modules and gets a set-up email. */
export default function Signup() {
  const navigate = useNavigate();
  const [options, setOptions] = useState<SignupOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugState, setSlugState] = useState<SlugState>({ status: 'idle' });
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('Ethiopia');
  const [website, setWebsite] = useState(''); // honeypot
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<SignupResult | null>(null);

  useEffect(() => {
    let alive = true;
    signupApi
      .options()
      .then((o) => alive && setOptions(o))
      .catch((e: Error) => alive && setLoadError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!slugEdited) setSlug(suggestSlug(companyName));
  }, [companyName, slugEdited]);

  // Check the organization ID as the visitor types (debounced).
  useEffect(() => {
    if (!slug) return setSlugState({ status: 'idle' });
    const problem = slugFormatProblem(slug);
    if (problem) return setSlugState({ status: 'bad', reason: problem });
    setSlugState({ status: 'checking' });
    let alive = true;
    const t = window.setTimeout(() => {
      signupApi
        .slugAvailable(slug)
        .then((r) => alive && setSlugState(r.available ? { status: 'ok' } : { status: 'bad', reason: r.reason }))
        .catch(() => alive && setSlugState({ status: 'idle' }));
    }, 400);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [slug]);

  const modules = useMemo(() => options?.modules ?? [], [options]);
  const groups = useMemo(() => groupModules(modules), [modules]);
  const selected = useMemo(() => withDependencies(chosen, modules), [chosen, modules]);
  const nameOf = (key: string) => modules.find((m) => m.key === key)?.name ?? key;

  const toggle = (key: string, on: boolean) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const canSubmit =
    companyName.trim().length >= 2 && slugState.status !== 'bad' && slugState.status !== 'checking' && !!slug &&
    /\S+@\S+\.\S+/.test(email) && selected.size > 0 && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const r = await signupApi.signup({
        company_name: companyName.trim(),
        slug,
        contact_email: email.trim(),
        contact_phone: phone.trim() || undefined,
        country: country.trim() || undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
        modules: [...selected],
        website: website || undefined,
      });
      try {
        localStorage.setItem('humanitas_tenant_slug', r.slug);
      } catch {
        // Private mode: the sign-in page just won't be pre-filled.
      }
      setResult(r);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Sign-up failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-4 py-3 md:px-8">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Home
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Sign in</Button>
          <ModeToggle />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10 md:py-14">{children}</main>
    </div>
  );

  if (loadError) {
    return shell(
      <div role="alert" className="rounded-lg border p-6 text-center">
        <p className="font-medium">{loadError}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>Try again</Button>
      </div>,
    );
  }

  if (!options) {
    return shell(
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>,
    );
  }

  if (!options.enabled) {
    return shell(
      <div className="rounded-lg border p-8 text-center">
        <h1 className="text-2xl font-bold">Online sign-up is closed right now</h1>
        <p className="mt-3 text-muted-foreground">
          Contact us and we will set up your account
          {options.support_email ? (
            <>
              {' '}at <a className="text-primary underline" href={`mailto:${options.support_email}`}>{options.support_email}</a>
            </>
          ) : null}
          .
        </p>
      </div>,
    );
  }

  if (result) {
    return shell(
      <div className="mx-auto max-w-xl rounded-lg border p-8 text-center">
        <Mail className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 text-2xl font-bold">Check your email</h1>
        <p className="mt-3 text-muted-foreground">
          We sent a link to <span className="font-medium text-foreground">{result.contact_email}</span> to set your
          password and finish setting up {result.company_name}.
        </p>
        <div className="mt-6 rounded-md bg-muted p-4 text-left text-sm">
          <p>Organization ID (you need it to sign in): <span className="font-mono font-semibold">{result.slug}</span></p>
          {result.trial_ends_at && (
            <p className="mt-1">Free trial until {new Date(result.trial_ends_at).toLocaleDateString()}</p>
          )}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">No email after a few minutes? Check your spam folder.</p>
        <Button className="mt-6" onClick={() => navigate('/login')}>Go to sign in</Button>
      </div>,
    );
  }

  return shell(
    <>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold md:text-4xl">Start your {options.trial_days}-day free trial</h1>
        <p className="mt-3 text-muted-foreground">No payment needed. Choose the modules you want; you can add more later.</p>
      </div>

      <form onSubmit={submit} className="space-y-8" noValidate>
        <Card>
          <CardContent className="grid gap-5 pt-6 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="su-company">Company name</Label>
              <Input id="su-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} maxLength={100} autoFocus required />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="su-slug">Organization ID</Label>
              <Input
                id="su-slug"
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                }}
                maxLength={40}
                aria-describedby="su-slug-help"
                aria-invalid={slugState.status === 'bad'}
                required
              />
              <p id="su-slug-help" className="flex items-center gap-1 text-xs">
                {slugState.status === 'checking' && (<><Loader2 className="h-3 w-3 animate-spin" /> Checking…</>)}
                {slugState.status === 'ok' && (<><CheckCircle2 className="h-3 w-3 text-green-600" /> Available. You sign in with this ID.</>)}
                {slugState.status === 'bad' && (<><XCircle className="h-3 w-3 text-destructive" /> <span className="text-destructive">{slugState.reason}</span></>)}
                {slugState.status === 'idle' && <span className="text-muted-foreground">You sign in with this ID.</span>}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="su-email">Your work email</Label>
              <Input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={150} autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="su-phone">Phone (optional)</Label>
              <Input id="su-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} autoComplete="tel" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="su-country">Country</Label>
              <Input id="su-country" value={country} onChange={(e) => setCountry(e.target.value)} maxLength={60} autoComplete="country-name" />
            </div>
            {/* Hidden from people; bots fill it in. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="su-website">Website</label>
              <input id="su-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <section aria-labelledby="su-modules">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="su-modules" className="text-xl font-bold">Modules</h2>
              <p className="text-sm text-muted-foreground">Choose at least one. Modules marked Coming soon can be added when they are ready.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setChosen(new Set(modules.filter((m) => m.status === 'available').map((m) => m.key)))}
            >
              Select all available
            </Button>
          </div>
          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g.category}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {g.modules.map((m) => {
                    const soon = m.status !== 'available';
                    const on = selected.has(m.key);
                    const lockedBy = on && !chosen.has(m.key) ? neededBy(m.key, chosen, modules) : [];
                    const id = `su-mod-${m.key}`;
                    return (
                      <label
                        key={m.key}
                        htmlFor={id}
                        className={`flex gap-3 rounded-lg border p-4 transition-colors ${soon ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-accent/40'} ${on ? 'border-primary bg-primary/5' : ''}`}
                      >
                        <Checkbox
                          id={id}
                          checked={on}
                          disabled={soon || lockedBy.length > 0}
                          onCheckedChange={(v) => toggle(m.key, v === true)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2 font-medium">
                            {m.name}
                            {soon && <Badge variant="secondary">Coming soon</Badge>}
                          </span>
                          <span className="mt-1 block text-sm text-muted-foreground">{m.description}</span>
                          {lockedBy.length > 0 && (
                            <span className="mt-1 block text-xs text-primary">Included: {lockedBy.map(nameOf).join(', ')} needs it</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {submitError && (
          <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {submitError}
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          <Button type="submit" size="lg" className="h-12 w-full rounded-full px-10 md:w-auto" disabled={!canSubmit}>
            {submitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating your workspace…</>) : 'Start free trial'}
          </Button>
          <p className="text-xs text-muted-foreground">Setting up your workspace can take up to a minute.</p>
        </div>
      </form>
    </>,
  );
}
