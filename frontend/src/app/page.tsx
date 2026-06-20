/* eslint-disable */
// @ts-nocheck
"use client";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, FileText, Settings, LogOut, Download, AlertTriangle, Plus, Upload } from "lucide-react";

// Dynamically import MapComponent to prevent SSR issues with Leaflet
const MapComponent = dynamic(() => import("@/components/MapComponent"), { ssr: false });
import HeatmapComponent from "@/components/HeatmapComponent";
import ChatAssistant from "@/components/ChatAssistant";

const API_BASE = "https://pipeline-backend-production-4cf4.up.railway.app";

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [pipelines, setPipelines] = useState<any[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);

  // Modals
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isAddPipelineOpen, setIsAddPipelineOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [manageReports, setManageReports] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    const t = localStorage.getItem("phi_token");
    if (t) setToken(t);
  }, []);

  useEffect(() => {
    if (token) {
      fetchPipelines();
    }
  }, [token]);

  useEffect(() => {
    if (token && pipelines.length > 0) {
      if (!selectedPipelineId) {
        setSelectedPipelineId(pipelines[0].id);
      } else {
        fetchDashboard();
      }
    }
  }, [token, pipelines, selectedPipelineId]);

  const fetchPipelines = async () => {
    const res = await fetch(`${API_BASE}/pipelines/`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      setPipelines(await res.json());
    } else if (res.status === 401) {
      localStorage.removeItem("phi_token");
      setToken(null);
    }
  };

  const fetchDashboard = async () => {
    const res = await fetch(`${API_BASE}/dashboard-stats?pipeline_id=${selectedPipelineId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      setData(await res.json());
    } else if (res.status === 401) {
      localStorage.removeItem("phi_token");
      setToken(null);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const res = await fetch(`${API_BASE}/token`, { method: "POST", body: fd });
    if (res.ok) {
      const json = await res.json();
      localStorage.setItem("phi_token", json.access_token);
      setToken(json.access_token);
    } else {
      alert("Login failed");
    }
  };

  const fetchManageReports = async () => {
    const res = await fetch(`${API_BASE}/reports`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setManageReports(await res.json());
  };

  const fetchAuditLogs = async () => {
    const res = await fetch(`${API_BASE}/audit-logs/`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setAuditLogs(await res.json());
  };

  const handleApproveReport = async (id: number, status: string) => {
    const fd = new FormData();
    fd.append("status", status);
    const res = await fetch(`${API_BASE}/reports/${id}/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd
    });
    if (res.ok) fetchManageReports();
  };

  const handleAddPipeline = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const body = {
      name: fd.get("name"),
      location: fd.get("location"),
      age_years: parseFloat(fd.get("age_years") as string),
      parent_id: fd.get("parent_id") ? parseInt(fd.get("parent_id") as string) : null
    };
    const res = await fetch(`${API_BASE}/pipelines/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      setIsAddPipelineOpen(false);
      fetchPipelines();
    } else {
      alert("Failed to create pipeline");
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const paramName = fd.get("paramName") as string;
    const paramValue = fd.get("paramValue") as string;
    if (paramName && paramValue) {
      fd.append("manual_parameters", JSON.stringify({ [paramName]: paramValue }));
    } else {
      fd.append("manual_parameters", "{}");
    }
    const res = await fetch(`${API_BASE}/upload-report`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd
    });
    if (res.ok) {
      setIsUploadOpen(false);
      fetchDashboard();
      alert("Report uploaded successfully!");
    } else {
      const err = await res.json();
      alert(`Upload failed: ${err.detail}`);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <Card className="w-full max-w-md bg-slate-900 border-slate-800 text-white">
          <CardHeader>
            <CardTitle className="text-2xl">Welcome Back</CardTitle>
            <CardDescription className="text-slate-400">Sign in to access the dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-300">Email</label>
                <Input name="username" type="email" placeholder="name@example.com" required className="bg-slate-800 border-slate-700" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-300">Password</label>
                <Input type="password" name="password" placeholder="••••••••" required className="bg-slate-800 border-slate-700" />
              </div>
              <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-white">Sign In</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <header className="border-b px-6 py-4 flex justify-between items-center bg-card shadow-sm print-hide">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-amber-500" />
          <h1 className="text-xl font-bold">Pipeline Integrity Monitor</h1>
        </div>
        <div className="flex items-center gap-4">
          <select 
            value={selectedPipelineId || ""} 
            onChange={(e) => setSelectedPipelineId(Number(e.target.value))}
            className="bg-slate-100 dark:bg-slate-800 border border-border rounded-md h-9 px-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none w-48"
          >
            {pipelines.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {data?.user?.role === "admin" && (
            <Button variant="outline" size="sm" onClick={() => setIsAddPipelineOpen(true)} title="Add Pipeline or Sub-Section">
              <Plus className="w-4 h-4" />
            </Button>
          )}
          {data.user.role === "admin" && (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsUploadOpen(true)}>
                <Upload className="w-4 h-4 mr-2" /> Upload Report
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setIsManageOpen(true); fetchManageReports(); }}>
                <Settings className="w-4 h-4 mr-2" /> Manage Reports
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setIsAuditOpen(true); fetchAuditLogs(); }}>
                <FileText className="w-4 h-4 mr-2" /> Audit Logs
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={async () => {
            try {
              const element = document.getElementById('dashboard-content');
              const html2pdfModule = await import('html2pdf.js');
              const html2pdf = html2pdfModule.default || html2pdfModule;
              const opt = {
                margin: 10,
                filename: 'PHI_Executive_Report.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
              };
              html2pdf().set(opt).from(element).save();
            } catch (err: any) {
              console.error(err);
              alert("Failed to export PDF: " + err.message);
            }
          }}>
            <Download className="w-4 h-4 mr-2" /> Export PDF
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem("phi_token"); setToken(null); }} className="text-red-500 hover:text-red-600">
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>
      </header>
      
      <main id="dashboard-content" className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Missing Data Warning */}
        {data.missing_data && data.missing_data.percentage > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-500">Data Blindspots Detected</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                {data.missing_data.percentage}% of required parameters are missing for this pipeline. The PHI score may not reflect true health.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 shadow-sm">
            <CardContent className="pt-6 flex flex-col items-center">
              <div className="text-5xl font-bold text-amber-500 tabular-nums mb-2">
                {data.overall_score}
              </div>
              <p className="text-sm text-muted-foreground mb-4">Overall Health Index</p>
              
              {/* Phase 4 RUL Widget */}
              {data.rul_years !== undefined && (
                <div className="bg-slate-100 dark:bg-slate-800 rounded-lg px-4 py-2 w-full flex justify-between items-center mb-4">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Estimated RUL</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{data.rul_years} Years</span>
                </div>
              )}

              <Badge className={`px-3 py-1 ${data.status === "GOOD" ? "bg-emerald-500" : "bg-amber-500"}`}>
                {data.status} STATUS
              </Badge>
              <p className="text-xs mt-4 text-center text-slate-500">{data.message}</p>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader><CardTitle className="text-base">Parameters Summary</CardTitle></CardHeader>
            <CardContent>
               <div className="grid grid-cols-2 gap-4">
                 {data.calc1_parameters?.map((p: any) => (
                    <div key={p.name} className="bg-muted/40 p-3 rounded-lg">
                      <div className="flex justify-between mb-2">
                        <span className="text-xs font-semibold">{p.name}</span>
                        <span className="text-xs font-bold">{p.score}/{p.max_score}</span>
                      </div>
                      <Progress value={(p.score / p.max_score) * 100} className="h-1.5" />
                    </div>
                 ))}
               </div>
            </CardContent>
           </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Phase 3 GIS Map */}
          <Card className="lg:col-span-1 shadow-sm flex flex-col">
            <CardHeader><CardTitle className="text-base">Geographic Overview</CardTitle></CardHeader>
            <CardContent className="p-0 flex-1">
               <MapComponent pipelines={pipelines} selectedPipelineId={selectedPipelineId} onSelectPipeline={setSelectedPipelineId} />
            </CardContent>
          </Card>

          {/* Phase 3 Heatmap */}
          <Card className="lg:col-span-2 shadow-sm flex flex-col">
            <CardHeader><CardTitle className="text-base">System Health Heatmap</CardTitle></CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <HeatmapComponent token={token} />
            </CardContent>
          </Card>
        </div>
      </main>

      {isManageOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-4xl bg-card shadow-2xl flex flex-col max-h-[80vh]">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <CardTitle>Manage Reports</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setIsManageOpen(false)}>Close</Button>
            </CardHeader>
            <CardContent className="overflow-y-auto pt-4">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground text-xs uppercase">
                  <tr><th className="px-4 py-2">Filename</th><th className="px-4 py-2">Date</th><th className="px-4 py-2">Status</th><th className="px-4 py-2 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {manageReports.map(r => (
                    <tr key={r.id}>
                      <td className="px-4 py-3">{r.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.date}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={r.approval_status === "APPROVED" ? "text-emerald-500 border-emerald-500/20" : ""}>
                          {r.approval_status || "APPROVED"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.approval_status === "PENDING" && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => handleApproveReport(r.id, "APPROVED")} className="text-emerald-500 mr-2">Approve</Button>
                            <Button size="sm" variant="ghost" onClick={() => handleApproveReport(r.id, "REJECTED")} className="text-red-500">Reject</Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {isAuditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-4xl bg-card shadow-2xl flex flex-col max-h-[80vh]">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <CardTitle>System Audit Logs</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setIsAuditOpen(false)}>Close</Button>
            </CardHeader>
            <CardContent className="overflow-y-auto pt-4">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground text-xs uppercase">
                  <tr><th className="px-4 py-2">Timestamp</th><th className="px-4 py-2">User</th><th className="px-4 py-2">Action</th><th className="px-4 py-2">Details</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {auditLogs.map(log => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 text-xs opacity-70">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="px-4 py-3 font-medium">{log.user_email}</td>
                      <td className="px-4 py-3"><Badge variant="secondary">{log.action}</Badge></td>
                      <td className="px-4 py-3 text-muted-foreground">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {isAddPipelineOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md bg-card shadow-2xl flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <CardTitle>Add Pipeline or Sub-Section</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setIsAddPipelineOpen(false)}>Close</Button>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleAddPipeline} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input name="name" placeholder="e.g. Pump Station 1" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Location</label>
                  <Input name="location" placeholder="e.g. Gujarat" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Age (Years)</label>
                  <Input name="age_years" type="number" step="0.1" placeholder="e.g. 5" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Parent Pipeline (Optional)</label>
                  <select name="parent_id" className="w-full bg-slate-100 dark:bg-slate-800 border border-border rounded-md h-10 px-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none">
                    <option value="">None (Main Pipeline)</option>
                    {pipelines.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Select a parent to make this a sub-section.</p>
                </div>
                <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-white">Create Pipeline</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md bg-card shadow-2xl flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <CardTitle>Upload Inspection Report</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setIsUploadOpen(false)}>Close</Button>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Report File (PDF or Excel)</label>
                  <Input type="file" name="file" accept=".pdf,.xlsx" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <select name="report_category" className="w-full bg-slate-100 dark:bg-slate-800 border border-border rounded-md h-10 px-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none" required>
                    <option value="ILI">ILI Survey</option>
                    <option value="DCVG">DCVG Survey</option>
                    <option value="CP">Cathodic Protection</option>
                    <option value="Corrosion Rate">Corrosion Rate</option>
                    <option value="AC Interference">AC/DC Interference</option>
                    <option value="Audit Management">Audit Management</option>
                    <option value="ROU Management">ROU Management</option>
                  </select>
                </div>
                <div className="space-y-2 border-t pt-2">
                  <label className="text-sm font-medium text-slate-500">Auto-Detection Interception (Optional)</label>
                  <select name="pipeline_id" className="w-full bg-slate-100 dark:bg-slate-800 border border-border rounded-md h-10 px-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none">
                    <option value="">Auto-Detect Pipeline</option>
                    {pipelines.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 border-t pt-2">
                  <label className="text-sm font-medium text-slate-500">Manual Data Overrides (Optional)</label>
                  <div className="flex gap-2">
                    <Input name="paramName" placeholder="Parameter Name" className="flex-1" />
                    <Input name="paramValue" type="number" step="0.1" placeholder="Value" className="w-24" />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-white mt-4">
                  <Upload className="w-4 h-4 mr-2" /> Upload & Extract
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Phase 4 NL Query Chat Assistant */}
      <ChatAssistant token={token} />
    </div>
  );
}
