/* eslint-disable */
// @ts-nocheck
"use client";

import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

const API_BASE = "https://pipeline-backend-production-4cf4.up.railway.app";

export default function HeatmapComponent({ token }: { token: string }) {
  const [matrixData, setMatrixData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) fetchHeatmap();
  }, [token]);

  const fetchHeatmap = async () => {
    try {
      // In a real app we'd have a dedicated heatmap endpoint.
      // Here we will fetch all pipelines, then fetch their dashboard stats
      const pRes = await fetch(`${API_BASE}/pipelines/`, { headers: { Authorization: `Bearer ${token}` } });
      if (pRes.status === 401) {
        localStorage.removeItem("phi_token");
        window.location.reload();
        return;
      }
      if (!pRes.ok) return;
      const pipelines = await pRes.json();
      
      const matrix = [];
      for (const p of pipelines) {
        const dRes = await fetch(`${API_BASE}/dashboard-stats?pipeline_id=${p.id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (dRes.ok) {
          const dData = await dRes.json();
          matrix.push({
            pipeline: p,
            stats: dData
          });
        }
      }
      setMatrixData(matrix);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4 text-sm text-slate-500">Loading heatmap data...</div>;
  if (!matrixData.length) return <div className="p-4 text-sm text-slate-500">No data available for heatmap.</div>;

  // Extract all unique parameter names
  const allParams = new Set<string>();
  matrixData.forEach(row => {
    row.stats.calc1_parameters?.forEach((p: any) => allParams.add(p.name));
  });
  const paramCols = Array.from(allParams);

  const getColor = (score: number, max: number) => {
    if (max === 0) return "bg-slate-100 dark:bg-slate-800";
    const ratio = score / max;
    if (ratio >= 0.8) return "bg-emerald-500 text-white"; // 80%+ is Good
    if (ratio >= 0.5) return "bg-amber-500 text-white";  // 50-79% is Fair
    return "bg-red-500 text-white"; // < 50% is Critical
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr>
            <th className="p-2 border-b min-w-[150px]">Pipeline</th>
            <th className="p-2 border-b text-center">Overall</th>
            {paramCols.map(col => (
              <th key={col} className="p-2 border-b text-center min-w-[100px]">
                <div className="truncate text-xs" title={col}>{col}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrixData.map(row => (
            <tr key={row.pipeline.id} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900/50">
              <td className="p-2 font-medium">{row.pipeline.name}</td>
              <td className="p-2 text-center">
                <Badge variant="outline" className={row.stats.overall_score >= 80 ? "text-emerald-500 border-emerald-500" : row.stats.overall_score >= 60 ? "text-amber-500 border-amber-500" : "text-red-500 border-red-500"}>
                  {row.stats.overall_score}
                </Badge>
              </td>
              {paramCols.map(col => {
                const param = row.stats.calc1_parameters?.find((p: any) => p.name === col);
                if (!param) return <td key={col} className="p-2 text-center text-slate-400">-</td>;
                
                return (
                  <td key={col} className="p-1 text-center">
                    <div className={`rounded-sm py-1 px-2 text-xs font-semibold ${getColor(param.score, param.max_score)}`} title={`${param.score}/${param.max_score}`}>
                      {Math.round((param.score / (param.max_score || 1)) * 100)}%
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
