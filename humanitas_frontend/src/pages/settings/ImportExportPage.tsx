import React, { useState } from 'react';
import { PageHeader } from '@/components/design-system/PageHeader';
import { KPITile } from '@/components/design-system/KPITile';
import { Button } from '@/components/ui/button';
import {
  Upload,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Calendar,
  RefreshCw,
  Plus,
  X,
  FileCheck,
} from 'lucide-react';
import {
  useImportExportStats,
  useImportExportJobs,
  useTemplateSchema,
  useExportTemplates,
  useValidateImport,
  useCommitImport,
  useRollbackImport,
  useTriggerExport,
  useCreateExportTemplate,
  useUpdateExportTemplate,
  type EntityType,
  type ImportMode,
  type ImportValidationResult,
} from '@/hooks/useImportExport';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export default function ImportExportPage() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'import' | 'export' | 'audit' | 'schedules'>('import');

  // Permissions
  const canImport = hasPermission('manage_import') || hasPermission('owner') || hasPermission('admin');
  const canRollback = hasPermission('rollback_import') || hasPermission('owner') || hasPermission('admin');
  const canManageSchedules = hasPermission('manage_export_schedules') || hasPermission('owner') || hasPermission('admin');

  // Queries
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useImportExportStats();
  const { data: jobs = [], refetch: refetchJobs } = useImportExportJobs();
  const { data: templates = [], refetch: refetchTemplates } = useExportTemplates();

  // Tab 1: Import State
  const [selectedImportEntity, setSelectedImportEntity] = useState<EntityType>('employees');
  const [importMode, setImportMode] = useState<ImportMode>('create_only');
  const [parsedRows, setParsedRows] = useState<Record<string, any>[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);

  const { data: schema } = useTemplateSchema(selectedImportEntity);
  const validateMutation = useValidateImport();
  const commitMutation = useCommitImport();
  const rollbackMutation = useRollbackImport();

  // Tab 2: Export State
  const [selectedExportEntity, setSelectedExportEntity] = useState<EntityType>('employees');
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx' | 'pdf'>('csv');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [recipeName, setRecipeName] = useState('');
  const [recipeCron, setRecipeCron] = useState('0 9 * * 1'); // Monday 9am
  const [recipeEmail, setRecipeEmail] = useState('');

  const exportMutation = useTriggerExport();
  const createTemplateMutation = useCreateExportTemplate();
  const updateTemplateMutation = useUpdateExportTemplate();

  // Helper: Handle file parse
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setValidationResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          toast.error('File must contain at least a header line and one data row.');
          return;
        }

        const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
        const rows: Record<string, any>[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
          const rowObj: Record<string, any> = {};
          headers.forEach((h, idx) => {
            rowObj[h] = values[idx] !== undefined ? values[idx] : '';
          });
          rows.push(rowObj);
        }

        setParsedRows(rows);
        toast.info(`Parsed ${rows.length} rows from ${file.name}. Click "Validate & Preview" to proceed.`);
      } catch (err) {
        toast.error('Failed to parse file. Please upload a valid CSV file.');
      }
    };
    reader.readAsText(file);
  };

  // Helper: Trigger Validation
  const handleValidate = async () => {
    if (!parsedRows.length) {
      toast.error('Please upload a file with data rows first.');
      return;
    }

    try {
      const res = await validateMutation.mutateAsync({
        entity_type: selectedImportEntity,
        mode: importMode,
        rows: parsedRows,
        file_name: uploadedFileName,
      });
      setValidationResult(res);
      if (res.is_valid) {
        toast.success(`Validation passed! All ${res.total_rows} rows are clean.`);
      } else {
        toast.warning(`Validation flagged ${res.error_rows_count} rows with potential errors.`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Validation failed');
    }
  };

  // Helper: Trigger Commit
  const handleCommit = async () => {
    if (!validationResult) return;

    try {
      await commitMutation.mutateAsync({
        job_id: validationResult.job_id,
        entity_type: selectedImportEntity,
        mode: importMode,
        validated_rows: parsedRows,
      });
      toast.success(`Import committed successfully! 24-hour rollback window is active.`);
      setValidationResult(null);
      setParsedRows([]);
      setUploadedFileName('');
      refetchJobs();
      refetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Commit failed');
    }
  };

  // Helper: Download Template
  const handleDownloadTemplate = () => {
    if (!schema) return;
    const headerRow = schema.headers.join(',');
    const exampleRow = schema.headers.map((h) => `"${schema.example[h] ?? ''}"`).join(',');
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent([headerRow, exampleRow].join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `${schema.entity}_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Downloaded ${schema.entity} import template.`);
  };

  // Helper: Trigger Export
  const handleExport = async () => {
    try {
      const res = await exportMutation.mutateAsync({
        entity_type: selectedExportEntity,
        format: exportFormat,
        selected_fields: selectedFields.length > 0 ? selectedFields : undefined,
      });

      if (exportFormat === 'csv' && typeof res.data === 'string') {
        const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', res.file_name);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      toast.success(`Export generated: ${res.file_name} (${res.total_rows} rows)`);
      refetchJobs();
      refetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Export failed');
    }
  };

  // Helper: Rollback Job
  const handleRollback = async (jobId: string) => {
    if (!confirm('Are you sure you want to rollback this import batch? All inserted records will be reverted.')) {
      return;
    }
    try {
      await rollbackMutation.mutateAsync(jobId);
      toast.success('Import batch rolled back successfully.');
      refetchJobs();
      refetchStats();
    } catch (err: any) {
      toast.error(err.message || 'Rollback failed');
    }
  };

  // Helper: Save Recipe
  const handleSaveRecipe = async () => {
    if (!recipeName.trim()) {
      toast.error('Recipe name is required');
      return;
    }
    try {
      await createTemplateMutation.mutateAsync({
        name: recipeName,
        entity_type: selectedExportEntity,
        selected_fields: selectedFields,
        schedule_cron: recipeCron || undefined,
        delivery_email: recipeEmail || undefined,
      });
      toast.success('Export recipe & schedule saved!');
      setShowScheduleModal(false);
      setRecipeName('');
      refetchTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save recipe');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Bulk Import / Export Engine"
        description="Enterprise data ingestion, format transformation, automated recurring exports, and 24-hour rollback governance."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchStats();
                refetchJobs();
                refetchTemplates();
              }}
            >
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPITile
          title="Total Imports Processed"
          value={statsLoading ? '...' : (stats?.total_imports ?? 0).toString()}
          icon={Upload}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          subtitle="Batch data files ingested"
        />
        <KPITile
          title="Total Exports Generated"
          value={statsLoading ? '...' : (stats?.total_exports ?? 0).toString()}
          icon={Download}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          subtitle="CSV, Excel & PDF files"
        />
        <KPITile
          title="Total Records Managed"
          value={statsLoading ? '...' : (stats?.total_rows_processed ?? 0).toLocaleString()}
          icon={FileSpreadsheet}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
          subtitle="Clean rows processed"
        />
        <KPITile
          title="Pipeline Success Rate"
          value={statsLoading ? '...' : `${stats?.success_rate_pct ?? 100}%`}
          icon={CheckCircle2}
          iconColor="text-green-600"
          iconBg="bg-green-50"
          subtitle={`${stats?.active_schedules ?? 0} active scheduled cron exports`}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="border-b flex gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('import')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'import'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Upload className="h-4 w-4" />
          Bulk Import Center
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'export'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Download className="h-4 w-4" />
          Bulk Export Studio
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'audit'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <RotateCcw className="h-4 w-4" />
          Audit Log & 24h Rollback
        </button>
        <button
          onClick={() => setActiveTab('schedules')}
          className={`pb-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'schedules'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar className="h-4 w-4" />
          Saved Recipes & Schedules ({templates.length})
        </button>
      </div>

      {/* Tab 1: Bulk Import Center */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1: Configuration */}
            <div className="border rounded-xl p-5 bg-card space-y-4">
              <div className="font-semibold flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">1</span>
                Select Entity & Rules
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Target Entity</label>
                <select
                  value={selectedImportEntity}
                  onChange={(e) => {
                    setSelectedImportEntity(e.target.value as EntityType);
                    setValidationResult(null);
                    setParsedRows([]);
                  }}
                  className="w-full mt-1.5 p-2.5 border rounded-lg bg-background text-sm font-medium"
                >
                  <option value="employees">Employees (Master Directory)</option>
                  <option value="attendance">Attendance Records (Logs & Punches)</option>
                  <option value="leave_balances">Leave Balances & Allocations</option>
                  <option value="payroll_adjustments">Payroll Adjustments & Bonuses</option>
                  <option value="assets">Assets & Equipment Catalog</option>
                  <option value="training_records">Training Courses & LMS Records</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Import Mode</label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setImportMode('create_only')}
                    className={`p-2 border rounded-lg text-xs font-medium text-left transition-colors ${
                      importMode === 'create_only'
                        ? 'border-primary bg-primary/5 text-primary font-semibold'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    <div>Create Only</div>
                    <div className="text-[10px] text-muted-foreground">Skip existing duplicates</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('upsert')}
                    className={`p-2 border rounded-lg text-xs font-medium text-left transition-colors ${
                      importMode === 'upsert'
                        ? 'border-primary bg-primary/5 text-primary font-semibold'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    <div>Upsert / Update</div>
                    <div className="text-[10px] text-muted-foreground">Update matched records</div>
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  className="w-full justify-center"
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  Download CSV Template
                </Button>
                <div className="text-[11px] text-muted-foreground mt-1.5 text-center">
                  Includes required column headers & example values
                </div>
              </div>
            </div>

            {/* Step 2: Upload File */}
            <div className="border rounded-xl p-5 bg-card space-y-4 md:col-span-2 flex flex-col justify-between">
              <div>
                <div className="font-semibold flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">2</span>
                  Upload Data File
                </div>

                <div className="border-2 border-dashed rounded-xl p-8 text-center hover:border-primary/50 transition-colors bg-muted/20">
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <div className="text-sm font-semibold">Drop CSV or Excel file here, or browse</div>
                  <div className="text-xs text-muted-foreground mt-1">UTF-8 formatted .csv files supported</div>
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileChange}
                    className="mt-4 text-xs mx-auto block file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                  />
                </div>

                {uploadedFileName && (
                  <div className="mt-3 flex items-center justify-between text-xs bg-muted/40 p-2.5 rounded-lg border">
                    <span className="font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      {uploadedFileName} ({parsedRows.length} rows loaded)
                    </span>
                    <button
                      onClick={() => {
                        setUploadedFileName('');
                        setParsedRows([]);
                        setValidationResult(null);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button
                  onClick={handleValidate}
                  disabled={!parsedRows.length || validateMutation.isPending}
                >
                  {validateMutation.isPending ? 'Validating...' : 'Validate & Preview'}
                </Button>
              </div>
            </div>
          </div>

          {/* Validation Preview & Error Table */}
          {validationResult && (
            <div className="border rounded-xl p-6 bg-card space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold">Import Preview & Validation Breakdown</h3>
                  <div className="text-xs text-muted-foreground">
                    Batch #{validationResult.job_id.substring(0, 8)} • Mode: {validationResult.mode.toUpperCase()}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                    <CheckCircle2 className="h-4 w-4" />
                    {validationResult.valid_rows_count} Valid
                  </div>
                  {validationResult.error_rows_count > 0 && (
                    <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-rose-50 text-rose-700 font-semibold border border-rose-200">
                      <AlertTriangle className="h-4 w-4" />
                      {validationResult.error_rows_count} Errors
                    </div>
                  )}
                  {canImport && (
                    <Button
                      onClick={handleCommit}
                      disabled={commitMutation.isPending || validationResult.valid_rows_count === 0}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <FileCheck className="h-4 w-4 mr-1.5" />
                      {commitMutation.isPending ? 'Committing...' : `Commit ${validationResult.valid_rows_count} Records`}
                    </Button>
                  )}
                </div>
              </div>

              {/* Error messages callout */}
              {validationResult.validation_errors.length > 0 && (
                <div className="p-4 bg-rose-50/50 border border-rose-200 rounded-lg text-xs space-y-1.5">
                  <div className="font-bold text-rose-800 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    Errors Detected in File ({validationResult.validation_errors.length}):
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-rose-700 max-h-36 overflow-y-auto">
                    {validationResult.validation_errors.slice(0, 10).map((err, idx) => (
                      <li key={idx}>
                        Row {err.row_index}: <strong>{err.field}</strong> — {err.error} (Received: "{err.raw_value ?? 'empty'}")
                      </li>
                    ))}
                    {validationResult.validation_errors.length > 10 && (
                      <li className="font-semibold italic">...and {validationResult.validation_errors.length - 10} more errors</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Sample Data Grid */}
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="p-3 font-semibold">#</th>
                      {Object.keys(validationResult.preview_rows[0] || {}).map((col) => (
                        <th key={col} className="p-3 font-semibold uppercase">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {validationResult.preview_rows.map((row, rIdx) => {
                      const hasRowError = validationResult.validation_errors.some((e) => e.row_index === rIdx + 1);
                      return (
                        <tr key={rIdx} className={hasRowError ? 'bg-rose-50/30' : 'hover:bg-muted/20'}>
                          <td className="p-3 font-mono text-muted-foreground">{rIdx + 1}</td>
                          {Object.keys(row).map((col) => (
                            <td key={col} className="p-3">
                              {String(row[col])}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Bulk Export Studio */}
      {activeTab === 'export' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="border rounded-xl p-5 bg-card space-y-4">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              Export Configuration
            </h3>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Entity Dataset</label>
              <select
                value={selectedExportEntity}
                onChange={(e) => {
                  setSelectedExportEntity(e.target.value as EntityType);
                  setSelectedFields([]);
                }}
                className="w-full mt-1.5 p-2.5 border rounded-lg bg-background text-sm font-medium"
              >
                <option value="employees">Employees (Active & Historical)</option>
                <option value="attendance">Attendance Records & Punctuality</option>
                <option value="leave_balances">Leave Balances & Allocations</option>
                <option value="payroll_adjustments">Payroll Adjustments & Deductions</option>
                <option value="assets">Asset Inventory & Custody</option>
                <option value="training_records">Training Courses & Certification Logs</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">File Format</label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {(['csv', 'xlsx', 'pdf'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setExportFormat(fmt)}
                    className={`p-2 border rounded-lg text-xs font-semibold uppercase text-center transition-colors ${
                      exportFormat === fmt
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t space-y-2">
              <Button
                onClick={handleExport}
                disabled={exportMutation.isPending}
                className="w-full justify-center"
              >
                <Download className="h-4 w-4 mr-1.5" />
                {exportMutation.isPending ? 'Generating Export...' : `Download ${exportFormat.toUpperCase()} Export`}
              </Button>

              <Button
                variant="outline"
                onClick={() => setShowScheduleModal(true)}
                className="w-full justify-center"
              >
                <Clock className="h-4 w-4 mr-1.5" />
                Save as Scheduled Export Recipe
              </Button>
            </div>
          </div>

          {/* Column Selector */}
          <div className="border rounded-xl p-5 bg-card space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base">Select Columns to Export</h3>
                <div className="text-xs text-muted-foreground">Pick specific fields or leave all unchecked for full dataset export</div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFields(schema?.headers || [])}
                  className="text-xs"
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFields([])}
                  className="text-xs"
                >
                  Clear All
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              {(schema?.headers || ['id', 'name', 'status', 'created_at']).map((field) => {
                const isSelected = selectedFields.includes(field);
                return (
                  <label
                    key={field}
                    className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer text-xs transition-colors ${
                      isSelected ? 'border-primary bg-primary/5 font-medium' : 'border-border text-muted-foreground'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        if (isSelected) {
                          setSelectedFields(selectedFields.filter((f) => f !== field));
                        } else {
                          setSelectedFields([...selectedFields, field]);
                        }
                      }}
                      className="rounded border-border"
                    />
                    <span>{field}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Audit Log & 24h Rollback */}
      {activeTab === 'audit' && (
        <div className="border rounded-xl bg-card overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base">Data Pipeline Governance Audit Log</h3>
              <div className="text-xs text-muted-foreground">Immutable audit record of all imports & exports with 24-hour reversal window</div>
            </div>
            <div className="text-xs text-muted-foreground">Showing last {jobs.length} jobs</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="p-3 font-semibold">Timestamp</th>
                  <th className="p-3 font-semibold">Type</th>
                  <th className="p-3 font-semibold">Entity</th>
                  <th className="p-3 font-semibold">Format</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold">Processed / Errors</th>
                  <th className="p-3 font-semibold">File</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      No import or export jobs on record yet.
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-muted/20">
                      <td className="p-3 font-mono text-muted-foreground">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          job.job_type === 'import' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {job.job_type}
                        </span>
                      </td>
                      <td className="p-3 font-medium capitalize">{job.entity_type.replace('_', ' ')}</td>
                      <td className="p-3 uppercase font-mono">{job.format}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          job.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : job.status === 'rolled_back'
                            ? 'bg-purple-100 text-purple-700'
                            : job.status === 'failed'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {job.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3">
                        {job.processed_rows} / {job.total_rows}
                        {job.error_rows > 0 && <span className="text-rose-600 font-semibold ml-1">({job.error_rows} errors)</span>}
                      </td>
                      <td className="p-3 text-muted-foreground truncate max-w-xs">{job.file_name || 'N/A'}</td>
                      <td className="p-3 text-right">
                        {job.job_type === 'import' && job.status === 'completed' && job.is_rollback_active && canRollback && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRollback(job.id)}
                            className="h-7 text-xs"
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Rollback
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Saved Recipes & Schedules */}
      {activeTab === 'schedules' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base">Recurring Export Schedules</h3>
              <div className="text-xs text-muted-foreground">Automated scheduled report deliveries via cron and direct email</div>
            </div>
            {canManageSchedules && (
              <Button size="sm" onClick={() => setShowScheduleModal(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                New Export Recipe
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.length === 0 ? (
              <div className="col-span-full border rounded-xl p-8 text-center text-muted-foreground">
                No scheduled recipes configured. Use the Export Studio to save your first reusable recipe.
              </div>
            ) : (
              templates.map((tpl) => (
                <div key={tpl.id} className="border rounded-xl p-5 bg-card space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-sm">{tpl.name}</h4>
                      <div className="text-xs text-muted-foreground capitalize">{tpl.entity_type.replace('_', ' ')}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      tpl.is_active ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                    }`}>
                      {tpl.is_active ? 'ACTIVE' : 'PAUSED'}
                    </span>
                  </div>

                  <div className="text-xs space-y-1 text-muted-foreground">
                    <div><strong>Cron Schedule:</strong> <code>{tpl.schedule_cron || 'On Demand'}</code></div>
                    <div><strong>Delivery Email:</strong> {tpl.delivery_email || 'Manual Download'}</div>
                    <div><strong>Columns:</strong> {tpl.selected_fields?.length || 'All'} fields</div>
                  </div>

                  <div className="pt-2 border-t flex items-center justify-between text-xs">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateTemplateMutation.mutateAsync({ id: tpl.id, is_active: !tpl.is_active })}
                      className="text-xs"
                    >
                      {tpl.is_active ? 'Pause Schedule' : 'Activate Schedule'}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal: Save Export Schedule */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl p-6 max-w-md w-full border shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Save Export Recipe & Schedule</h3>
              <button onClick={() => setShowScheduleModal(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Recipe Name</label>
              <input
                type="text"
                placeholder="e.g. Weekly Active Employees Report"
                value={recipeName}
                onChange={(e) => setRecipeName(e.target.value)}
                className="w-full mt-1.5 p-2.5 border rounded-lg text-sm bg-background"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Cron Schedule (5-field)</label>
              <input
                type="text"
                value={recipeCron}
                onChange={(e) => setRecipeCron(e.target.value)}
                className="w-full mt-1.5 p-2.5 border rounded-lg text-sm font-mono bg-background"
              />
              <div className="text-[11px] text-muted-foreground mt-1">Default: `0 9 * * 1` (Every Monday at 9:00 AM)</div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Delivery Email (Optional)</label>
              <input
                type="email"
                placeholder="payroll-team@company.com"
                value={recipeEmail}
                onChange={(e) => setRecipeEmail(e.target.value)}
                className="w-full mt-1.5 p-2.5 border rounded-lg text-sm bg-background"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <Button variant="outline" onClick={() => setShowScheduleModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveRecipe}>
                Save Recipe
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
