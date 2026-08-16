import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { Badge } from "@/components/ui/badge";
import { RefreshCw, Search, FileText, AlertCircle, Clock, Download } from "lucide-react";
// Use admin-backend API (reads logs from tenant-backend directory)
const LOGS_API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

interface LogFile {
  name: string;
  size: number;
  modified: string;
}

interface LogContent {
  content: string[];
  totalLines: number;
  hasMore: boolean;
}

export default function Logs() {
  const [logFiles, setLogFiles] = useState<LogFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [logContent, setLogContent] = useState<LogContent | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const getAuthHeaders = () => ({
    "Content-Type": "application/json",
  });

  const fetchLogFiles = async () => {
    try {
      const response = await fetch(`${LOGS_API_URL}/logs/files`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setLogFiles(data);
        if (data.length > 0 && !selectedFile) {
          setSelectedFile(data[0].name);
        }
      }
    } catch (error) {
      console.error("Error fetching log files:", error);
    }
  };

  const fetchLogContent = async (filename: string) => {
    if (!filename) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${LOGS_API_URL}/logs/read/${filename}?lines=500`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setLogContent(data);
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Error fetching log content:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!selectedFile || !searchQuery.trim()) return;
    setIsLoading(true);
    try {
      const response = await fetch(
        `${LOGS_API_URL}/logs/search/${selectedFile}?query=${encodeURIComponent(searchQuery)}&limit=200`,
        { headers: getAuthHeaders(), credentials: 'include' }
      );
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data);
      }
    } catch (error) {
      console.error("Error searching logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadLogs = () => {
    if (!logContent?.content) return;
    const blob = new Blob([logContent.content.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selectedFile || "logs.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getLogLevel = (line: string): string => {
    if (line.includes(" ERROR ")) return "error";
    if (line.includes(" WARN ")) return "warn";
    if (line.includes(" DEBUG ")) return "debug";
    return "info";
  };

  // const getLogBadge = (level: string) => {
  //   switch (level) {
  //     case "error":
  //       return <Badge variant="destructive" className="text-xs">ERROR</Badge>;
  //     case "warn":
  //       return <Badge variant="secondary" className="text-xs bg-yellow-500 text-white">WARN</Badge>;
  //     case "debug":
  //       return <Badge variant="outline" className="text-xs">DEBUG</Badge>;
  //     default:
  //       return <Badge variant="secondary" className="text-xs">INFO</Badge>;
  //   }
  // };

  useEffect(() => {
    fetchLogFiles();
  }, []);

  useEffect(() => {
    if (selectedFile) {
      fetchLogContent(selectedFile);
    }
  }, [selectedFile]);

  useEffect(() => {
    if (autoRefresh && selectedFile) {
      const interval = setInterval(() => {
        fetchLogContent(selectedFile);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, selectedFile]);

  const displayedLogs = searchResults.length > 0 ? searchResults : logContent?.content || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Logs</h1>
          <p className="text-muted-foreground">View and search application logs</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? "animate-spin" : ""}`} />
            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchLogContent(selectedFile)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={downloadLogs} disabled={!logContent?.content}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Log Files Sidebar */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Log Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logFiles.map((file) => (
                <div
                  key={file.name}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${selectedFile === file.name
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                    }`}
                  onClick={() => setSelectedFile(file.name)}
                >
                  <div className="font-medium text-sm truncate">{file.name}</div>
                  <div className="flex items-center justify-between text-xs opacity-70 mt-1">
                    <span>{formatFileSize(file.size)}</span>
                    <span>{new Date(file.modified).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
              {logFiles.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No log files found
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Log Content */}
        <Card className="col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {selectedFile || "Select a log file"}
              </CardTitle>
              {logContent && (
                <span className="text-sm text-muted-foreground">
                  {logContent.totalLines} total lines
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch} disabled={!searchQuery.trim()}>
                Search
              </Button>
              {searchResults.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchResults([]);
                    setSearchQuery("");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="h-[600px] rounded-md border bg-black/95 p-4 overflow-auto">
                <div className="font-mono text-xs space-y-1">
                  {displayedLogs.map((line, index) => {
                    const level = getLogLevel(line);
                    return (
                      <div
                        key={index}
                        className={`flex items-start gap-2 p-1 rounded ${level === "error"
                          ? "bg-red-500/10 text-red-400"
                          : level === "warn"
                            ? "bg-yellow-500/10 text-yellow-400"
                            : "text-green-400"
                          }`}
                      >
                        <span className="shrink-0 opacity-50 select-none">
                          {displayedLogs.length - index}
                        </span>
                        <span className="break-all">{line}</span>
                      </div>
                    );
                  })}
                  {displayedLogs.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      {searchQuery ? "No matching logs found" : "No logs to display"}
                    </div>
                  )}
                </div>
              </div>
            )}
            {searchResults.length > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                Found {searchResults.length} matching lines
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 rounded-full bg-blue-500/10">
              <FileText className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Log Files</p>
              <p className="text-2xl font-bold">{logFiles.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 rounded-full bg-red-500/10">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Error Files</p>
              <p className="text-2xl font-bold">
                {logFiles.filter((f) => f.name.includes("error")).length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-3 rounded-full bg-green-500/10">
              <Clock className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Latest Update</p>
              <p className="text-2xl font-bold">
                {logFiles[0]
                  ? new Date(logFiles[0].modified).toLocaleTimeString()
                  : "N/A"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
