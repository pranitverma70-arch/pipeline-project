from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    role: Optional[str] = "viewer"

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True

# Authentication Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# Pipeline Schemas
class InspectionValueBase(BaseModel):
    parameter_name: str
    value_extracted: Optional[float] = None
    value_manual: Optional[float] = None
    status: str
    confidence: float = 1.0

class InspectionValueCreate(InspectionValueBase):
    report_id: int

class InspectionValue(InspectionValueBase):
    id: int
    report_id: int

    class Config:
        from_attributes = True

class PipelineBase(BaseModel):
    name: str
    location: str
    age_years: float
    parent_id: Optional[int] = None
    phi_alert_threshold: float = 70.0
    corrosion_alert_limit: float = 0.5
    psp_alert_threshold: float = -0.85

class PipelineCreate(PipelineBase):
    pass

class Pipeline(PipelineBase):
    id: int

    class Config:
        from_attributes = True

# Inspection Report Schemas
class InspectionReportBase(BaseModel):
    filename: str
    report_type: str
    approval_status: str = "PENDING"
    file_hash: Optional[str] = None

class InspectionReportCreate(InspectionReportBase):
    pipeline_id: int

class InspectionReport(InspectionReportBase):
    id: int
    pipeline_id: int
    upload_date: datetime
    is_active: bool
    status: str

    class Config:
        from_attributes = True

class AlertBase(BaseModel):
    level: str
    message: str
    is_read: bool = False

class AlertCreate(AlertBase):
    pass

class Alert(AlertBase):
    id: int
    pipeline_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class AuditLog(BaseModel):
    id: int
    user_email: str
    action: str
    entity_type: str
    entity_id: Optional[int]
    details: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True
