/* eslint-disable */
// @ts-nocheck
"use client";

import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle } from "lucide-react";

export default function DigitalTwinComponent({ data }: { data: any }) {
  if (!data || !data.calc1_parameters) return <div className="p-4 text-sm text-slate-500">No data available for Digital Twin.</div>;

  // Extract parameters to bind to virtual sensors
  const params = data.calc1_parameters;
  const getParam = (name: string) => params.find((p: any) => p.name === name);

  const corrosion = getParam("Corrosion Rate");
  const acInt = getParam("AC Interference");
  const cp = getParam("CP");
  const dcvg = getParam("DCVG");

  const getStatusColor = (p: any) => {
    if (!p || p.max_score === 0) return "fill-slate-400 stroke-slate-500";
    const ratio = p.score / p.max_score;
    if (ratio >= 0.8) return "fill-emerald-500 stroke-emerald-600";
    if (ratio >= 0.5) return "fill-amber-500 stroke-amber-600";
    return "fill-red-500 stroke-red-600 animate-pulse";
  };

  const getTextColor = (p: any) => {
    if (!p || p.max_score === 0) return "text-slate-500";
    const ratio = p.score / p.max_score;
    if (ratio >= 0.8) return "text-emerald-500";
    if (ratio >= 0.5) return "text-amber-500";
    return "text-red-500 font-bold";
  };

  return (
    <div className="relative w-full h-[300px] bg-slate-900 rounded-lg overflow-hidden flex flex-col items-center justify-center border border-slate-800">
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
        <Activity className="w-4 h-4 text-emerald-400" />
        <span className="text-xs text-emerald-400 font-semibold tracking-wider">LIVE TELEMETRY</span>
      </div>

      {/* SVG Digital Twin representation of a pipeline */}
      <svg className="w-full h-full max-w-2xl" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid meet">
        {/* Ground/Background layer */}
        <path d="M 0 250 L 800 250 L 800 400 L 0 400 Z" fill="#0f172a" />
        <path d="M 0 250 Q 400 280 800 250" fill="none" stroke="#1e293b" strokeWidth="2" strokeDasharray="10,10" />

        {/* Main Pipeline Cylinder */}
        <defs>
          <linearGradient id="pipeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="50%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.2" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        {/* Pipe Shadow */}
        <rect x="50" y="220" width="700" height="20" fill="#020617" opacity="0.6" rx="10" />
        
        {/* Pipe Body */}
        <rect x="0" y="160" width="800" height="60" fill="url(#pipeGrad)" />
        
        {/* Pipe Flanges/Joints */}
        <rect x="180" y="150" width="20" height="80" fill="#334155" rx="2" stroke="#1e293b" strokeWidth="2" />
        <rect x="580" y="150" width="20" height="80" fill="#334155" rx="2" stroke="#1e293b" strokeWidth="2" />

        {/* Virtual Sensor Nodes & Connections */}
        
        {/* Sensor 1: Corrosion */}
        <g transform="translate(100, 100)">
          <line x1="0" y1="20" x2="0" y2="60" stroke="#64748b" strokeWidth="2" strokeDasharray="4,4" />
          <circle cx="0" cy="10" r="12" className={getStatusColor(corrosion)} strokeWidth="3" />
          <text x="-40" y="-10" fill="#94a3b8" fontSize="12" fontFamily="sans-serif" fontWeight="bold">CORROSION RATE</text>
        </g>

        {/* Sensor 2: CP */}
        <g transform="translate(300, 240)">
          <line x1="0" y1="-20" x2="0" y2="-60" stroke="#64748b" strokeWidth="2" strokeDasharray="4,4" />
          <rect x="-15" y="-10" width="30" height="20" rx="4" className={getStatusColor(cp)} strokeWidth="3" />
          <text x="-35" y="25" fill="#94a3b8" fontSize="12" fontFamily="sans-serif" fontWeight="bold">CP VOLTAGE</text>
        </g>

        {/* Sensor 3: AC Interference */}
        <g transform="translate(500, 100)">
          <line x1="0" y1="20" x2="0" y2="60" stroke="#64748b" strokeWidth="2" strokeDasharray="4,4" />
          <polygon points="0,0 -15,25 15,25" className={getStatusColor(acInt)} strokeWidth="3" />
          <text x="-50" y="-10" fill="#94a3b8" fontSize="12" fontFamily="sans-serif" fontWeight="bold">AC INTERFERENCE</text>
        </g>

        {/* Sensor 4: DCVG */}
        <g transform="translate(700, 240)">
          <line x1="0" y1="-20" x2="0" y2="-60" stroke="#64748b" strokeWidth="2" strokeDasharray="4,4" />
          <circle cx="0" cy="0" r="12" className={getStatusColor(dcvg)} strokeWidth="3" />
          <text x="-20" y="25" fill="#94a3b8" fontSize="12" fontFamily="sans-serif" fontWeight="bold">DCVG</text>
        </g>
        
        {/* Flow Indicator Animation */}
        <rect x="0" y="160" width="800" height="60" fill="url(#glowGrad)" className="animate-pulse" />
      </svg>
      
      {/* HUD Info */}
      <div className="absolute bottom-4 right-4 bg-slate-800/80 backdrop-blur border border-slate-700 p-3 rounded-lg flex gap-4 shadow-lg">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 uppercase">Corrosion</span>
          <span className={`text-sm ${getTextColor(corrosion)}`}>{corrosion?.score || 0} / {corrosion?.max_score || 0}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 uppercase">AC Interf.</span>
          <span className={`text-sm ${getTextColor(acInt)}`}>{acInt?.score || 0} / {acInt?.max_score || 0}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 uppercase">Cathodic Prot.</span>
          <span className={`text-sm ${getTextColor(cp)}`}>{cp?.score || 0} / {cp?.max_score || 0}</span>
        </div>
      </div>
    </div>
  );
}
