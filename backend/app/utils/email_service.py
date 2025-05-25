import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
import os
from pathlib import Path
import logging
from datetime import datetime
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Email configuration
# Use environment variables for sensitive information
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
EMAIL_USERNAME = os.getenv("EMAIL_USERNAME", "REDACTED_EMAIL_USERNAME")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "")  # Get from environment variable
DEFAULT_SENDER = f"Epilepsy Application <{EMAIL_USERNAME}>"

class EmailService:
    @staticmethod
    def send_report_email(recipient_email, subject, message, report_path, sender_name="Epilepsy Application"):
        """
        Send an email with a report attachment
        
        Args:
            recipient_email (str): Email address of the recipient
            subject (str): Email subject
            message (str): Email message content
            report_path (str): Path to the report file to attach
            sender_name (str): Name to display as the sender
            
        Returns:
            bool: True if email sent successfully, False otherwise
        """
        try:
            if not EMAIL_PASSWORD:
                logger.error("Email password not configured in environment variables")
                return False
                
            # Create message container
            msg = MIMEMultipart()
            msg['From'] = f"{sender_name} <{EMAIL_USERNAME}>"
            msg['To'] = recipient_email
            msg['Subject'] = subject
            
            # Add message body
            msg.attach(MIMEText(message, 'html'))
            
            # Attach the report file
            if os.path.exists(report_path):
                try:
                    with open(report_path, "rb") as file:
                        attachment = MIMEApplication(file.read(), _subtype="pdf")
                        attachment.add_header(
                            'Content-Disposition', 
                            'attachment', 
                            filename=os.path.basename(report_path)
                        )
                        msg.attach(attachment)
                        logger.info(f"Successfully attached file: {report_path}")
                except Exception as e:
                    logger.error(f"Error attaching file {report_path}: {str(e)}")
            else:
                logger.error(f"Report file not found: {report_path}")
                return False
                    
            # Connect to SMTP server
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
            server.starttls()  # Secure the connection
            
            logger.info(f"Attempting to log in to SMTP server with username: {EMAIL_USERNAME}")
            server.login(EMAIL_USERNAME, EMAIL_PASSWORD)
            
            # Send email
            logger.info(f"Sending email to {recipient_email} via SMTP")
            server.send_message(msg)
            server.quit()
            
            logger.info(f"Email sent successfully to {recipient_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email: {str(e)}")
            return False
            
    @staticmethod
    def create_report_share_email(patient_name, report_type, sender_name):
        """Create HTML email content for report sharing"""
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333333;
                    max-width: 600px;
                    margin: 0 auto;
                }}
                .header {{
                    background-color: #4f46e5;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    border-radius: 8px 8px 0 0;
                }}
                .content {{
                    padding: 20px;
                    border: 1px solid #e5e7eb;
                    border-top: none;
                    border-radius: 0 0 8px 8px;
                }}
                .footer {{
                    margin-top: 30px;
                    font-size: 12px;
                    color: #6b7280;
                    text-align: center;
                }}
                .button {{
                    display: inline-block;
                    background-color: #4f46e5;
                    color: white;
                    padding: 10px 20px;
                    margin: 20px 0;
                    text-decoration: none;
                    border-radius: 4px;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <h2>Epilepsy Application Report</h2>
            </div>
            <div class="content">
                <p>Hello,</p>
                <p>A {report_type} report for patient <b>{patient_name}</b> has been shared with you by {sender_name}.</p>
                <p>Please find the report attached to this email. This report contains confidential medical information and should be handled accordingly.</p>
                <p>If you have any questions about this report, please contact the sender directly.</p>
                <p>Best regards,<br>Epilepsy Application Team</p>
            </div>
            <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
                <p>&copy; {datetime.now().year} Epilepsy Application. All rights reserved.</p>
            </div>
        </body>
        </html>
        """
        return html_content 