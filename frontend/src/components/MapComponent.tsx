/* eslint-disable */
// @ts-nocheck
"use client";

import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet's default icon path issues in Next.js
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface MapComponentProps {
  pipelines: any[];
  selectedPipelineId: number | null;
  onSelectPipeline: (id: number) => void;
}

export default function MapComponent({ pipelines, selectedPipelineId, onSelectPipeline }: MapComponentProps) {
  // Generic state boundary center (e.g., Gujarat, India)
  const defaultCenter: [number, number] = [22.2587, 71.1924];
  const [mountKey, setMountKey] = React.useState<string>("");

  useEffect(() => {
    setMountKey(Math.random().toString());
  }, []);

  // Helper to generate mock generic coordinates based on pipeline ID to keep it deterministic
  const getMockCoordinates = (id: number): [number, number] => {
    // Offset slightly from the center so they don't overlap
    const latOffset = (id % 5) * 0.5 - 1;
    const lngOffset = (id % 7) * 0.5 - 1.5;
    return [defaultCenter[0] + latOffset, defaultCenter[1] + lngOffset];
  };

  if (!mountKey) return null;

  return (
    <div style={{ height: "350px", width: "100%", borderRadius: "0.5rem", overflow: "hidden", zIndex: 0, position: "relative" }}>
      <MapContainer 
        key={mountKey}
        center={defaultCenter} 
        zoom={6} // State level zoom
        minZoom={5} // Restrict zooming out too far
        maxZoom={8} // Restrict zooming in too far (state boundaries max)
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {pipelines.map(p => {
          const coords = getMockCoordinates(p.id);
          const isSelected = p.id === selectedPipelineId;
          
          return (
            <Marker 
              key={p.id} 
              position={coords} 
              icon={icon}
              eventHandlers={{
                click: () => onSelectPipeline(p.id),
              }}
            >
              <Popup>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-slate-500">{p.location}</div>
                {isSelected && <div className="text-xs text-amber-600 font-bold mt-1">Currently Viewing</div>}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
