import { useState, useEffect } from "react";
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, Users, Briefcase, Sparkles, Trophy, FileText } from "lucide-react";
import { API_BASE_URL } from "@/config/api.config";
import { formatDistanceToNow } from "date-fns";

import { CreateJobModal } from "@/components/recruitment/CreateJobModal";
import { AddCandidateModal } from "@/components/recruitment/AddCandidateModal";
import { EditJobModal } from "@/components/recruitment/EditJobModal";
import { ApplicationLinksModal } from "@/components/recruitment/ApplicationLinksModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Recruitment() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecruitmentData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const [jobsRes, appsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/recruitment/jobs`, { credentials: 'include' }),
        fetch(`${API_BASE_URL}/recruitment/applications`, { credentials: 'include' })
      ]);

      if (!jobsRes.ok) throw new Error("Failed to load jobs");
      if (!appsRes.ok) throw new Error("Failed to load applications");

      const jobsData = await jobsRes.json();
      const appsData = await appsRes.json();
      
      // Backend always returns { items: [], total: n } — extract safely
      const jobsArray = Array.isArray(jobsData) ? jobsData : (Array.isArray(jobsData?.items) ? jobsData.items : []);
      const appsArray = Array.isArray(appsData) ? appsData : (Array.isArray(appsData?.items) ? appsData.items : []);
      setJobs(jobsArray);
      setApplications(appsArray);
    } catch (err: any) {
      console.error(err);
      setError("Please ensure you have configured your Krinai API Key in Settings > Integrations.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecruitmentData();
  }, []);

  const updateAppStatus = async (jobId: string, appId: string, status: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/recruitment/jobs/${jobId}/applications/${appId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchRecruitmentData();
      }
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="text-center py-12 border rounded-xl bg-muted/20">
          <Sparkles className="mx-auto h-12 w-12 text-muted-foreground opacity-50 mb-4" />
          <h2 className="text-xl font-semibold mb-2">AI Screening Not Connected</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.href = '/settings?tab=Integrations'}>
            Go to Settings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AI Screening & Recruitment</h2>
          <p className="text-muted-foreground">
            Powered by Krinai AI. Manage your jobs and AI-scored candidates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AddCandidateModal jobs={jobs} onSuccess={fetchRecruitmentData} />
          <CreateJobModal onSuccess={fetchRecruitmentData} />
          <Button variant="outline" onClick={() => window.open('https://krinai.ziontech.tech', '_blank')}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Krinai Dashboard
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobs.filter(j => j.status === 'open' || j.is_active).length}</div>
            <p className="text-xs text-muted-foreground">Total open positions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Applicants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{applications.length}</div>
            <p className="text-xs text-muted-foreground">Across all jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Top Candidates</CardTitle>
            <Sparkles className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {applications.filter(a => a.ai_score && a.ai_score > 80).length}
            </div>
            <p className="text-xs text-muted-foreground">AI Score &gt; 80</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recent Jobs</CardTitle>
            <CardDescription>Latest open positions synced from Krinai.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {jobs.slice(0, 5).map((job) => (
                <div key={job.id} className="flex flex-col p-4 border rounded-lg gap-3">
                  <div>
                    <h4 className="font-semibold break-words" title={job.title}>{job.title}</h4>
                    <p className="text-sm text-muted-foreground truncate">
                      {job.department || job.location || "Remote"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={job.status === 'closed' ? 'secondary' : 'default'}>
                      {job.status || "Open"}
                    </Badge>
                    <ApplicationLinksModal jobId={job.id} jobTitle={job.title} />
                    <Button variant="outline" size="sm" onClick={() => window.open(`/recruitment/jobs/${job.id}/leaderboard`, '_self')}>
                      <Trophy className="h-4 w-4 mr-1" /> Leaderboard
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.open(`/recruitment/jobs/${job.id}/form-builder`, '_self')}>
                      <FileText className="h-4 w-4 mr-1" /> Form Builder
                    </Button>
                    <EditJobModal job={job} onSuccess={fetchRecruitmentData} />
                  </div>
                </div>
              ))}
              {jobs.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">No jobs found.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Top AI-Scored Candidates</CardTitle>
            <CardDescription>Recent applications sorted by AI matching score.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {applications
                .sort((a, b) => (b.ai_score || 0) - (a.ai_score || 0))
                .slice(0, 5)
                .map((app) => (
                <div key={app.id} className="flex flex-col p-4 border rounded-lg gap-3">
                  <div className="flex flex-col min-w-0 w-full">
                    <h4 className="font-semibold truncate" title={app.candidate_name || "Candidate"}>{app.candidate_name || `${app.first_name} ${app.last_name}` || "Candidate"}</h4>
                    <p className="text-sm text-muted-foreground truncate">
                      {app.job_title || "Applicant"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Select value={app.status || "received"} onValueChange={(v) => updateAppStatus(app.job_id, app.id, v)}>
                        <SelectTrigger className="h-6 text-xs w-[110px] bg-transparent">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="received">Received</SelectItem>
                          <SelectItem value="under_review">Reviewing</SelectItem>
                          <SelectItem value="accepted">Accepted</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                      <Badge variant={app.ai_score && app.ai_score > 75 ? "default" : "secondary"}>
                        {app.ai_score ? `Score: ${app.ai_score}` : "Pending AI"}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {app.created_at ? formatDistanceToNow(new Date(app.created_at), { addSuffix: true }) : ""}
                    </span>
                  </div>
                </div>
              ))}
              {applications.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">No applications found.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
