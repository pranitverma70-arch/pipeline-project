from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime
from sqlalchemy.orm import relationship
import datetime

from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="viewer")  # admin, engineer, inspector, viewer
    is_active = Column(Boolean, default=True)

class Pipeline(Base):
    __tablename__ = "pipelines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    location = Column(String)
    age_years = Column(Float)
    parent_id = Column(Integer, ForeignKey("pipelines.id"), nullable=True)
    
    # Configurable Thresholds
    phi_alert_threshold = Column(Float, default=70.0)
    corrosion_alert_limit = Column(Float, default=0.5)
    psp_alert_threshold = Column(Float, default=-0.85)
    
    reports = relationship("InspectionReport", back_populates="pipeline")
    sub_pipelines = relationship("Pipeline", backref="parent", remote_side=[id])
    alerts = relationship("Alert", back_populates="pipeline")

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    pipeline_id = Column(Integer, ForeignKey("pipelines.id"))
    level = Column(String) # CRITICAL, WARNING, INFO
    message = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_read = Column(Boolean, default=False)

    pipeline = relationship("Pipeline", back_populates="alerts")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String)
    action = Column(String) # e.g., UPLOAD_REPORT, APPROVE_REPORT
    entity_type = Column(String)
    entity_id = Column(Integer, nullable=True)
    details = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class InspectionReport(Base):
    __tablename__ = "inspection_reports"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    pipeline_id = Column(Integer, ForeignKey("pipelines.id"))
    report_type = Column(String) # DCVG, PSP, etc.
    upload_date = Column(DateTime, default=datetime.datetime.utcnow)
    is_active = Column(Boolean, default=True)
    status = Column(String, default="processed") # processed, error
    approval_status = Column(String, default="PENDING") # PENDING, APPROVED, REJECTED
    file_hash = Column(String, nullable=True)
    
    pipeline = relationship("Pipeline", back_populates="reports")
    values = relationship("InspectionValue", back_populates="report", cascade="all, delete-orphan")

class InspectionValue(Base):
    __tablename__ = "inspection_values"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("inspection_reports.id"))
    parameter_name = Column(String, index=True)
    value_extracted = Column(Float, nullable=True)
    value_manual = Column(Float, nullable=True)
    confidence = Column(Float, default=1.0)
    status = Column(String, default="approved") # approved, overridden, error
    
    report = relationship("InspectionReport", back_populates="values")

class PhiResult(Base):
    __tablename__ = "phi_results"

    id = Column(Integer, primary_key=True, index=True)
    pipeline_id = Column(Integer, ForeignKey("pipelines.id"))
    calculated_date = Column(DateTime, default=datetime.datetime.utcnow)
    overall_score = Column(Float)
    # Calculation_1 top-level parameters (max scores in comments)
    pipeline_params_score = Column(Float, nullable=True)   # max 10
    ili_score = Column(Float, nullable=True)                # max 30 or 40
    corrosion_rate_score = Column(Float, nullable=True)     # max 10
    ac_interference_score = Column(Float, nullable=True)    # max 20
    dcvg_score = Column(Float, nullable=True)               # max 5 or 10
    cp_score = Column(Float, nullable=True)                 # max 5 or 10
    audit_score = Column(Float, nullable=True)              # max 5 or 10
    rou_score = Column(Float, nullable=True)                # max 5 or 10
