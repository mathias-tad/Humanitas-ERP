import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  MoreVertical,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  FolderKanban,
  Pencil,
  Trash2,
  Loader2,
  Lock,
  Globe,
} from "lucide-react";
import { useState } from "react";
import { ProjectModal, type ProjectFormData } from "@/components/pms/ProjectModal";
import { ProjectMembersModal } from "@/components/pms/ProjectMembersModal";
import { DeleteModal } from "@/components/pms/DeleteModal";
import { usePMS, ProjectStatus, ProjectPriority, type Project } from "@/hooks/usePMS";

const getStatusColor = (status: ProjectStatus | string) => {
  switch (status) {
    case ProjectStatus.ACTIVE:
      return "bg-green-100 text-green-800";
    case ProjectStatus.ON_HOLD:
      return "bg-yellow-100 text-yellow-800";
    case ProjectStatus.COMPLETED:
      return "bg-primary/10 text-primary";
    case ProjectStatus.PLANNING:
      return "bg-purple-100 text-purple-800";
    case ProjectStatus.ARCHIVED:
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getPriorityColor = (priority: ProjectPriority | string) => {
  switch (priority) {
    case ProjectPriority.HIGH:
      return "bg-red-100 text-red-800";
    case ProjectPriority.MEDIUM:
      return "bg-orange-100 text-orange-800";
    case ProjectPriority.LOW:
      return "bg-gray-100 text-gray-800";
    case ProjectPriority.CRITICAL:
      return "bg-red-200 text-red-900";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export default function PMSProjects() {
  const {
    useProjects,
    createProject,
    updateProject,
    deleteProject
  } = usePMS();

  const { data: projects = [], isLoading } = useProjects();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");

  // Modal states
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || project.status === statusFilter;
    const matchesVisibility =
      visibilityFilter === "all" || (project.visibility || "public") === visibilityFilter;
    return matchesSearch && matchesStatus && matchesVisibility && project.status !== ProjectStatus.ARCHIVED;
  });

  const projectStats = {
    total: projects.filter(p => p.status !== ProjectStatus.ARCHIVED).length,
    active: projects.filter((p) => p.status === ProjectStatus.ACTIVE).length,
    completed: projects.filter((p) => p.status === ProjectStatus.COMPLETED).length,
    onHold: projects.filter((p) => p.status === ProjectStatus.ON_HOLD).length,
  };

  const handleSaveProject = async (projectData: ProjectFormData) => {
    if (selectedProject) {
      await updateProject.mutateAsync({ id: selectedProject.id, data: projectData });
    } else {
      await createProject.mutateAsync(projectData);
    }
    setIsProjectModalOpen(false);
    setSelectedProject(null);
  };

  const handleManageMembers = (project: Project) => {
    setSelectedProject(project);
    setIsMembersModalOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setSelectedProject(project);
    setIsProjectModalOpen(true);
  };

  const handleDeleteClick = (project: Project) => {
    setSelectedProject(project);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (selectedProject) {
      await deleteProject.mutateAsync(selectedProject.id);
      setIsDeleteModalOpen(false);
      setSelectedProject(null);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="text-gray-500 mt-1">
              Manage and track all your projects
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedProject(null);
              setIsProjectModalOpen(true);
            }}
            className="px-4 py-2 !bg-primary !text-primary-foreground rounded-lg hover:!bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="py-3">
            <CardContent className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <FolderKanban className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Projects</p>
                <p className="text-2xl font-bold">{projectStats.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-3">
            <CardContent className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100">
                <Clock className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-2xl font-bold">{projectStats.active}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-3">
            <CardContent className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-100">
                <CheckCircle2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-2xl font-bold">{projectStats.completed}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="py-3">
            <CardContent className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-100">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">On Hold</p>
                <p className="text-2xl font-bold">{projectStats.onHold}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search projects..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value={ProjectStatus.ACTIVE}>Active</option>
                <option value={ProjectStatus.PLANNING}>Planning</option>
                <option value={ProjectStatus.ON_HOLD}>On Hold</option>
                <option value={ProjectStatus.COMPLETED}>Completed</option>
              </select>
              <select
                className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={visibilityFilter}
                onChange={(e) => setVisibilityFilter(e.target.value)}
              >
                <option value="all">All Confidentiality</option>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Card
              key={project.id}
              className="hover:shadow-lg transition-shadow"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      {project.visibility === 'private' ? (
                        <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 text-xs flex items-center gap-1">
                          <Lock className="h-3 w-3" /> Private
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground border-gray-200 text-xs flex items-center gap-1">
                          <Globe className="h-3 w-3" /> Public
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(project.status)}>
                        {project.status}
                      </Badge>
                      <Badge className={getPriorityColor(project.priority)}>
                        {project.priority}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 hover:bg-gray-100 rounded">
                        <MoreVertical className="h-4 w-4 text-gray-400" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditProject(project)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleManageMembers(project)}>
                        <Users className="mr-2 h-4 w-4" />
                        Manage Members
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => handleDeleteClick(project)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600 line-clamp-2">
                  {project.description}
                </p>

                {/* Progress - Placeholder until KPI integration */}
                {/*
                 <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Progress</span>
                    <span className="font-medium">{0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(0)}`}
                      style={{ width: `0%` }}
                    />
                  </div>
                   <p className="text-xs text-gray-400">
                    Calculated from Tasks
                   </p>
                </div>
                 */}

                {/* Dates */}
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{project.start_date || 'TBD'}</span>
                  </div>
                  <span>-</span>
                  <span>{project.target_end_date || 'TBD'}</span>
                </div>

                {/* Team */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-500">
                      {project.members?.length || 0} members
                    </span>
                  </div>
                  <div className="flex -space-x-2">
                    {project.members?.slice(0, 3).map((member, index) => (
                      <Avatar
                        key={index}
                        className="h-7 w-7 border-2 border-white"
                      >
                        <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                          {member.user.full_name?.[0] || '?'}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {(project.members?.length || 0) > 3 && (
                      <div className="h-7 w-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center">
                        <span className="text-xs text-gray-600">
                          +{(project.members?.length || 0) - 3}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredProjects.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {isLoading ? 'Loading projects...' : 'No projects found matching your criteria.'}
          </div>
        )}
      </div>

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSave={handleSaveProject}
        project={selectedProject as any} // temporary cast if types slightly mismatch
      />

      {selectedProject && (
        <ProjectMembersModal
          isOpen={isMembersModalOpen}
          onClose={() => setIsMembersModalOpen(false)}
          project={selectedProject}
        />
      )}

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Project"
        description="Are you sure you want to delete this project? This action cannot be undone."
      />
    </>
  );
}
