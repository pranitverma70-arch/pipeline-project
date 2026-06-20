# Pipeline Health Index (PHI) — Implemented History

This document serves as a comprehensive log of all the features and functionalities that have been designed, built, and implemented into the Pipeline Health Index monitoring system. 

---

## 1. Authentication & Security
- **User Authentication (JWT):** Secure login and signup system using JSON Web Tokens (JWT) and bcrypt password hashing.
- **Role-Based Access Control (RBAC):** Users are assigned roles (e.g., `admin`, `viewer`). Only admins are permitted to upload reports, manage pipelines, and access administrative features.

## 2. Pipeline Management System
- **Pipeline Registry:** A core database registry to track pipeline names, geographical locations, and age in years.
- **"Add Pipeline" Interface:** An administrative modal allowing authorized users to seamlessly add new main pipelines into the system.
- **Hierarchical Sub-Sections:** A robust parent-child database architecture allowing pipelines to have nested sub-sections (e.g., "Main Pipeline -> Pump Station 1").
- **"Add Sub-Section" Interface:** A dedicated tool for creating sub-sections directly linked to a selected parent pipeline.
- **Hierarchical Dropdown UI:** An intuitive, indented dropdown selector (`<optgroup>`) to easily navigate between Main Pipelines and their respective Sub-Sections.

## 3. Data Ingestion & Extraction Engine
- **Multi-Format Upload:** Secure endpoints to upload both `PDF` and `Excel (.xlsx)` inspection reports.
- **Intelligent Text Extraction Engine:** An automated backend scraper that reads uploaded documents and hunts for specific pipeline health parameters (e.g., "ILI", "DCVG", "Corrosion Rate").
- **Auto-Pipeline Detection:** The extraction engine scans the raw text of a report to automatically determine which pipeline it belongs to (e.g., hunting for "MDPL" or "Mundra-Delhi"). 
- **Auto-Detection Interception:** Strict backend rules that reject an upload if the user selects "Auto-Detect" but the engine fails to confidently find a pipeline name, forcing the user to manually select the target pipeline.
- **Automatic Report Categorization:** The system reads the extracted data to automatically categorize the report type (e.g., categorizing an "ILI Survey" vs a "Cathodic Protection Audit").
- **Manual Data Overrides:** An interface built into the Upload Modal allowing admins to manually type in specific values or scores that override the automated extraction engine.

## 4. Dashboard & Analytics Engine
- **Dynamic PHI Calculation:** A customized mathematical algorithm that aggregates the scores from various parameters (applying specific maximum weightages like ILI=30, AC Interference=20) to compute a final Pipeline Health Index (PHI) out of 100.
- **Dynamic Data Aggregation (Roll-Ups):** 
  - Selecting a **Sub-Section** displays only the isolated data for that specific section.
  - Selecting a **Main Pipeline** dynamically queries the database and aggregates all reports from the Main Pipeline *and* all of its child sub-sections to compute a comprehensive overarching health score.
- **Zero-State Resilience:** A strictly enforced fallback system ensuring that if a pipeline has 0 uploaded reports, the dashboard gracefully returns to a baseline `0.0` state without crashing or displaying placeholder mock data.
- **De-duplication Logic:** If multiple reports provide the same parameter, the dashboard engine strictly uses only the most recently uploaded value for the calculation.

## 5. Report Management & Auditing
- **Manage Reports Portal:** A dedicated administrative view listing all historical uploads.
- **Report Toggle:** The ability to dynamically toggle a report's "Active" status on or off, instantly recalculating the pipeline's PHI score without permanently deleting the document.
- **Report Deletion:** Secure deletion endpoints to permanently remove bad or erroneous reports from the system and clean up associated values.

## 6. User Interface & Aesthetics
- **Modern Next.js Architecture:** Built on React and Next.js with a sleek, dark-themed styling system using Tailwind CSS.
- **Dynamic Circular Progress Indicators:** Custom-built SVG circle charts that animate and visually represent the PHI score.
- **Color-Coded Status Thresholds:** Automatic styling configurations that shift the entire dashboard's color palette (Emerald, Amber, Red) based on whether the pipeline status is "GOOD", "FAIR", or "CRITICAL".
- **Responsive Navigation:** Sticky top-bar navigation housing user credentials, roles, and administrative action buttons.

## 7. Decision Support & Analytics (Phase 1)
- **Risk Prediction Engine:** A forecasting algorithm that extrapolates current degradation rates to predict the pipeline's overall PHI score 30, 90, and 180 days into the future.
- **Inspection Due Tracker:** An automated compliance tracker that calculates exactly how many days remain until the next mandatory ILI, DCVG, or CP Survey based on historical upload dates, explicitly flagging overdue inspections.
- **Parameter Trend Analysis:** Interactive line charts (powered by Recharts) accessible directly from the dashboard that map historical degradation of specific parameters (like Corrosion Rate) over time.
- **Alert Management System:** 
  - **Configurable Thresholds:** Admins can set custom limits for PHI, Corrosion Rates, and PSP drops when configuring a pipeline.
  - **Automated Triggers:** The system automatically flags "CRITICAL" or "WARNING" alerts if an uploaded report exceeds these safety thresholds.
  - **Alert Center:** A dedicated, interactive notification bell in the top navigation bar to manage and acknowledge alerts.

## 8. Enterprise Integrity Features (Phase 2)
- **Document Approval Workflow:** "Maker-Checker" workflow requiring uploaded inspection reports to be explicitly Approved by an admin before their data impacts the dashboard score.
- **Confidence Scores:** PDF/Excel extraction engine attaches a 0-1.0 confidence score to data (PDFs=0.90, Excel=0.80) to indicate reliability.
- **Data Integrity / Validation Engine:** Backend validation rejecting mathematically impossible data points (e.g., negative corrosion rates).
- **Duplicate Upload Prevention:** Cryptographic file hashing (SHA-256) integrated into the upload endpoint to immediately identify and block exact duplicate files from cluttering the system.
- **System Audit Trails:** A secure, chronological logging table (`AuditLog`) tracking all critical administrative actions (e.g., CREATE_PIPELINE, DELETE_REPORT, APPROVE_REPORT) with timestamps and actor emails, viewable in a dedicated modal.

## 9. Visual Analytics & Reporting (Phase 3)
- **GIS Pipeline Map Integration:** An interactive mapping component powered by Leaflet tracking pipeline geographic locations. The zoom is strictly limited to state boundaries to abstract exact coordinate paths while retaining situational awareness. Selecting a marker dynamically controls the rest of the dashboard.
- **System Health Heatmap:** A dense visual matrix that plots all pipelines against all extracted parameters. Colors automatically shift (Emerald/Amber/Red) to rapidly identify systemic regional issues (e.g., failing CP across multiple pipelines).
- **Missing Data Analysis:** The backend strictly evaluates the freshness of data, computing a percentage of parameters that are completely missing or older than 365 days. The dashboard alerts the user with a "Data Blindspots Detected" warning if the PHI score is built on incomplete data.
- **PDF Executive Report Generator:** A seamless export button (`html2pdf` integration) allowing admins to instantly screenshot and compile the current dashboard state, map, and parameter breakdown into a shareable Executive Report PDF.

## 10. Advanced AI & Digital Twin (Phase 4 - Final Phase)
- **Remaining Useful Life (RUL) Calculator:** A predictive engine that calculates the estimated time (in years) until a pipeline degrades past critical failure thresholds (PHI < 40). It uses historical degradation logic compared against the pipeline's age to generate dynamic forecasts, displayed prominently in the executive summary widget.
- **Digital Twin Simulation:** A sleek, 2D SVG-based virtual replica of a pipeline segment. It maps live telemetry data (Corrosion, CP Voltage, AC Interference, DCVG) directly onto virtual "sensors." If a parameter fails, its physical location on the Digital Twin pulses red to provide immediate situational awareness beyond just reading numbers.
- **Natural Language (NL) Query Assistant:** A floating chat interface ("PHI Assistant") integrated into the dashboard. Powered by a backend NLP intent engine, users can ask questions in plain English (e.g., "Which pipelines are critical?", "Are any inspections overdue?"). The system parses the intent and returns contextual, human-readable answers.
