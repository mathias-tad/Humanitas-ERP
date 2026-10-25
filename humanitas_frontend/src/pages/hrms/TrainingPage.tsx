import React, { useState } from 'react';
import { PageHeader } from '@/components/design-system/PageHeader';
import { KPITile } from '@/components/design-system/KPITile';
import { Button } from '@/components/ui/button';
import {
  GraduationCap,
  ShieldCheck,
  Award,
  Users,
  Plus,
  Search,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  ExternalLink,
  X,
  FileCheck,
} from 'lucide-react';
import {
  useCourses,
  useSessions,
  useEnrollments,
  useEmployeeSkills,
  useTrainingStats,
  useCreateCourse,
  useCreateSession,
  useEnrollLearner,
  useUpdateEnrollmentProgress,
  useUpsertEmployeeSkill,
  type TrainingCourse,
  type TrainingEnrollment,
} from '@/hooks/useTraining';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const CATEGORY_COLORS: Record<string, string> = {
  compliance: 'bg-rose-50 text-rose-700 border-rose-200',
  technical: 'bg-blue-50 text-blue-700 border-blue-200',
  leadership: 'bg-purple-50 text-purple-700 border-purple-200',
  safety: 'bg-amber-50 text-amber-700 border-amber-200',
  onboarding: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  soft_skills: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

const PROFICIENCY_COLORS: Record<string, string> = {
  beginner: 'bg-slate-100 text-slate-700 border-slate-200',
  intermediate: 'bg-sky-50 text-sky-700 border-sky-200',
  advanced: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  expert: 'bg-purple-50 text-purple-700 border-purple-200',
};

export default function TrainingPage() {
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission('manage_training') || user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'owner';
  const canEnroll = hasPermission('enroll_training') || hasPermission('manage_training') || true;

  const [activeTab, setActiveTab] = useState<'courses' | 'sessions' | 'enrollments' | 'skills'>('courses');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [showCourseModal, setShowCourseModal] = useState<boolean>(false);
  const [showSessionModal, setShowSessionModal] = useState<boolean>(false);
  const [showEnrollModal, setShowEnrollModal] = useState<boolean>(false);
  const [showProgressModal, setShowProgressModal] = useState<boolean>(false);
  const [showSkillModal, setShowSkillModal] = useState<boolean>(false);

  // Selected items for modal operations
  const [selectedCourseForEnroll, setSelectedCourseForEnroll] = useState<TrainingCourse | null>(null);
  const [selectedEnrollmentForUpdate, setSelectedEnrollmentForUpdate] = useState<TrainingEnrollment | null>(null);

  // Queries
  const { data: stats } = useTrainingStats();
  const { data: courses = [] } = useCourses(
    selectedCategory !== 'all' ? { category: selectedCategory } : undefined,
  );
  const { data: sessions = [] } = useSessions();
  const { data: enrollments = [] } = useEnrollments();
  const { data: skills = [] } = useEmployeeSkills();
  const { data: users = [] } = useUsers();

  // Mutations
  const createCourseMutation = useCreateCourse();
  const createSessionMutation = useCreateSession();
  const enrollLearnerMutation = useEnrollLearner();
  const updateProgressMutation = useUpdateEnrollmentProgress();
  const upsertSkillMutation = useUpsertEmployeeSkill();

  // Form states
  const [courseForm, setCourseForm] = useState({
    title: '',
    category: 'compliance',
    description: '',
    prerequisites: '',
    delivery_method: 'online' as 'online' | 'in_person' | 'blended',
    duration_hours: 2,
    capacity_limit: 50,
    is_mandatory: false,
    passing_score: 80,
    provider_name: '',
    cost_per_learner: 0,
  });

  const [sessionForm, setSessionForm] = useState({
    course_id: '',
    instructor_name: '',
    venue_or_link: '',
    start_time: '',
    end_time: '',
    max_participants: 30,
  });

  const [enrollForm, setEnrollForm] = useState({
    course_id: '',
    session_id: '',
    user_id: '',
  });

  const [progressForm, setProgressForm] = useState({
    status: 'completed' as any,
    completion_percentage: 100,
    score: 85,
    attendance_confirmed: true,
    certificate_issued: true,
  });

  const [skillForm, setSkillForm] = useState({
    user_id: '',
    skill_name: '',
    category: 'Technical',
    proficiency_level: 'intermediate' as any,
    verified: false,
  });

  // Filtered courses
  const filteredCourses = courses.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.provider_name && c.provider_name.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCourseMutation.mutateAsync(courseForm);
      toast.success('Training course created successfully');
      setShowCourseModal(false);
      setCourseForm({
        title: '',
        category: 'compliance',
        description: '',
        prerequisites: '',
        delivery_method: 'online',
        duration_hours: 2,
        capacity_limit: 50,
        is_mandatory: false,
        passing_score: 80,
        provider_name: '',
        cost_per_learner: 0,
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to create course');
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSessionMutation.mutateAsync(sessionForm);
      toast.success('Cohort session scheduled successfully');
      setShowSessionModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to schedule session');
    }
  };

  const handleEnrollLearner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await enrollLearnerMutation.mutateAsync(enrollForm);
      toast.success('Learner enrollment registered successfully');
      setShowEnrollModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to enroll learner');
    }
  };

  const handleUpdateProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnrollmentForUpdate) return;
    try {
      await updateProgressMutation.mutateAsync({
        id: selectedEnrollmentForUpdate.id,
        data: progressForm,
      });
      toast.success('Enrollment progress and certification updated');
      setShowProgressModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update progress');
    }
  };

  const handleUpsertSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await upsertSkillMutation.mutateAsync(skillForm);
      toast.success('Employee skill recorded in matrix');
      setShowSkillModal(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to log skill');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Training & Learning Management (LMS)"
        description="Enterprise learning catalog, compliance training certification, cohort scheduling, and workforce skills matrix."
        actions={
          <div className="flex items-center gap-2">
            {canManage && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSkillModal(true)}
                  className="gap-2 text-xs"
                >
                  <Award className="h-4 w-4 text-purple-600" />
                  Endorse Skill
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSessionModal(true)}
                  className="gap-2 text-xs"
                >
                  <Calendar className="h-4 w-4 text-primary" />
                  Schedule Session
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowCourseModal(true)}
                  className="gap-2 text-xs"
                >
                  <Plus className="h-4 w-4" />
                  New Course
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPITile
          title="Active Curricula"
          value={stats?.total_courses?.toString() || '0'}
          subtitle={`${stats?.mandatory_courses || 0} mandatory compliance`}
          icon={BookOpen}
          iconColor="text-primary"
          iconBg="bg-primary/10"
        />
        <KPITile
          title="Compliance Rate"
          value={`${stats?.compliance_rate || 0}%`}
          subtitle="Mandatory training coverage"
          icon={ShieldCheck}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-100"
        />
        <KPITile
          title="Active Learners"
          value={stats?.active_enrollments?.toString() || '0'}
          subtitle={`${stats?.completed_enrollments || 0} completions (${stats?.completion_rate || 0}%)`}
          icon={Users}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-100"
        />
        <KPITile
          title="Skills Verified"
          value={stats?.verified_skills?.toString() || '0'}
          subtitle={`${stats?.total_skills_logged || 0} skills in workforce matrix`}
          icon={Award}
          iconColor="text-amber-600"
          iconBg="bg-amber-100"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border text-sm font-medium">
        <button
          onClick={() => setActiveTab('courses')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
            activeTab === 'courses'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Course Catalog
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
            activeTab === 'sessions'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar className="h-4 w-4" />
          Cohorts & Sessions ({sessions.length})
        </button>
        <button
          onClick={() => setActiveTab('enrollments')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
            activeTab === 'enrollments'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <GraduationCap className="h-4 w-4" />
          Enrollments & Compliance ({enrollments.length})
        </button>
        <button
          onClick={() => setActiveTab('skills')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 transition-colors ${
            activeTab === 'skills'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Award className="h-4 w-4" />
          Skills Matrix & Heatmap
        </button>
      </div>

      {/* ── TAB 1: COURSE CATALOG ────────────────────────────────────────────── */}
      {activeTab === 'courses' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {['all', 'compliance', 'technical', 'leadership', 'safety', 'onboarding'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    selectedCategory === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {cat === 'all' ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-input bg-background pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCourses.map((course) => (
              <div
                key={course.id}
                className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${
                        CATEGORY_COLORS[course.category] || 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {course.category.toUpperCase()}
                    </span>
                    {course.is_mandatory && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">
                        <AlertTriangle className="h-3 w-3" />
                        MANDATORY
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 text-sm font-bold text-foreground line-clamp-2">
                    {course.title}
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-3">
                    {course.description || 'No course overview provided.'}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2.5 text-xs">
                    <div>
                      <span className="text-muted-foreground">Delivery:</span>{' '}
                      <span className="font-semibold capitalize text-foreground">
                        {course.delivery_method.replace('_', ' ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>{' '}
                      <span className="font-semibold text-foreground">
                        {course.duration_hours} hr(s)
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Passing:</span>{' '}
                      <span className="font-semibold text-foreground">
                        {course.passing_score}%
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Provider:</span>{' '}
                      <span className="font-semibold text-foreground truncate block">
                        {course.provider_name || 'Internal'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{course.total_enrolled || 0}</span> enrolled
                    {course.total_completed ? ` â€¢ ${course.total_completed} certified` : ''}
                  </div>
                  {canEnroll && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => {
                        setSelectedCourseForEnroll(course);
                        setEnrollForm({
                          course_id: course.id,
                          session_id: '',
                          user_id: user?.id || '',
                        });
                        setShowEnrollModal(true);
                      }}
                      className="text-xs gap-1.5"
                    >
                      <GraduationCap className="h-3.5 w-3.5" />
                      Enroll
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 2: COHORTS & SESSIONS ────────────────────────────────────────── */}
      {activeTab === 'sessions' && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-sm">Scheduled Live Cohorts & Training Sessions</h3>
            {canManage && (
              <Button size="sm" onClick={() => setShowSessionModal(true)} className="text-xs gap-1">
                <Plus className="h-3.5 w-3.5" />
                Schedule Session
              </Button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border">
                <tr>
                  <th className="p-3">Course / Curricula</th>
                  <th className="p-3">Instructor</th>
                  <th className="p-3">Venue / Digital Room</th>
                  <th className="p-3">Schedule Time</th>
                  <th className="p-3">Capacity</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-muted/20">
                    <td className="p-3 font-semibold text-foreground">
                      {session.course_title}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {session.instructor_name || 'TBA'}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {session.venue_or_link ? (
                        <span className="flex items-center gap-1 text-primary">
                          <ExternalLink className="h-3 w-3" />
                          {session.venue_or_link}
                        </span>
                      ) : (
                        'Internal Academy'
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-foreground">
                        {new Date(session.start_time).toLocaleDateString()}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                        {new Date(session.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {session.enrolled_count || 0} / {session.max_participants}
                        </span>
                        <div className="h-1.5 w-16 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{
                              width: `${Math.min(100, ((session.enrolled_count || 0) / session.max_participants) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        {session.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: ENROLLMENTS & COMPLIANCE ──────────────────────────────────── */}
      {activeTab === 'enrollments' && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-sm">Learner Progress & Certification Compliance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border">
                <tr>
                  <th className="p-3">Learner</th>
                  <th className="p-3">Course Title</th>
                  <th className="p-3">Compliance Status</th>
                  <th className="p-3">Progress</th>
                  <th className="p-3">Exam Score</th>
                  <th className="p-3">Certification Expiry</th>
                  {canManage && <th className="p-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {enrollments.map((enr) => (
                  <tr key={enr.id} className="hover:bg-muted/20">
                    <td className="p-3">
                      <div className="font-semibold text-foreground">{enr.user_name || 'Employee'}</div>
                      <div className="text-[11px] text-muted-foreground">{enr.user_department || enr.user_email}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-foreground">{enr.course_title}</div>
                      {enr.is_mandatory && (
                        <span className="text-[10px] font-bold text-rose-600">Mandatory</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          enr.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700'
                            : enr.status === 'confirmed'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {enr.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{enr.completion_percentage}%</span>
                        <div className="h-1.5 w-20 rounded-full bg-secondary overflow-hidden">
                          <div
                            className={`h-full ${
                              enr.completion_percentage >= 100 ? 'bg-emerald-500' : 'bg-primary'
                            }`}
                            style={{ width: `${enr.completion_percentage}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      {enr.score !== undefined && enr.score !== null ? (
                        <span className="font-bold text-foreground">{enr.score}%</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3">
                      {enr.expiry_date ? (
                        <span className="text-muted-foreground font-medium">
                          {new Date(enr.expiry_date).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </td>
                    {canManage && (
                      <td className="p-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedEnrollmentForUpdate(enr);
                            setProgressForm({
                              status: enr.status,
                              completion_percentage: enr.completion_percentage,
                              score: enr.score || 85,
                              attendance_confirmed: enr.attendance_confirmed,
                              certificate_issued: enr.certificate_issued,
                            });
                            setShowProgressModal(true);
                          }}
                          className="text-xs h-7 gap-1"
                        >
                          <FileCheck className="h-3.5 w-3.5 text-primary" />
                          Certify
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: SKILLS MATRIX ────────────────────────────────────────────── */}
      {activeTab === 'skills' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-semibold text-sm">Workforce Competency & Skills Matrix</h3>
              <Button size="sm" onClick={() => setShowSkillModal(true)} className="text-xs gap-1">
                <Plus className="h-3.5 w-3.5" />
                Add Skill
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {skills.map((skill) => (
                <div
                  key={skill.id}
                  className="rounded-lg border border-border bg-card p-3.5 shadow-sm space-y-2 hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-foreground">{skill.skill_name}</h4>
                      <p className="text-[11px] text-muted-foreground">{skill.category}</p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold capitalize ${
                        PROFICIENCY_COLORS[skill.proficiency_level] || 'bg-slate-50 text-slate-700'
                      }`}
                    >
                      {skill.proficiency_level}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[11px]">
                    <span className="text-muted-foreground font-medium">{skill.user_name || 'Staff'}</span>
                    {skill.verified ? (
                      <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                        <CheckCircle2 className="h-3 w-3" />
                        Verified
                      </span>
                    ) : (
                      <span className="text-amber-600 font-medium">Self-Reported</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CREATE COURSE ─────────────────────────────────────────────── */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold">Create New Learning Curricula</h3>
              <button onClick={() => setShowCourseModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCourse} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">Course Title</label>
                <input
                  type="text"
                  value={courseForm.title}
                  onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-xs"
                  placeholder="e.g. Advanced Cybersecurity Defense"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Category</label>
                  <select
                    value={courseForm.category}
                    onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-xs"
                  >
                    <option value="compliance">Compliance</option>
                    <option value="technical">Technical</option>
                    <option value="leadership">Leadership</option>
                    <option value="safety">Safety</option>
                    <option value="onboarding">Onboarding</option>
                    <option value="soft_skills">Soft Skills</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Delivery Method</label>
                  <select
                    value={courseForm.delivery_method}
                    onChange={(e) => setCourseForm({ ...courseForm, delivery_method: e.target.value as any })}
                    className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-xs"
                  >
                    <option value="online">Online E-Learning</option>
                    <option value="in_person">In-Person Cohort</option>
                    <option value="blended">Blended Learning</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Overview & Description</label>
                <textarea
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-xs"
                  rows={2}
                  placeholder="Core learning objectives..."
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Duration (Hours)</label>
                  <input
                    type="number"
                    value={courseForm.duration_hours}
                    onChange={(e) => setCourseForm({ ...courseForm, duration_hours: parseFloat(e.target.value) || 1 })}
                    className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-xs"
                    min="0.5"
                    step="0.5"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Passing Score (%)</label>
                  <input
                    type="number"
                    value={courseForm.passing_score}
                    onChange={(e) => setCourseForm({ ...courseForm, passing_score: parseInt(e.target.value) || 80 })}
                    className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-xs"
                    min="0"
                    max="100"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Cost / Learner ($)</label>
                  <input
                    type="number"
                    value={courseForm.cost_per_learner}
                    onChange={(e) => setCourseForm({ ...courseForm, cost_per_learner: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-xs"
                    min="0"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_mandatory_cb"
                  checked={courseForm.is_mandatory}
                  onChange={(e) => setCourseForm({ ...courseForm, is_mandatory: e.target.checked })}
                  className="rounded border-input text-primary"
                />
                <label htmlFor="is_mandatory_cb" className="text-xs font-medium text-foreground cursor-pointer">
                  Mandatory Compliance Training (Enforced organization-wide)
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowCourseModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={createCourseMutation.isPending}>
                  Create Course
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: SCHEDULE SESSION ──────────────────────────────────────────── */}
      {showSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold">Schedule Training Cohort</h3>
              <button onClick={() => setShowSessionModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSession} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">Course</label>
                <select
                  value={sessionForm.course_id}
                  onChange={(e) => setSessionForm({ ...sessionForm, course_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-xs"
                  required
                >
                  <option value="">Select course...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Instructor / Speaker</label>
                <input
                  type="text"
                  value={sessionForm.instructor_name}
                  onChange={(e) => setSessionForm({ ...sessionForm, instructor_name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-xs"
                  placeholder="e.g. Dr. Alex Mercer"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Venue / Digital Meeting Link</label>
                <input
                  type="text"
                  value={sessionForm.venue_or_link}
                  onChange={(e) => setSessionForm({ ...sessionForm, venue_or_link: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-xs"
                  placeholder="Conference Hall A or https://zoom.us/j/..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Start Time</label>
                  <input
                    type="datetime-local"
                    value={sessionForm.start_time}
                    onChange={(e) => setSessionForm({ ...sessionForm, start_time: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">End Time</label>
                  <input
                    type="datetime-local"
                    value={sessionForm.end_time}
                    onChange={(e) => setSessionForm({ ...sessionForm, end_time: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-xs"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowSessionModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={createSessionMutation.isPending}>
                  Schedule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ENROLL LEARNER ────────────────────────────────────────────── */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold">Enroll in Training</h3>
              <button onClick={() => setShowEnrollModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleEnrollLearner} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">Course</label>
                <input
                  type="text"
                  disabled
                  value={selectedCourseForEnroll?.title || ''}
                  className="mt-1 w-full rounded-lg border border-input bg-muted p-2 text-xs font-semibold text-foreground"
                />
              </div>
              {canManage && (
                <div>
                  <label className="text-xs font-semibold text-foreground">Learner / Employee</label>
                  <select
                    value={enrollForm.user_id}
                    onChange={(e) => setEnrollForm({ ...enrollForm, user_id: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-xs"
                    required
                  >
                    <option value="">Select employee...</option>
                    {users.map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.name} ({u.department || 'General'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowEnrollModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={enrollLearnerMutation.isPending}>
                  Confirm Enrollment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: UPDATE PROGRESS / CERTIFY ─────────────────────────────────── */}
      {showProgressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold">Certify Learner Completion</h3>
              <button onClick={() => setShowProgressModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleUpdateProgress} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">Learner</label>
                <input
                  type="text"
                  disabled
                  value={selectedEnrollmentForUpdate?.user_name || ''}
                  className="mt-1 w-full rounded-lg border border-input bg-muted p-2 text-xs font-semibold text-foreground"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Status</label>
                  <select
                    value={progressForm.status}
                    onChange={(e) => setProgressForm({ ...progressForm, status: e.target.value as any })}
                    className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-xs"
                  >
                    <option value="confirmed">Confirmed</option>
                    <option value="attended">Attended</option>
                    <option value="completed">Completed & Certified</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Score (%)</label>
                  <input
                    type="number"
                    value={progressForm.score}
                    onChange={(e) => setProgressForm({ ...progressForm, score: parseInt(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-xs"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Completion Progress (%)</label>
                <input
                  type="number"
                  value={progressForm.completion_percentage}
                  onChange={(e) => setProgressForm({ ...progressForm, completion_percentage: parseInt(e.target.value) || 0 })}
                  className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-xs"
                  min="0"
                  max="100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowProgressModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={updateProgressMutation.isPending}>
                  Save Progress
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD / ENDORSE SKILL ───────────────────────────────────────── */}
      {showSkillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold">Endorse Workforce Skill</h3>
              <button onClick={() => setShowSkillModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleUpsertSkill} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">Employee</label>
                <select
                  value={skillForm.user_id}
                  onChange={(e) => setSkillForm({ ...skillForm, user_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-xs"
                  required
                >
                  <option value="">Select employee...</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.name} ({u.department || 'General'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Skill Name</label>
                <input
                  type="text"
                  value={skillForm.skill_name}
                  onChange={(e) => setSkillForm({ ...skillForm, skill_name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-xs"
                  placeholder="e.g. Cloud Security Architecture"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">Category</label>
                  <input
                    type="text"
                    value={skillForm.category}
                    onChange={(e) => setSkillForm({ ...skillForm, category: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-xs"
                    placeholder="e.g. Engineering, Sales"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Proficiency</label>
                  <select
                    value={skillForm.proficiency_level}
                    onChange={(e) => setSkillForm({ ...skillForm, proficiency_level: e.target.value as any })}
                    className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-xs"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
              </div>
              {canManage && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="verified_cb"
                    checked={skillForm.verified}
                    onChange={(e) => setSkillForm({ ...skillForm, verified: e.target.checked })}
                    className="rounded border-input text-primary"
                  />
                  <label htmlFor="verified_cb" className="text-xs font-medium text-foreground cursor-pointer">
                    Officially Verified by HR / Team Lead
                  </label>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button variant="outline" size="sm" type="button" onClick={() => setShowSkillModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={upsertSkillMutation.isPending}>
                  Save Skill
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
