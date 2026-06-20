import os
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
import models
import auth

def seed_database():
    """Seed the database with zero-state pipelines and wipe out mock data."""
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # ── 1. Admin user ───────────────────────────────────────────────
        admin_email = "admin@pipeline.com"
        db_user = db.query(models.User).filter(models.User.email == admin_email).first()
        if not db_user:
            hashed_password = auth.get_password_hash("admin123")
            db_user = models.User(
                email=admin_email,
                hashed_password=hashed_password,
                role="admin",
                is_active=True,
            )
            db.add(db_user)
            print("Admin user seeded.")
        else:
            print("Admin user already exists.")

        # ── 2. Seed Pipelines ───────────────────────────────────────────────
        pipelines_data = [
            {"name": "Mundra-Delhi Pipeline (MDPL)", "location": "Pindwara ROU", "age_years": 15.0},
            {"name": "Gujarat-Punjab Pipeline (GPPL)", "location": "Gujarat ROU", "age_years": 10.0},
            {"name": "Mumbai-Pune Pipeline (MPPL)", "location": "Maharashtra ROU", "age_years": 8.0},
        ]
        
        for p_data in pipelines_data:
            db_pipeline = db.query(models.Pipeline).filter(models.Pipeline.name == p_data["name"]).first()
            if not db_pipeline:
                db_pipeline = models.Pipeline(**p_data)
                db.add(db_pipeline)
                print(f"Pipeline seeded: {p_data['name']}")
            else:
                print(f"Pipeline already exists: {p_data['name']}")

        db.flush()

        # ── 3. Wipe old data for fresh zero-state ─────────────────────────────
        print("Wiping all existing reports and values to ensure strict 0-state...")
        db.query(models.PhiResult).delete()
        db.query(models.InspectionValue).delete()
        db.query(models.InspectionReport).delete()
        
        db.commit()
        print("Database seeded and wiped successfully.")
        
    except Exception as e:
        print(f"Seeding failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
