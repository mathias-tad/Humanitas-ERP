import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL } from "@/config/api.config";
import { Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function Apply() {
  const { token } = useParams<{ token: string }>();

  const [formDef, setFormDef] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Applicant info
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [candidatePhone, setCandidatePhone] = useState("");

  // Answers mapping question_id -> value
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string>>({});
  const [uploadingQuestions, setUploadingQuestions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchForm = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/recruitment/apply/${token}/form`);
        if (!res.ok) {
          throw new Error("Form not found or link expired.");
        }
        const data = await res.json();
        setFormDef(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    if (token) fetchForm();
  }, [token]);

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleFileUpload = async (questionId: string, file: File) => {
    setUploadingQuestions(prev => ({ ...prev, [questionId]: true }));
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE_URL}/recruitment/apply/${token}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to upload file.");
      }

      const data = await res.json();
      setUploadedFiles(prev => ({ ...prev, [questionId]: data.object_key }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingQuestions(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const payload = {
      candidate_name: candidateName,
      candidate_email: candidateEmail,
      candidate_phone: candidatePhone,
      answers,
      files: uploadedFiles,
    };

    try {
      const res = await fetch(`${API_BASE_URL}/recruitment/apply/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to submit application.");
      }

      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !formDef) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm text-center max-w-md w-full border">
          <h2 className="text-xl font-bold text-red-600 mb-2">Unavailable</h2>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-10 rounded-xl shadow-sm text-center max-w-md w-full border">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Application Submitted!</h2>
          <p className="text-slate-600 mb-6">
            Thank you for applying. We have received your application successfully.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="bg-primary/5 p-8 border-b">
          <h1 className="text-2xl font-bold text-slate-900">Job Application</h1>
          <p className="text-slate-600 mt-2">Please fill out the form below to submit your application.</p>
        </div>

        <div className="p-8">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Personal Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Full Name <span className="text-red-500">*</span></Label>
                  <Input 
                    required 
                    value={candidateName} 
                    onChange={e => setCandidateName(e.target.value)} 
                    placeholder="Jane Doe" 
                  />
                </div>
                <div className="space-y-1">
                  <Label>Email <span className="text-red-500">*</span></Label>
                  <Input 
                    required 
                    type="email" 
                    value={candidateEmail} 
                    onChange={e => setCandidateEmail(e.target.value)} 
                    placeholder="jane@example.com" 
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Phone Number</Label>
                <Input 
                  type="tel" 
                  value={candidatePhone} 
                  onChange={e => setCandidatePhone(e.target.value)} 
                  placeholder="+1 (555) 000-0000" 
                />
              </div>
            </div>

            {formDef?.questions && formDef.questions.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold border-b pb-2">Application Questions</h3>
                {formDef.questions.sort((a: any, b: any) => a.order - b.order).map((q: any) => (
                  <div key={q.id} className="space-y-2">
                    <Label className="text-base font-medium">
                      {q.label} {q.required && <span className="text-red-500">*</span>}
                    </Label>
                    {q.helper_text && <p className="text-xs text-slate-500">{q.helper_text}</p>}
                    
                    {q.type === 'short_text' || q.type === 'email' || q.type === 'phone' || q.type === 'url' ? (
                      <Input
                        required={q.required}
                        value={answers[q.id] || ""}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      />
                    ) : q.type === 'paragraph' ? (
                      <Textarea
                        required={q.required}
                        value={answers[q.id] || ""}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      />
                    ) : q.type === 'number' ? (
                      <Input
                        type="number"
                        required={q.required}
                        value={answers[q.id] || ""}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      />
                    ) : q.type === 'mcq_single' || q.type === 'dropdown' ? (
                      <select
                        required={q.required}
                        value={answers[q.id] || ""}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="" disabled>Select an option...</option>
                        {q.options?.map((opt: any) => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                      </select>
                    ) : q.type === 'mcq_multi' ? (
                      <div className="space-y-2">
                        {q.options?.map((opt: any) => {
                          const checked = (answers[q.id] || []).includes(opt.id);
                          return (
                            <label key={opt.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  let current = answers[q.id] || [];
                                  if (e.target.checked) {
                                    handleAnswerChange(q.id, [...current, opt.id]);
                                  } else {
                                    handleAnswerChange(q.id, current.filter((val: string) => val !== opt.id));
                                  }
                                }}
                              />
                              {opt.label}
                            </label>
                          );
                        })}
                      </div>
                    ) : q.type === 'yes_no' ? (
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name={q.id}
                            value="yes"
                            checked={answers[q.id] === "yes"}
                            onChange={() => handleAnswerChange(q.id, "yes")}
                            required={q.required}
                          />
                          Yes
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name={q.id}
                            value="no"
                            checked={answers[q.id] === "no"}
                            onChange={() => handleAnswerChange(q.id, "no")}
                            required={q.required}
                          />
                          No
                        </label>
                      </div>
                    ) : q.type === 'file_upload' || q.type === 'image_upload' ? (
                      <div className="space-y-2">
                        <Input
                          type="file"
                          required={q.required && !uploadedFiles[q.id]}
                          accept={q.type === 'image_upload' ? "image/*" : ".pdf,.doc,.docx,.txt,.rtf,.csv,.xlsx"}
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileUpload(q.id, e.target.files[0]);
                            }
                          }}
                          disabled={uploadingQuestions[q.id]}
                        />
                        {uploadingQuestions[q.id] && (
                          <div className="flex items-center text-sm text-blue-600 gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                          </div>
                        )}
                        {uploadedFiles[q.id] && !uploadingQuestions[q.id] && (
                          <div className="flex items-center text-sm text-green-600 gap-2">
                            <CheckCircle className="h-4 w-4" /> File uploaded successfully
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm italic text-slate-500">
                        (Question type "{q.type}" is not fully supported in this view yet.)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t">
              <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Submit Application
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
