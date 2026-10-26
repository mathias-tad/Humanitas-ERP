import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeaders } from '@/context/AuthContext';
import { CheckCircle, Circle, FileText, Shield, User, Video, PenLine, Loader2 } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '';

const STEPS = [
  {
    key: 'personal_info_completed',
    label: 'Complete Personal Information',
    icon: User,
    description: 'Verify and complete your profile details, emergency contacts, and bank information.',
  },
  {
    key: 'documents_uploaded',
    label: 'Upload Required Documents',
    icon: FileText,
    description: 'Upload your ID, educational certificates, and any required compliance documents.',
  },
  {
    key: 'policy_accepted',
    label: 'Accept Company Policies',
    icon: Shield,
    description: 'Read and accept the employee handbook, code of conduct, and HR policies.',
  },
  {
    key: 'contract_signed',
    label: 'Sign Employment Contract',
    icon: PenLine,
    description: 'Review and sign your employment contract electronically.',
  },
  {
    key: 'orientation_viewed',
    label: 'Complete Orientation',
    icon: Video,
    description: 'Watch the company orientation and welcome materials.',
  },
];

export default function WelcomePortalPage() {
  const queryClient = useQueryClient();
  const [signingStep, setSigningStep] = useState<string | null>(null);
  const [signature, setSignature] = useState('');

  const { data: status, isLoading } = useQuery({
    queryKey: ['welcome-portal'],
    queryFn: async () => {
      const res = await fetch(`${API}/hrms/onboarding/welcome-portal`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load welcome portal status');
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (vars: { step: string; value: boolean; e_signature?: string }) => {
      const res = await fetch(`${API}/hrms/onboarding/welcome-portal/step`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(vars),
      });
      if (!res.ok) throw new Error('Failed to update step');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['welcome-portal'] });
      setSigningStep(null);
      setSignature('');
    },
  });

  const completed = STEPS.filter((s) => status?.[s.key]).length;
  const pct = Math.round((completed / STEPS.length) * 100);
  const allDone = completed === STEPS.length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">👋</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Welcome to the Team!</h1>
          <p className="text-slate-400 mt-2">Complete these steps to get fully set up</p>
        </div>

        {/* Progress bar */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-300 text-sm">{completed}/{STEPS.length} steps completed</span>
            <span className="text-amber-400 font-bold">{pct}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {allDone && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-4 text-center">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-emerald-300 font-semibold">
              All steps completed! You are fully onboarded. 🎉
            </p>
          </div>
        )}

        {/* Steps */}
        <div className="space-y-3">
          {STEPS.map((step) => {
            const done = !!status?.[step.key];
            const isSigning = signingStep === step.key;

            return (
              <div
                key={step.key}
                className={`bg-slate-800 border rounded-xl p-5 transition-all ${
                  done ? 'border-emerald-500/40' : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`mt-0.5 flex-shrink-0 ${done ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {done ? <CheckCircle className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <step.icon className="w-4 h-4 text-amber-400" />
                      <h3 className={`font-semibold ${done ? 'text-emerald-300 line-through' : 'text-white'}`}>
                        {step.label}
                      </h3>
                    </div>
                    <p className="text-slate-400 text-sm mt-1">{step.description}</p>

                    {/* E-signature capture for contract */}
                    {step.key === 'contract_signed' && !done && (
                      <div className="mt-3">
                        {isSigning ? (
                          <div className="space-y-2">
                            <input
                              className="w-full border border-slate-600 bg-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm"
                              placeholder="Type your full legal name as digital signature"
                              value={signature}
                              onChange={(e) => setSignature(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  mutation.mutate({ step: step.key, value: true, e_signature: signature })
                                }
                                disabled={!signature.trim() || mutation.isPending}
                                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-semibold"
                              >
                                {mutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                                ) : (
                                  'Sign & Complete'
                                )}
                              </button>
                              <button
                                onClick={() => setSigningStep(null)}
                                className="px-4 py-2 text-sm text-slate-400"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setSigningStep(step.key)}
                            className="mt-2 text-sm bg-amber-500/20 text-amber-300 px-4 py-2 rounded-lg hover:bg-amber-500/30"
                          >
                            Sign Contract
                          </button>
                        )}
                      </div>
                    )}

                    {!done && step.key !== 'contract_signed' && (
                      <button
                        onClick={() => mutation.mutate({ step: step.key, value: true })}
                        disabled={mutation.isPending}
                        className="mt-3 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg"
                      >
                        {mutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin inline" />
                        ) : (
                          'Mark as Complete'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
