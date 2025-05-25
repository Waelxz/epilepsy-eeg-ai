from fastapi import APIRouter, Depends, HTTPException, status, Response, Path, Query, Request, Body, Form
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from typing import List, Optional, Literal
from pydantic import BaseModel
from ..utils.security import get_current_user, get_current_user_from_request, get_current_user_from_token
from ..utils.database import db
from bson.objectid import ObjectId
from datetime import datetime
import os
from pymongo import DESCENDING
import shutil
from ..utils.report_generator import generate_pdf_report, generate_patient_pdf_report
import logging
from ..utils.email_service import EmailService
from ..utils.oauth_config import USER_TOKENS_KEY
from ..utils.google_oauth import GoogleOAuth
import asyncio

# Configure module logger
logger = logging.getLogger(__name__)

# Create router instance
router = APIRouter(tags=["Reports"])

# Define model for report creation request
class ReportRequest(BaseModel):
    analysisId: str
    reportType: Literal["patient", "analysis"]

class ReportResponse(BaseModel):
    id: Optional[str] = None
    analysisId: str
    patientId: str
    reportType: str
    generatedDate: Optional[str] = None
    filePath: Optional[str] = None
    createdBy: Optional[str] = None

# Generate report endpoint
@router.post("/reports/generate", response_model=ReportResponse)
async def create_report(
    report_req: ReportRequest,
    current_user = Depends(get_current_user_from_request)
):
    """Generate a new report for an analysis"""
    try:
        analysis_id = report_req.analysisId
        report_type = report_req.reportType
        
        logger.info(f"Generating report: analysis_id={analysis_id}, report_type={report_type}")
        
        # Validate analysis exists
        try:
            analysis_id_obj = ObjectId(analysis_id)
        except Exception as e:
            logger.error(f"Invalid analysis ID format: {analysis_id}, Error: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Invalid analysis ID format: {str(e)}")
        
        analysis = db.analyses.find_one({"_id": analysis_id_obj})
        if not analysis:
            logger.error(f"Analysis not found with ID {analysis_id_obj}")
            raise HTTPException(status_code=404, detail="Analysis not found")
        
        # Check if analysis is completed
        if analysis.get("status") != "completed":
            raise HTTPException(status_code=400, detail="Cannot generate report for incomplete analysis")
        
        # Get patient information
        try:
            patient_id = ObjectId(analysis.get("patientId"))
        except Exception as e:
            logger.error(f"Invalid patient ID in analysis: {analysis.get('patientId')}, Error: {str(e)}")
            raise HTTPException(status_code=500, detail="Invalid patient ID in analysis")
        
        patient = db.patients.find_one({"_id": patient_id})
        if not patient:
            logger.error(f"Patient not found with ID {patient_id}")
            raise HTTPException(status_code=404, detail="Patient not found")
        
        # Generate report file
        current_datetime = datetime.now()
        formatted_date = current_datetime.strftime("%Y%m%d_%H%M%S")
        
        # Create directory structure for reports
        try:
            reports_base_dir = os.path.join(os.getcwd(), "uploads", "reports")
            patient_dir = os.path.join(reports_base_dir, str(patient_id))
            
            # Create new directory structure based on report type
            if report_type == "patient":
                report_type_dir = os.path.join(patient_dir, "patient")
                os.makedirs(report_type_dir, exist_ok=True)
                filename = f"patient_{formatted_date}.pdf"
                filepath = os.path.join(report_type_dir, filename)
                logger.info(f"Creating patient report at path: {filepath}")
                
                # For patient reports, get all analyses for this patient
                # Sort by date (newest first)
                patient_analyses = list(db.analyses.find(
                    {"patientId": patient_id, "status": "completed"})
                    .sort("uploadDate", -1)
                )
                
                # Generate comprehensive patient report with all analyses
                report_path = generate_patient_pdf_report(
                    patient=patient,
                    analyses=patient_analyses,
                    output_path=filepath,
                    user=current_user
                )
            else:  # report_type == "analysis"
                report_type_dir = os.path.join(patient_dir, "analysis")
                analysis_dir = os.path.join(report_type_dir, str(analysis_id))
                os.makedirs(analysis_dir, exist_ok=True)
                filename = f"analysis_{formatted_date}.pdf"
                filepath = os.path.join(analysis_dir, filename)
                logger.info(f"Creating analysis report at path: {filepath}")
            
                # Generate the standard analysis report
            report_path = generate_pdf_report(
                patient=patient,
                analysis=analysis,
                report_type=report_type,
                output_path=filepath,
                user=current_user
            )
        except Exception as e:
            logger.error(f"Error creating report: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error creating report: {str(e)}")
        
        # Create entry in database
        try:
            report_data = {
                "analysisId": analysis_id_obj,
                "patientId": patient_id,
                "reportType": report_type,
                "generatedDate": current_datetime,
                "filePath": report_path,
                "createdBy": ObjectId(current_user["_id"]),
                "isShared": False
            }
            
            result = db.reports.insert_one(report_data)
            
            # Update analysis to mark that a report has been generated
            db.analyses.update_one(
                {"_id": analysis_id_obj},
                {"$set": {"reportGenerated": True}}
            )
        except Exception as e:
            logger.error(f"Database error when saving report: {str(e)}")
            # If we created a file but failed to save in DB, try to clean up
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                    logger.info(f"Removed generated report file after DB error: {filepath}")
                except:
                    logger.warning(f"Failed to remove report file after DB error: {filepath}")
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        
        # Return result
        report_response = {
            "id": str(result.inserted_id),
            "analysisId": report_req.analysisId,
            "patientId": str(patient_id),
            "reportType": report_req.reportType,
            "generatedDate": current_datetime.isoformat(),
            "filePath": report_path,
            "createdBy": str(current_user["_id"])
        }
        
        return report_response
    except HTTPException:
        # Re-raise HTTP exceptions to preserve their status codes
        raise
    except Exception as e:
        # Log any unexpected errors
        logger.exception(f"Unexpected error in create_report: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# Download report endpoint
@router.get("/reports/{report_id}/download")
async def download_report(
    report_id: str = Path(..., description="Report ID"),
    current_user = Depends(get_current_user_from_request)
):
    """Download a generated report"""
    try:
        report_obj_id = ObjectId(report_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid report ID format")
    
    # Find report in database
    report = db.reports.find_one({"_id": report_obj_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Verify file exists
    file_path = report.get("filePath")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Report file not found")
    
    # Return file as attachment
    return FileResponse(
        path=file_path,
        filename=os.path.basename(file_path),
        media_type="application/pdf"
    )

# Get reports for a patient
@router.get("/reports")
async def list_reports(
    patient_id: Optional[str] = Query(None, description="Filter by patient ID"),
    analysis_id: Optional[str] = Query(None, description="Filter by analysis ID"),
    report_type: Optional[str] = Query(None, description="Filter by report type"),
    page: int = Query(1, description="Page number", ge=1),
    limit: int = Query(10, description="Items per page", ge=1, le=50),
    current_user = Depends(get_current_user_from_request)
):
    """List reports with pagination and filtering options"""
    # Build filter
    filter_query = {}
    
    if patient_id:
        try:
            filter_query["patientId"] = ObjectId(patient_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid patient ID format")
    
    if analysis_id:
        try:
            filter_query["analysisId"] = ObjectId(analysis_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid analysis ID format")
    
    if report_type:
        if report_type not in ["patient", "analysis"]:
            raise HTTPException(status_code=400, detail="Invalid report type")
        filter_query["reportType"] = report_type
    
    # Calculate skip value for pagination
    skip = (page - 1) * limit
    
    # Get total count
    total_count = db.reports.count_documents(filter_query)
    
    # Get reports
    reports_cursor = db.reports.find(filter_query).sort("generatedDate", DESCENDING).skip(skip).limit(limit)
    reports = list(reports_cursor)
    
    # Format results
    formatted_reports = []
    for report in reports:
        formatted_reports.append({
            "id": str(report["_id"]),
            "analysisId": str(report["analysisId"]),
            "patientId": str(report["patientId"]),
            "reportType": report["reportType"],
            "generatedDate": report["generatedDate"].isoformat() if isinstance(report["generatedDate"], datetime) else report["generatedDate"],
            "filePath": report["filePath"],
            "createdBy": str(report["createdBy"]) if "createdBy" in report else None,
            "isShared": report.get("isShared", False)
        })
    
    # Calculate pagination metadata
    total_pages = (total_count + limit - 1) // limit
    
    # Return response with pagination metadata
    return {
        "items": formatted_reports,
        "metadata": {
            "total_count": total_count,
            "page_size": limit,
            "current_page": page,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1
        }
    }

# Get single report by ID
@router.get("/reports/{report_id}")
async def get_report(
    report_id: str = Path(..., description="Report ID"),
    current_user = Depends(get_current_user_from_request)
):
    """Get a specific report by ID"""
    try:
        report_obj_id = ObjectId(report_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid report ID format")
    
    # Find report in database
    report = db.reports.find_one({"_id": report_obj_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Format response
    formatted_report = {
        "id": str(report["_id"]),
        "analysisId": str(report["analysisId"]),
        "patientId": str(report["patientId"]),
        "reportType": report["reportType"],
        "generatedDate": report["generatedDate"].isoformat() if isinstance(report["generatedDate"], datetime) else report["generatedDate"],
        "filePath": report["filePath"],
        "createdBy": str(report["createdBy"]) if "createdBy" in report else None,
        "isShared": report.get("isShared", False)
    }
    
    return formatted_report

# Share report via email
@router.post("/reports/{report_id}/share")
@router.get("/reports/{report_id}/share")  # Add GET endpoint for direct redirects
async def share_report(
    request: Request,
    response: Response,
    report_id: str = Path(..., description="Report ID"),
    email: str = Query(None, description="Recipient email for direct redirects"),
    direct_redirect: bool = Query(False, description="Whether to perform a direct redirect to OAuth"),
    token: str = Query(None, description="Auth token for direct access"),
    pre_auth: bool = Query(False, description="Whether the user is already authenticated with Google"),
    share_request: Optional[dict] = Body(None, description="Share request with recipient email", embed=True),
    form_email: Optional[str] = Form(None, description="Email from form submission"),
    form_direct_redirect: Optional[bool] = Form(False, description="Direct redirect flag from form"),
    form_token: Optional[str] = Form(None, description="Auth token from form")
):
    """Share a report via email"""
    # Handle different request methods and content types
    recipient_email = None
    use_direct_redirect = False
    auth_token = None
    is_pre_auth = pre_auth
    
    # Check form data first
    if form_email is not None:
        logger.info("Processing form data submission")
        recipient_email = form_email
        use_direct_redirect = form_direct_redirect
        auth_token = form_token
    # Check query parameters for GET requests
    elif request.method == "GET" and email is not None:
        logger.info("Processing GET request with query parameters")
        recipient_email = email
        use_direct_redirect = direct_redirect
        auth_token = token
    # Check JSON body for POST requests
    elif share_request is not None:
        logger.info("Processing POST request with JSON body")
        recipient_email = share_request.get("email")
        use_direct_redirect = share_request.get("direct_redirect", False)
        is_pre_auth = share_request.get("pre_auth", False)
        auth_token = None  # JSON requests use standard auth header
    else:
        # Try to get raw form data as fallback
        try:
            body = await request.body()
            content_type = request.headers.get("content-type", "")
            logger.info(f"Fallback parsing - Content-Type: {content_type}")
            
            if "application/x-www-form-urlencoded" in content_type and body:
                form_str = body.decode("utf-8")
                logger.info(f"Parsing raw form data: {form_str}")
                
                # Simple form data parsing
                form_data = {}
                for item in form_str.split("&"):
                    if "=" in item:
                        key, value = item.split("=", 1)
                        form_data[key] = value
                
                recipient_email = form_data.get("email")
                use_direct_redirect = form_data.get("direct_redirect", "").lower() == "true"
                auth_token = form_data.get("token")
                logger.info(f"Parsed form data: email={recipient_email}, direct_redirect={use_direct_redirect}")
        except Exception as e:
            logger.error(f"Error parsing request body: {str(e)}")
    
    if not recipient_email:
        raise HTTPException(status_code=400, detail="Recipient email is required")
    
    # Get current user using provided token or regular auth
    try:
        if auth_token:
            # Try to authenticate with provided token
            current_user = await get_current_user_from_token(auth_token)
        else:
            # Use standard request auth (cookies/headers)
            current_user = await get_current_user_from_request(request)
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")
        
    try:
        report_obj_id = ObjectId(report_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid report ID format")
    
    # Find report in database
    report = db.reports.find_one({"_id": report_obj_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Get file path for the report
    report_file_path = report.get("filePath")
    if not report_file_path or not os.path.exists(report_file_path):
        logger.error(f"Report file not found at path: {report_file_path}")
        # Check if the directory exists
        if report_file_path and not os.path.exists(os.path.dirname(report_file_path)):
            logger.error(f"Directory does not exist: {os.path.dirname(report_file_path)}")
        raise HTTPException(status_code=404, detail="Report file not found")
    
    # Get patient details for email content
    try:
        patient_id = ObjectId(report["patientId"])
        patient = db.patients.find_one({"_id": patient_id})
        patient_name = f"{patient.get('firstName', '')} {patient.get('lastName', '')}" if patient else "Unknown Patient"
    except:
        patient_name = "Unknown Patient"
    
    # Create email content
    sender_name = f"{current_user.get('name', '')} {current_user.get('lastname', '')}" if current_user else "Doctor"
    report_type = report.get("reportType", "analysis")
    email_subject = f"Epilepsy Application: {report_type.capitalize()} Report Shared"
    email_message = EmailService.create_report_share_email(patient_name, report_type, sender_name)
    
    # Check for OAuth token in session
    tokens = request.session.get(USER_TOKENS_KEY)
    email_sent = False
    
    # Log the current OAuth state
    logger.info(f"Current OAuth state: tokens present={bool(tokens)}, pre_auth={is_pre_auth}")
    
    if tokens and tokens.get("access_token"):
        # Use Gmail API with OAuth token
        logger.info(f"Using OAuth to send email to {recipient_email}")
        email_sent = await GoogleOAuth.send_email_with_gmail(
            access_token=tokens["access_token"],
            to=recipient_email,
            subject=email_subject,
            message_html=email_message,
            attachment_path=report_file_path
        )
        
        # If email was sent successfully, return success response
        if email_sent:
            # Handle successful email send
            logger.info(f"Email sent successfully to {recipient_email}")
            
            # Get the referrer header to determine which page sent the request
            referrer = request.headers.get("referer", "")
            logger.info(f"Request referrer: {referrer}")
            
            # Determine the return URL based on referrer
            return_url = "/doctor/reports"
            if "patient-details" in referrer:
                # Extract patient ID from referrer
                try:
                    patient_id_match = referrer.split("patient-details/")[1].split("?")[0].split("/")[0]
                    return_url = f"/doctor/patient-details/{patient_id_match}"
                except:
                    pass
            
            if use_direct_redirect:
                # Redirect back to originating page with success message
                encoded_message = "Email+sent+successfully+to+" + recipient_email.replace("@", "%40")
                return RedirectResponse(
                    url=f"{return_url}?success=true&message={encoded_message}",
                    status_code=302
                )
            else:
                # Return JSON response for API clients
                return {"status": "success", "message": f"Report shared successfully with {recipient_email}"}
    
    # If pre_auth was set but we still didn't have tokens, log this unusual situation
    if is_pre_auth:
        logger.warning(f"Pre-auth flag was set but no valid tokens were found in session")
    
    # No valid OAuth token - proceed with authorization
    # Store sharing details in session before redirecting
    pending_share_data = {
        "report_id": report_id,
        "recipient_email": recipient_email,
        "report_path": report_file_path,
        "email_subject": email_subject,
        "email_message": email_message,
        "timestamp": datetime.now().isoformat()
    }
    
    # Force session to be saved
    request.session["pending_share"] = pending_share_data
    
    # Log session information
    logger.info(f"Storing pending share in session for report {report_id} to {recipient_email}")
    logger.info(f"Session keys: {list(request.session.keys())}")
            
    # Generate OAuth URL
    google_oauth = GoogleOAuth()
    auth_url_data = google_oauth.generate_oauth_url(request)
    
    if use_direct_redirect:
        # Server-side redirect to Google authorization
        logger.info(f"Performing direct server-side redirect to Google OAuth")
        return RedirectResponse(url=auth_url_data["auth_url"], status_code=302)
    else:
        # Return auth URL for client-side redirect
        return {
            "status": "oauth_required",
            "auth_url": auth_url_data["auth_url"],
            "message": "Authentication with Google required to share report via email"
        }

# Delete report endpoint
@router.delete("/reports/{report_id}")
async def delete_report(
    report_id: str = Path(..., description="Report ID"),
    current_user = Depends(get_current_user_from_request)
):
    """Delete a report and its associated file"""
    try:
        report_obj_id = ObjectId(report_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid report ID format")
    
    # Find report in database
    report = db.reports.find_one({"_id": report_obj_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Get file path before deleting the document
    file_path = report.get("filePath")
    
    # Delete the document from MongoDB
    delete_result = db.reports.delete_one({"_id": report_obj_id})
    
    if delete_result.deleted_count == 0:
        raise HTTPException(status_code=500, detail="Failed to delete report from database")
    
    # If the file exists, delete it
    if file_path and os.path.exists(file_path):
        try:
            # Delete the file
            os.remove(file_path)
            logger.info(f"Report file deleted: {file_path}")
            
            # Get the directory of the file
            directory = os.path.dirname(file_path)
            
            # Try to clean up empty directories, going up the tree
            while directory and directory != os.path.join(os.getcwd(), "uploads", "reports"):
                try:
                    # Check if directory is empty
                    if len(os.listdir(directory)) == 0:
                        os.rmdir(directory)
                        logger.info(f"Removed empty directory: {directory}")
                        # Move up to parent directory to see if it's also empty now
                        directory = os.path.dirname(directory)
                    else:
                        # If directory is not empty, stop the cleanup
                        break
                except Exception as e:
                    logger.error(f"Failed to remove directory: {directory}, Error: {str(e)}")
                    break
            
        except Exception as e:
            # Log error but don't fail if file deletion fails
            logger.error(f"Failed to delete report file: {file_path}, Error: {str(e)}")
            # We don't raise an exception here because the MongoDB document is already deleted
    
    # Also update any analysis that had reportGenerated=True to false if this was the last report for that analysis
    if report.get("analysisId"):
        analysis_id = report.get("analysisId")
        # Check if any other reports exist for this analysis
        other_reports = db.reports.count_documents({"analysisId": analysis_id})
        if other_reports == 0:
            # No other reports for this analysis, update its reportGenerated field
            db.analyses.update_one(
                {"_id": analysis_id},
                {"$set": {"reportGenerated": False}}
            )
            logger.info(f"Updated analysis {analysis_id} reportGenerated to False")
    
    return {"message": "Report deleted successfully"} 