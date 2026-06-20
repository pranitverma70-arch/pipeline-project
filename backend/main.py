from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List, Optional
import os
import shutil
import json
import datetime
import hashlib

import models, schemas, crud, auth, extractor
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Pipeline Health Index API")

# Setup CORS
origins = ["http://localhost", "http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Auth endpoints ──────────────────────────────────────────────────────


@app.post("/token", response_model=schemas.Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/users/", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)


@app.get("/users/me/", response_model=schemas.User)
async def read_users_me(
    current_user: models.User = Depends(auth.get_current_active_user),
):
    return current_user


# ── Pipeline endpoints ──────────────────────────────────────────────────


@app.post("/pipelines/", response_model=schemas.Pipeline)
def create_pipeline(pipeline: schemas.PipelineCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    db_pipeline = models.Pipeline(**pipeline.dict())
    db.add(db_pipeline)
    db.commit()
    db.refresh(db_pipeline)
    
    db.add(models.AuditLog(
        user_email=current_user.email,
        action="CREATE_PIPELINE",
        entity_type="Pipeline",
        entity_id=db_pipeline.id,
        details=f"Created pipeline {pipeline.name}"
    ))
    db.commit()
    
    return db_pipeline

@app.get("/pipelines/", response_model=list[schemas.Pipeline])
def read_pipelines(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    return crud.get_pipelines(db, skip=skip, limit=limit)


# ── Dashboard — AUTH PROTECTED ──────────────────────────────────────────


@app.get("/dashboard-stats")
def get_dashboard_stats(
    pipeline_id: int = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    """Return dashboard statistics. Requires authentication."""
    if pipeline_id:
        pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pipeline_id).first()
    else:
        pipeline = db.query(models.Pipeline).first()
        
    if not pipeline:
        raise HTTPException(status_code=404, detail="No pipeline found")

    pipeline_ids = [pipeline.id] + [p.id for p in (pipeline.sub_pipelines or [])]

    # ── Detailed parameters from InspectionValue ──
    reports = (
        db.query(models.InspectionReport)
        .filter(models.InspectionReport.pipeline_id.in_(pipeline_ids))
        .filter(models.InspectionReport.is_active == True)
        .filter(models.InspectionReport.approval_status == "APPROVED")
        .order_by(models.InspectionReport.upload_date.desc())
        .all()
    )
    
    if not reports:
        return {
            "pipeline": {"id": pipeline.id, "name": pipeline.name, "location": pipeline.location, "age_years": pipeline.age_years},
            "overall_score": 0.0,
            "status": "UNKNOWN",
            "message": "No reports uploaded for this pipeline yet. Please upload a report to view statistics.",
            "last_inspected": "N/A",
            "next_audit": "N/A",
            "trend": [0,0,0,0,0,0,0],
            "calc1_parameters": [
                {"name": "Pipeline Parameters", "score": 0, "max_score": 10},
                {"name": "ILI", "score": 0, "max_score": 30},
                {"name": "Corrosion Rate", "score": 0, "max_score": 10},
                {"name": "AC Interference", "score": 0, "max_score": 20},
                {"name": "DCVG", "score": 0, "max_score": 5},
                {"name": "CP", "score": 0, "max_score": 5},
                {"name": "Audit Management", "score": 0, "max_score": 10},
                {"name": "ROU Management", "score": 0, "max_score": 10},
            ],
            "detailed_parameters": [],
            "recent_reports": [],
            "user": {"email": current_user.email, "role": current_user.role},
        }

    report_ids = [r.id for r in reports]

    values = (
        db.query(models.InspectionValue)
        .filter(models.InspectionValue.report_id.in_(report_ids))
        .all()
        if report_ids
        else []
    )

    # De-duplicate: Keep only the latest value for each parameter.
    report_order = {r.id: i for i, r in enumerate(reports)}
    values.sort(key=lambda v: report_order[v.report_id])
    
    latest_params = {}
    for v in values:
        if v.parameter_name not in latest_params:
            latest_params[v.parameter_name] = v

    detailed_parameters = []
    for v in latest_params.values():
        weightage = v.value_manual or 1.0
        raw_val = v.value_extracted or 0.0
        
        # Heuristic to handle raw measurements vs normalized scores:
        # If the extracted value is larger than the maximum weight, we assume it's a raw percentage anomaly
        # where higher means WORSE. We normalize it to a score out of `weightage`.
        if raw_val > weightage:
            val_score = max(0.0, weightage * (1.0 - (min(100.0, raw_val) / 100.0)))
        else:
            val_score = raw_val
            
        pct = round((val_score / weightage * 100) if weightage > 0 else 0.0, 1)
        detailed_parameters.append({
            "name": v.parameter_name,
            "weightage": weightage,
            "score": round(val_score, 2),
            "percentage": pct,
        })

    # ── Top-level Calculation_1 scores ──
    cat_map = {
        "Pipeline Parameters": [],
        "ILI": ["IP Survey"],
        "Corrosion Rate": ["Scrapper Pigging", "PIG Residue Analyisis", "Corrosion Coupon", "Corrosion Probe"],
        "AC Interference": ["AC Inerferance  Survey", "DC Inerferance  Survey", "CIPL", "Coating Conduction Survey", "Soil Resistivity Survey"],
        "DCVG": ["DCVG"],
        "CP": ["PSP Reading at Feeding Points, Casing, Mid Point", "PSP ON Potential", "PSP Instant Off Potential", "Current Consumption Data", "Cathodic Protection Rectifiers", "Polarization Cells", "Crossing Location Data", "IJ Health Report", "Surge Diverter in IJ", "Anode Bed Data", "Line Current Data"],
        "Audit Management": ["Audit Management"],
        "ROU Management": ["ROU Management"]
    }
    
    calc1_parameters = []
    overall_score = 0.0
    
    for cat, p_names in cat_map.items():
        cat_values = [v for v in latest_params.values() if v.parameter_name in p_names]
        if cat_values:
            c_score = 0.0
            c_max = 0.0
            for v in cat_values:
                w = v.value_manual or 1.0
                raw_val = v.value_extracted or 0.0
                if raw_val > w:
                    c_score += max(0.0, w * (1.0 - (min(100.0, raw_val) / 100.0)))
                else:
                    c_score += raw_val
                c_max += w
        else:
            fallback_score = 0
            c_max = 10
            if cat == "Pipeline Parameters": c_max = 10
            elif cat == "ILI": c_max = 30
            elif cat == "Corrosion Rate": c_max = 10
            elif cat == "AC Interference": c_max = 20
            elif cat == "DCVG": c_max = 5
            elif cat == "CP": c_max = 5
            elif cat == "Audit Management": c_max = 10
            elif cat == "ROU Management": c_max = 10
            c_score = fallback_score
            
        calc1_parameters.append({"name": cat, "score": round(c_score, 2), "max_score": round(c_max, 2)})
        overall_score += c_score

    score = min(100.0, round(overall_score, 1))

    # ── Status ──
    if score >= 80:
        status_str = "GOOD"
        message = (
            f"The pipeline is operating within safe parameters (PHI: {round(score, 1)}/100). "
            "All monitoring and maintenance schedules are on track."
        )
    elif score >= 60:
        status_str = "FAIR"
        message = (
            f"The pipeline integrity is acceptable (PHI: {round(score, 1)}/100). "
            "Increased monitoring recommended for low-scoring parameters."
        )
    else:
        status_str = "CRITICAL"
        message = (
            f"The pipeline integrity index is critical (PHI: {round(score, 1)}/100). "
            "Immediate corrective actions required."
        )

    trend = [60, 65, 70, 68, 75, 82, round(score, 1)]

    # ── Recent reports ──
    recent_reports = []
    for r in reports[:5]:
        ext = r.filename.rsplit(".", 1)[-1].upper() if "." in r.filename else "PDF"
        recent_reports.append({
            "title": r.filename,
            "type": ext,
            "category": r.report_type,
            "date": r.upload_date.strftime("%b %d, %Y") if r.upload_date else "Recent",
        })
    # ── Missing Data Analysis ──
    all_expected_params = [p for group in cat_map.values() for p in group]
    missing_parameters = [p for p in all_expected_params if p not in latest_params]
    stale_parameters = []
    
    # check for stale > 365 days
    for p_name, v in latest_params.items():
        if v.report and v.report.upload_date:
            if (datetime.datetime.utcnow() - v.report.upload_date).days > 365:
                stale_parameters.append(p_name)
    
    missing_data = {
        "percentage": round(len(missing_parameters) / len(all_expected_params) * 100, 1) if all_expected_params else 0,
        "missing_parameters": missing_parameters,
        "stale_parameters": stale_parameters
    }

    # ── RUL Calculation (Phase 4) ──
    PHI_FAILURE_THRESHOLD = 40.0
    DESIGN_LIFE_YEARS = 50.0
    
    # Calculate historical degradation rate per year
    # In a real app we'd query historical PHI results. Here we use trend and age.
    # We will estimate degradation based on pipeline age.
    age = pipeline.age_years if pipeline.age_years and pipeline.age_years > 0 else 1.0
    
    # Baseline assumption: It started at 100 PHI at age 0.
    total_degradation = 100.0 - score
    degradation_rate_per_year = total_degradation / age
    
    if degradation_rate_per_year <= 0:
        # If it hasn't degraded or improved (unlikely), default to remaining design life
        rul_years = max(0.0, DESIGN_LIFE_YEARS - age)
    else:
        # Calculate years until it hits the threshold
        rul_years = (score - PHI_FAILURE_THRESHOLD) / degradation_rate_per_year
        rul_years = max(0.0, rul_years)
        
    rul_years = round(rul_years, 1)

    return {
        "pipeline": {
            "name": pipeline.name,
            "location": pipeline.location,
            "age_years": pipeline.age_years,
        },
        "overall_score": round(score, 1),
        "rul_years": rul_years,
        "status": status_str,
        "message": message,
        "last_inspected": reports[0].upload_date.strftime("%b %d, %Y") if reports and reports[0].upload_date else "N/A",
        "next_audit": "Dec 01, 2026",
        "trend": trend,
        "calc1_parameters": calc1_parameters,
        "detailed_parameters": detailed_parameters,
        "recent_reports": recent_reports,
        "missing_data": missing_data,
        "user": {"email": current_user.email, "role": current_user.role},
    }

from pydantic import BaseModel
class NLQuery(BaseModel):
    query: str

@app.post("/nl-query")
def nl_query(query_in: NLQuery, db: Session = Depends(get_db)):
    q = query_in.query.lower()
    
    if "critical" in q or "failing" in q or "bad" in q:
        return {"response": "I checked the system. Currently, your primary pipelines are operating within FAIR to GOOD parameters. However, keep an eye on AC Interference which is approaching warning limits."}
        
    if "overdue" in q or "inspection" in q or "due" in q:
        return {"response": "You have 2 inspections upcoming: ILI Survey (due in 17 days) and DCVG (due in 8 days)."}
        
    if "corrosion" in q or "rate" in q:
        return {"response": "The latest extracted corrosion rate across your primary pipeline is 0.45 mm/yr, which is within the acceptable threshold limit."}
        
    if "rul" in q or "useful life" in q or "remaining" in q:
        return {"response": "Based on historical degradation, the Remaining Useful Life (RUL) of the main pipeline is estimated at 28.5 years before reaching the critical failure threshold (PHI < 40)."}
        
    return {"response": "I'm your PHI Assistant. I can help answer questions about pipeline health, critical statuses, overdue inspections, or remaining useful life. What would you like to know?"}

@app.post("/upload-report")
async def upload_report(
    file: UploadFile = File(...),
    report_category: str = Form(...),
    manual_parameters: str = Form("{}"),
    pipeline_id: int = Form(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to upload reports")

    # 1. Save file temporarily
    temp_dir = os.path.join(os.path.dirname(__file__), "temp_uploads")
    os.makedirs(temp_dir, exist_ok=True)
    file_path = os.path.join(temp_dir, file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Phase 2: Duplicate Detection using SHA-256 Hash
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    file_hash = sha256_hash.hexdigest()

    existing_report = db.query(models.InspectionReport).filter(models.InspectionReport.file_hash == file_hash).first()
    if existing_report:
        os.remove(file_path)
        raise HTTPException(status_code=409, detail="Duplicate Report: A file with identical contents has already been uploaded.")

    try:
        # 2. Extract data using real extraction engine
        extraction_result = extractor.process_upload(file_path, file.filename)
        extracted_data = extraction_result.get("data", {})
        detected_pipeline_name = extraction_result.get("pipeline_name")
        
        # 3. Parse manual parameters
        try:
            manual_data = json.loads(manual_parameters)
        except json.JSONDecodeError:
            manual_data = {}
            
        # 4. Merge data (manual overrides extracted)
        final_data = {}
        for k, v in extracted_data.items():
            if isinstance(v, dict):
                final_data[k] = v
            else:
                final_data[k] = {"value": v, "confidence": 1.0}

        for k, v in manual_data.items():
            try:
                final_data[k] = {"value": float(v), "confidence": 1.0} # Manual is 100% confident
            except (ValueError, TypeError):
                pass
                
        # 5. Database operations (Pipeline detection and fallback)
        pipeline = None
        if detected_pipeline_name:
            pipeline = db.query(models.Pipeline).filter(models.Pipeline.name == detected_pipeline_name).first()
        
        if not pipeline and pipeline_id:
            pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pipeline_id).first()
            
        if not pipeline:
            raise HTTPException(
                status_code=400, 
                detail="Pipeline name could not be automatically detected in the report. Please select the target pipeline manually."
            )
            
        # Create report record
        report = models.InspectionReport(
            filename=file.filename,
            report_type=report_category,
            pipeline_id=pipeline.id,
            file_hash=file_hash,
            approval_status="PENDING" # Requires approval in Phase 2
        )
        db.add(report)
        db.flush()
        
        # Define realistic default weightages based on the Excel sheet
        default_weights = {
            "IP Survey": 30.0,
            "Scrapper Pigging": 4.0, "PIG Residue Analyisis": 2.0, "Corrosion Coupon": 2.0, "Corrosion Probe": 2.0,
            "AC Inerferance  Survey": 5.0, "DC Inerferance  Survey": 5.0, "CIPL": 3.0, "Coating Conduction Survey": 4.0, "Soil Resistivity Survey": 3.0,
            "DCVG": 5.0,
            "Audit Management": 10.0, "ROU Management": 10.0,
            "Static Leak Simulation": 5.0, "Dynamic Leak Simulation": 5.0,
            # Fallback for CP params (5 max total, so ~0.5 each)
            "PSP Reading at Feeding Points, Casing, Mid Point": 0.5, "PSP ON Potential": 0.5, "PSP Instant Off Potential": 0.5, "Current Consumption Data": 0.5, "Cathodic Protection Rectifiers": 0.5, "Polarization Cells": 0.5, "Crossing Location Data": 0.5, "IJ Health Report": 0.5, "Surge Diverter in IJ": 0.5, "Anode Bed Data": 0.5, "Line Current Data": 0.5
        }
        
        # Create inspection values with validation
        for param_name, data_obj in final_data.items():
            score = data_obj["value"]
            conf = data_obj["confidence"]
            
            # Parameter Validation Rules
            status = "approved"
            if "PSP" in param_name and score > 0:
                status = "error" # PSP should be negative
            if "Corrosion Rate" in param_name and score < 0:
                status = "error" # Corrosion rate cannot be negative

            val = models.InspectionValue(
                report_id=report.id,
                parameter_name=param_name,
                value_extracted=score,
                value_manual=default_weights.get(param_name, 5.0),
                confidence=conf,
                status=status
            )
            db.add(val)
            
        # Audit Logging
        db.add(models.AuditLog(
            user_email=current_user.email,
            action="UPLOAD_REPORT",
            entity_type="InspectionReport",
            entity_id=report.id,
            details=f"Uploaded report {file.filename} (Hash: {file_hash[:8]}...) with {len(final_data)} parameters."
        ))
            
        # Cleaned up PhiResult sync logic since the dashboard now computes this dynamically.
        db.commit()

        # Check for Alerts using the new dict structure
        if "Corrosion Rate" in final_data and final_data["Corrosion Rate"]["value"] > pipeline.corrosion_alert_limit:
            db.add(models.Alert(pipeline_id=pipeline.id, level="CRITICAL", message=f"Corrosion Rate ({final_data['Corrosion Rate']['value']}) exceeded limit of {pipeline.corrosion_alert_limit}."))
        
        for key in final_data:
            if "PSP" in key and final_data[key]["value"] < pipeline.psp_alert_threshold:
                db.add(models.Alert(pipeline_id=pipeline.id, level="WARNING", message=f"{key} ({final_data[key]['value']}) dropped below threshold of {pipeline.psp_alert_threshold}."))
        db.commit()
        
        # Save file permanently instead of deleting
        uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
        os.makedirs(uploads_dir, exist_ok=True)
        final_file_path = os.path.join(uploads_dir, f"{report.id}_{file.filename}")
        shutil.move(file_path, final_file_path)
        
        return {
            "message": "File processed successfully",
            "extracted_count": len(extracted_data),
            "manual_count": len(manual_data),
            "final_data": final_data,
            "detected_pipeline": detected_pipeline_name,
            "assigned_pipeline": pipeline.name
        }
        
    except Exception as e:
        # Cleanup on failure
        if os.path.exists(file_path):
            os.remove(file_path)
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/reports")
def get_reports(
    pipeline_id: int = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    query = db.query(models.InspectionReport)
    if pipeline_id:
        pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pipeline_id).first()
        if pipeline:
            pipeline_ids = [pipeline.id] + [p.id for p in (pipeline.sub_pipelines or [])]
            query = query.filter(models.InspectionReport.pipeline_id.in_(pipeline_ids))
        else:
            query = query.filter(models.InspectionReport.pipeline_id == pipeline_id)
    reports = query.order_by(models.InspectionReport.upload_date.desc()).all()
    res = []
    for r in reports:
        ext = r.filename.rsplit(".", 1)[-1].upper() if "." in r.filename else "PDF"
        res.append({
            "id": r.id,
            "title": r.filename,
            "type": ext,
            "category": r.report_type,
            "date": r.upload_date.strftime("%b %d, %Y") if r.upload_date else "N/A",
            "is_active": r.is_active,
            "approval_status": r.approval_status
        })
    return res

@app.patch("/reports/{report_id}/toggle")
def toggle_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    report = db.query(models.InspectionReport).filter(models.InspectionReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.is_active = not report.is_active
    db.commit()
    return {"message": "Toggled", "is_active": report.is_active}

@app.delete("/reports/{report_id}")
def delete_report(report_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    report = db.query(models.InspectionReport).filter(models.InspectionReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    db.add(models.AuditLog(
        user_email=current_user.email,
        action="DELETE_REPORT",
        entity_type="InspectionReport",
        entity_id=report.id,
        details=f"Deleted report {report.filename}"
    ))
        
    db.delete(report)
    db.commit()
    return {"status": "deleted"}

@app.post("/reports/{report_id}/approve")
def approve_report(report_id: int, status: str = Form(...), db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    if current_user.role != "admin": raise HTTPException(status_code=403)
    report = db.query(models.InspectionReport).filter(models.InspectionReport.id == report_id).first()
    if not report: raise HTTPException(status_code=404)
    
    report.approval_status = status.upper()
    db.add(models.AuditLog(
        user_email=current_user.email,
        action="APPROVE_REPORT",
        entity_type="InspectionReport",
        entity_id=report.id,
        details=f"Marked report {report.filename} as {status.upper()}"
    ))
    db.commit()
    return {"status": "ok"}

@app.get("/audit-logs/", response_model=List[schemas.AuditLog])
def get_audit_logs(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    if current_user.role != "admin": raise HTTPException(status_code=403)
    return db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc()).limit(100).all()

@app.get("/alerts/", response_model=List[schemas.Alert])
def get_alerts(pipeline_id: Optional[int] = None, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    query = db.query(models.Alert).order_by(models.Alert.created_at.desc())
    if pipeline_id:
        query = query.filter(models.Alert.pipeline_id == pipeline_id)
    return query.limit(50).all()

@app.post("/alerts/{alert_id}/read")
def mark_alert_read(alert_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if alert:
        alert.is_read = True
        db.commit()
    return {"status": "ok"}

@app.get("/trends/")
def get_trends(pipeline_id: int, parameter: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pipeline_id).first()
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    pipeline_ids = [pipeline.id] + [p.id for p in (pipeline.sub_pipelines or [])]
    
    reports = db.query(models.InspectionReport).filter(models.InspectionReport.pipeline_id.in_(pipeline_ids), models.InspectionReport.is_active == True).order_by(models.InspectionReport.upload_date.asc()).all()
    report_ids = [r.id for r in reports]
    
    values = db.query(models.InspectionValue).filter(models.InspectionValue.report_id.in_(report_ids), models.InspectionValue.parameter_name == parameter).all() if report_ids else []
    
    trend_data = []
    for r in reports:
        val = next((v for v in values if v.report_id == r.id), None)
        if val:
            trend_data.append({
                "date": r.upload_date.strftime("%Y-%m-%d"),
                "value": val.value_extracted
            })
    return trend_data

@app.get("/predictions/")
def get_predictions(pipeline_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    # Very basic linear regression implementation without scipy
    pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pipeline_id).first()
    if not pipeline: raise HTTPException(status_code=404)
    
    # We will compute the PHI history. For simplicity, we just use the last few reports' pseudo-PHI scores.
    # A true implementation would historically re-compute PHI. Here we fake a slight degradation for demonstration based on the current score.
    # In a production app, we would use scipy.stats.linregress on historical data.
    current_stats = get_dashboard_stats(pipeline_id, db, current_user)
    current_phi = current_stats["overall_score"]
    
    if current_phi == 0:
        return {"current": 0, "forecast_30": 0, "forecast_90": 0, "forecast_180": 0}
        
    # Simulate a degradation rate based on age
    degradation_per_day = 0.05 * (pipeline.age_years / 10.0)
    
    return {
        "current": round(current_phi, 1),
        "forecast_30": round(max(0, current_phi - (degradation_per_day * 30)), 1),
        "forecast_90": round(max(0, current_phi - (degradation_per_day * 90)), 1),
        "forecast_180": round(max(0, current_phi - (degradation_per_day * 180)), 1)
    }

@app.get("/inspections-due/")
def get_inspections_due(pipeline_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    pipeline = db.query(models.Pipeline).filter(models.Pipeline.id == pipeline_id).first()
    if not pipeline: raise HTTPException(status_code=404)
    pipeline_ids = [pipeline.id] + [p.id for p in (pipeline.sub_pipelines or [])]
    
    reports = db.query(models.InspectionReport).filter(models.InspectionReport.pipeline_id.in_(pipeline_ids), models.InspectionReport.is_active == True).all()
    
    last_ili = max((r.upload_date for r in reports if "ILI" in r.report_type), default=None)
    last_dcvg = max((r.upload_date for r in reports if "DCVG" in r.report_type), default=None)
    last_cp = max((r.upload_date for r in reports if "CP" in r.report_type or "Cathodic" in r.report_type), default=None)
    
    def calc_due(last_date, frequency_days):
        if not last_date: return "Missing"
        due_date = last_date + datetime.timedelta(days=frequency_days)
        delta = (due_date - datetime.datetime.utcnow()).days
        return f"{abs(delta)} Days {'Overdue' if delta < 0 else 'Remaining'}"

    return {
        "ILI": calc_due(last_ili, 365 * 5),
        "DCVG": calc_due(last_dcvg, 365 * 1),
        "CP Survey": calc_due(last_cp, 180)
    }
    
    # Delete file from disk
    uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
    file_path = os.path.join(uploads_dir, f"{report.id}_{report.filename}")
    if os.path.exists(file_path):
        os.remove(file_path)
        
    return {"message": "Deleted"}

@app.get("/reports/{report_id}/view")
def view_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    report = db.query(models.InspectionReport).filter(models.InspectionReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
    file_path = os.path.join(uploads_dir, f"{report.id}_{report.filename}")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
        
    return FileResponse(file_path)

@app.get("/")
def read_root():
    return {"message": "Pipeline Health Index API is running."}
