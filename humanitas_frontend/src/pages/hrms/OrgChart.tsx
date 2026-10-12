import React, { useState, useEffect, useRef, useMemo } from 'react';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  Users,
  Search,
  Filter,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Mail,
  Phone,
  ChevronDown,
  ChevronRight,
  GitBranch,
  X,
  Edit2,
  AlertCircle,
} from 'lucide-react';

export interface OrgNode {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: string;
  department?: string;
  position?: string;
  avatar_url?: string;
  manager_id?: string | null;
  manager_name?: string | null;
  direct_reports_count: number;
  team_count: number;
  children: OrgNode[];
}

interface ReportingChainData {
  user: OrgNode;
  ancestors: OrgNode[];
  directReports: OrgNode[];
  peers: OrgNode[];
}

export default function OrgChart() {
  const { hasPermission } = useAuth();
  const canEditUsers = hasPermission('edit_users') || hasPermission('manage_employees');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rootNodes, setRootNodes] = useState<OrgNode[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Canvas zoom & pan state
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Collapsed nodes state (map of nodeId -> boolean)
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  // Slide-over detail drawer state
  const [selectedEmployee, setSelectedEmployee] = useState<OrgNode | null>(null);
  const [reportingChain, setReportingChain] = useState<ReportingChainData | null>(null);
  const [loadingChain, setLoadingChain] = useState(false);

  // Manager re-assignment modal state
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [newManagerId, setNewManagerId] = useState<string>('');
  const [allFlatEmployees, setAllFlatEmployees] = useState<OrgNode[]>([]);
  const [reassigning, setReassigning] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);

  // Fetch Org Chart Data
  const fetchOrgChart = async () => {
    try {
      setLoading(true);
      setError(null);
      const deptParam = selectedDept !== 'all' ? `?department=${encodeURIComponent(selectedDept)}` : '';
      const data = await apiRequest<{
        totalEmployees: number;
        rootCount: number;
        departments: string[];
        rootNodes: OrgNode[];
      }>(`/users/org-chart${deptParam}`);

      setRootNodes(data.rootNodes || []);
      setTotalEmployees(data.totalEmployees || 0);
      setDepartments(data.departments || []);

      // Flatten list for re-assignment candidate dropdown
      const flatList: OrgNode[] = [];
      const collect = (nodes: OrgNode[]) => {
        nodes.forEach((n) => {
          flatList.push(n);
          if (n.children && n.children.length > 0) collect(n.children);
        });
      };
      collect(data.rootNodes || []);
      setAllFlatEmployees(flatList);
    } catch (err: any) {
      setError(err?.message || 'Failed to load organization chart');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgChart();
  }, [selectedDept]);

  // Handle employee card click -> fetch reporting chain and open drawer
  const handleSelectEmployee = async (employee: OrgNode) => {
    setSelectedEmployee(employee);
    setLoadingChain(true);
    try {
      const chain = await apiRequest<ReportingChainData>(`/users/${employee.id}/reporting-chain`);
      setReportingChain(chain);
    } catch (err) {
      console.error('Failed to load reporting chain:', err);
    } finally {
      setLoadingChain(false);
    }
  };

  // Toggle node collapse/expand
  const toggleNode = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  // Canvas Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Zoom controls
  const zoomIn = () => setScale((s) => Math.min(s + 0.15, 2.0));
  const zoomOut = () => setScale((s) => Math.max(s - 0.15, 0.4));
  const resetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  // Manager Reassignment handler
  const handleUpdateManager = async () => {
    if (!selectedEmployee) return;
    setReassigning(true);
    setReassignError(null);
    try {
      await apiRequest(`/users/${selectedEmployee.id}/manager`, {
        method: 'PATCH',
        body: JSON.stringify({
          managerId: newManagerId === 'none' ? null : newManagerId || null,
        }),
      });
      setIsReassignModalOpen(false);
      await fetchOrgChart();
      // Refresh current drawer details
      handleSelectEmployee(selectedEmployee);
    } catch (err: any) {
      setReassignError(err?.message || 'Failed to update manager');
    } finally {
      setReassigning(false);
    }
  };

  // Candidate managers: filter out selected employee and all of their descendants to prevent cycle!
  const eligibleManagers = useMemo(() => {
    if (!selectedEmployee) return [];
    const descendantIds = new Set<string>([selectedEmployee.id]);
    const collectDescendants = (node: OrgNode) => {
      if (node.children) {
        node.children.forEach((c) => {
          descendantIds.add(c.id);
          collectDescendants(c);
        });
      }
    };
    collectDescendants(selectedEmployee);

    return allFlatEmployees.filter((emp) => !descendantIds.has(emp.id));
  }, [selectedEmployee, allFlatEmployees]);

  // Color generator for department badge
  const getDeptColor = (dept?: string) => {
    if (!dept) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    const hash = dept.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
      'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
      'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    ];
    return colors[hash % colors.length];
  };

  // Recursive Tree Node Renderer
  const renderNode = (node: OrgNode, level = 0) => {
    const isCollapsed = collapsedNodes[node.id];
    const hasChildren = node.children && node.children.length > 0;
    const isMatched =
      searchQuery.trim() !== '' &&
      (node.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (node.position && node.position.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (node.department && node.department.toLowerCase().includes(searchQuery.toLowerCase())));

    return (
      <div key={node.id} className="flex flex-col items-center">
        {/* Node Card */}
        <div
          onClick={() => handleSelectEmployee(node)}
          className={`relative group cursor-pointer w-64 bg-card rounded-xl border p-4 shadow-sm hover:shadow-md transition-all duration-200 ${
            isMatched
              ? 'ring-2 ring-blue-500 border-blue-500 shadow-blue-100 dark:shadow-blue-950'
              : 'border-border hover:border-primary/50'
          }`}
        >
          {/* Top colored strip based on role */}
          <div
            className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl ${
              node.role === 'owner' || node.role === 'admin'
                ? 'bg-amber-500'
                : node.role === 'manager'
                ? 'bg-blue-600'
                : 'bg-emerald-500'
            }`}
          />

          <div className="flex items-start gap-3">
            {/* Avatar / Initials */}
            <div className="relative flex-shrink-0">
              {node.avatar_url ? (
                <img
                  src={node.avatar_url}
                  alt={node.full_name}
                  className="w-11 h-11 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm shadow-inner">
                  {node.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
              )}
              {node.direct_reports_count > 0 && (
                <span className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.2 rounded-full border-2 border-card">
                  {node.direct_reports_count}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                {node.full_name}
              </h4>
              <p className="text-xs text-muted-foreground truncate font-medium">
                {node.position || 'Employee'}
              </p>
              {node.department && (
                <span
                  className={`inline-block mt-1.5 text-[10px] font-medium px-2 py-0.5 rounded-md border ${getDeptColor(
                    node.department
                  )}`}
                >
                  {node.department}
                </span>
              )}
            </div>
          </div>

          {/* Card Footer */}
          <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1 font-medium">
              <Users className="w-3.5 h-3.5 text-primary/70" />
              {node.team_count > 0 ? `${node.team_count} in team` : 'Direct report'}
            </span>
            <span className="text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              View &rarr;
            </span>
          </div>

          {/* Expand/Collapse Button */}
          {hasChildren && (
            <button
              onClick={(e) => toggleNode(node.id, e)}
              className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-background border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors z-10"
              title={isCollapsed ? 'Expand reports' : 'Collapse reports'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Children Connector & Branch */}
        {hasChildren && !isCollapsed && (
          <div className="flex flex-col items-center">
            {/* Vertical line from parent to horizontal rail */}
            <div className="w-px h-6 bg-border" />

            {/* Children container with connector lines */}
            <div className="flex items-start gap-8 relative pt-6">
              {/* Horizontal line across children */}
              {node.children.length > 1 && (
                <div
                  className="absolute top-0 h-px bg-border"
                  style={{
                    left: 'calc(16rem / 2)',
                    right: 'calc(16rem / 2)',
                  }}
                />
              )}

              {node.children.map((child) => (
                <div key={child.id} className="relative flex flex-col items-center">
                  {/* Vertical drop line from horizontal rail to child */}
                  <div className="w-px h-6 bg-border -mt-6" />
                  {renderNode(child, level + 1)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-muted/20 select-none overflow-hidden">
      {/* Top Header & Toolbar */}
      <div className="bg-card border-b border-border px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 z-20">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <GitBranch className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Organizational Hierarchy
              </h1>
              <p className="text-xs text-muted-foreground">
                Visual reporting structure &bull; {totalEmployees} active personnel
              </p>
            </div>
          </div>
        </div>

        {/* Actions & Filters */}
        <div className="flex items-center gap-2.5">
          {/* Search */}
          <div className="relative w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search member or role..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-transparent border-none text-xs text-foreground focus:outline-none cursor-pointer"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div className="h-6 w-px bg-border mx-1" />

          {/* Zoom controls */}
          <div className="flex items-center border border-border rounded-lg bg-background p-0.5">
            <button
              onClick={zoomIn}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={zoomOut}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={resetView}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Canvas */}
      <div
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing p-12 flex justify-center items-start ${
          isDragging ? 'cursor-grabbing' : ''
        }`}
        style={{
          backgroundImage:
            'radial-gradient(circle, var(--tw-prose-bullets, #cbd5e1) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground m-auto">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
            <p className="text-xs font-medium">Constructing organizational tree...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-destructive m-auto">
            <AlertCircle className="w-8 h-8" />
            <p className="text-sm font-medium">{error}</p>
            <button
              onClick={fetchOrgChart}
              className="text-xs underline hover:text-foreground"
            >
              Retry
            </button>
          </div>
        ) : rootNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground m-auto">
            <Users className="w-10 h-10 stroke-1 text-muted-foreground/60" />
            <p className="text-sm font-medium">No personnel found in hierarchy</p>
          </div>
        ) : (
          <div
            className="transition-transform duration-75 origin-top flex flex-col items-center"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            }}
          >
            <div className="flex items-start gap-16">
              {rootNodes.map((root) => renderNode(root))}
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Detail Drawer */}
      {selectedEmployee && (
        <div className="fixed inset-y-0 right-0 w-96 bg-card border-l border-border shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-200">
          {/* Drawer Header */}
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h3 className="font-bold text-base text-foreground">Personnel Overview</h3>
            <button
              onClick={() => setSelectedEmployee(null)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Profile Card */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border border-border">
              {selectedEmployee.avatar_url ? (
                <img
                  src={selectedEmployee.avatar_url}
                  alt={selectedEmployee.full_name}
                  className="w-14 h-14 rounded-full object-cover border-2 border-primary/20"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-lg flex items-center justify-center">
                  {selectedEmployee.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-base text-foreground truncate">
                  {selectedEmployee.full_name}
                </h4>
                <p className="text-xs text-muted-foreground truncate font-medium">
                  {selectedEmployee.position || 'No Title Set'}
                </p>
                {selectedEmployee.department && (
                  <span
                    className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded border ${getDeptColor(
                      selectedEmployee.department
                    )}`}
                  >
                    {selectedEmployee.department}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Actions / Contact */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2.5 p-2 rounded-lg bg-background border border-border text-foreground">
                <Mail className="w-4 h-4 text-primary/80 flex-shrink-0" />
                <span className="truncate">{selectedEmployee.email}</span>
              </div>
              {selectedEmployee.phone && (
                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-background border border-border text-foreground">
                  <Phone className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{selectedEmployee.phone}</span>
                </div>
              )}
            </div>

            {/* Reporting Chain (Supervisor ladder) */}
            <div>
              <h5 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-3">
                Management Chain
              </h5>
              {loadingChain ? (
                <p className="text-xs text-muted-foreground">Tracing reporting line...</p>
              ) : reportingChain && reportingChain.ancestors.length > 0 ? (
                <div className="space-y-2 relative pl-4 border-l-2 border-primary/30 ml-2">
                  {reportingChain.ancestors.map((ancestor) => (
                    <div
                      key={ancestor.id}
                      onClick={() => handleSelectEmployee(ancestor)}
                      className="cursor-pointer group flex items-center gap-2.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <div className="w-2 h-2 rounded-full bg-primary -ml-[21px]" />
                      <span className="font-medium text-foreground group-hover:underline">
                        {ancestor.full_name}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate">
                        ({ancestor.position || 'Manager'})
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 text-xs text-primary font-bold">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary -ml-[22px] ring-2 ring-background" />
                    <span>{selectedEmployee.full_name} (Current)</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Top-level executive (No reporting manager assigned)
                </p>
              )}
            </div>

            {/* Direct Subordinates */}
            <div>
              <h5 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>Direct Reports ({reportingChain?.directReports.length || 0})</span>
              </h5>
              {reportingChain && reportingChain.directReports.length > 0 ? (
                <div className="space-y-2">
                  {reportingChain.directReports.map((report) => (
                    <div
                      key={report.id}
                      onClick={() => handleSelectEmployee(report)}
                      className="cursor-pointer p-2 rounded-lg bg-muted/30 border border-border hover:border-primary flex items-center justify-between text-xs transition-colors"
                    >
                      <div>
                        <p className="font-medium text-foreground">{report.full_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {report.position || 'Staff'}
                        </p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No direct reports.</p>
              )}
            </div>

            {/* Change Manager Action (if permitted) */}
            {canEditUsers && (
              <div className="pt-4 border-t border-border">
                <button
                  onClick={() => {
                    setNewManagerId(selectedEmployee.manager_id || 'none');
                    setReassignError(null);
                    setIsReassignModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Reassign Reporting Manager
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reassign Manager Modal */}
      {isReassignModalOpen && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-foreground mb-1">
              Reassign Reporting Manager
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Select a new supervisor for <strong>{selectedEmployee.full_name}</strong>. Cyclic
              reporting chains are strictly forbidden and filtered.
            </p>

            {reassignError && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{reassignError}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Assigned Manager
                </label>
                <select
                  value={newManagerId}
                  onChange={(e) => setNewManagerId(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="none">None (Top-Level Executive)</option>
                  {eligibleManagers.map((mgr) => (
                    <option key={mgr.id} value={mgr.id}>
                      {mgr.full_name} — {mgr.position || mgr.role} ({mgr.department || 'General'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setIsReassignModalOpen(false)}
                  disabled={reassigning}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateManager}
                  disabled={reassigning}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {reassigning ? 'Saving...' : 'Confirm Reassignment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
