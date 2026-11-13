import os
import logging
import json
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv
import httpx
from .rag_service import rag_service
from ..utils.database import db
from bson import ObjectId
import pathlib
from datetime import datetime

# Configure logger
logger = logging.getLogger(__name__)

# Load environment variables with explicit path
dotenv_path = pathlib.Path(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))).joinpath('.env')
load_dotenv(dotenv_path=dotenv_path)

# OpenRouter API key from envcopy.txt as a fallback
FALLBACK_API_KEY = "REPLACE_WITH_OPENROUTER_API_KEY"

# Custom JSON encoder to handle MongoDB types
class MongoJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, ObjectId):
            return str(obj)
        return super().default(obj)

class ChatService:
    """
    Service to handle chatbot interactions using OpenRouter API
    """
    
    def __init__(self):
        """Initialize the chat service"""
        self.api_key = os.getenv('OPENROUTER_API_KEY')
        # Use fallback if not found in environment
        if not self.api_key:
            logger.info("OpenRouter API key not found in environment, using fallback key")
            self.api_key = FALLBACK_API_KEY
        else:
            logger.info("OpenRouter API key loaded from environment variables")
            
        self.api_url = "https://openrouter.ai/api/v1/chat/completions"
        self.model = "qwen/qwen3-235b-a22b:free"
        
        # Store the last RAG context to avoid unnecessary retrievals
        self.last_rag_context = ""
        self.last_query = ""
        
    def query_mongodb(self, collection_name: str, query: Dict, projection: Dict = None) -> List[Dict]:
        """
        Query MongoDB for data
        
        Args:
            collection_name: Name of the collection
            query: MongoDB query
            projection: Fields to include/exclude
            
        Returns:
            list: Query results or empty list if error
        """
        try:
            collection = db[collection_name]
            cursor = collection.find(query, projection or {})
            # Convert ObjectId to string for JSON serialization
            results = []
            for doc in cursor:
                if '_id' in doc and isinstance(doc['_id'], ObjectId):
                    doc['_id'] = str(doc['_id'])
                results.append(doc)
            return results
        except Exception as e:
            logger.error(f"Error querying MongoDB: {str(e)}")
            return []
            
    def get_patient_data(self, patient_id: str) -> Dict:
        """
        Get patient data by ID
        
        Args:
            patient_id: Patient ID
            
        Returns:
            dict: Patient data or empty dict if error
        """
        try:
            # Convert string ID to ObjectId
            obj_id = ObjectId(patient_id)
            
            # Query patient data
            patient = db.patients.find_one({"_id": obj_id})
            
            if not patient:
                return {}
                
            # Convert ObjectId to string
            if '_id' in patient:
                patient['_id'] = str(patient['_id'])
                
            return patient
            
        except Exception as e:
            logger.error(f"Error getting patient data: {str(e)}")
            return {}
            
    def get_analysis_data(self, analysis_id: str) -> Dict:
        """
        Get analysis data by ID
        
        Args:
            analysis_id: Analysis ID
            
        Returns:
            dict: Analysis data or empty dict if error
        """
        try:
            # Convert string ID to ObjectId
            obj_id = ObjectId(analysis_id)
            
            # Query analysis data
            analysis = db.analyses.find_one({"_id": obj_id})
            
            if not analysis:
                return {}
                
            # Convert ObjectId to string
            if '_id' in analysis:
                analysis['_id'] = str(analysis['_id'])
            if 'patientId' in analysis and isinstance(analysis['patientId'], ObjectId):
                analysis['patientId'] = str(analysis['patientId'])
                
            return analysis
            
        except Exception as e:
            logger.error(f"Error getting analysis data: {str(e)}")
            return {}
    
    async def generate_chat_response(self, message: str, context: Dict = None, history: List = None) -> Dict:
        """
        Generate response using the chatbot
        
        Args:
            message: User's message
            context: Application context (e.g., current page, patient data)
            history: Previous messages in the conversation
            
        Returns:
            dict: Response from the chatbot
        """
        try:
            if not self.api_key:
                logger.error("OpenRouter API key not found in environment variables")
                return {"error": "API key not configured"}
                
            # Initialize RAG service if needed
            if not rag_service.is_initialized:
                rag_service.initialize()
            
            # Determine if we should use RAG for this message
            should_use_rag = self._should_use_rag(message, history)
            
            # Retrieve relevant context from documents only if needed
            doc_context_text = ""
            if should_use_rag:
                logger.info("Retrieving RAG context for message")
                doc_contexts = rag_service.retrieve_relevant_context(message)
                doc_context_text = "\n\n".join(doc_contexts) if doc_contexts else ""
                
                # Store for future use
                if doc_context_text:
                    self.last_rag_context = doc_context_text
                    self.last_query = message
            else:
                logger.info("Skipping RAG retrieval for follow-up question")
                # Use the last RAG context if available
                if self.last_rag_context:
                    logger.info("Using cached RAG context from previous query")
                    doc_context_text = self.last_rag_context
            
            # Process context data
            context_data = await self._process_context(message, context)
            
            # Build the system prompt
            system_prompt = f"""You are an AI medical assistant specializing in epilepsy and EEG analysis, integrated into the Epilepsy Detection Application. 
Your role is to provide accurate, helpful information to doctors about epilepsy, EEG interpretation, and patient data.

You have access to the following information:
1. Medical knowledge about epilepsy from scholarly articles and medical guidelines
2. Patient records and EEG analysis results (if provided in the context)
3. The current application context (which page the doctor is viewing)
4. The full conversation history with the user

CRITICAL INSTRUCTIONS FOR PAGE CONTEXT:
- ALWAYS be aware of which page the user is currently on
- When asked about the current page, ALWAYS respond with the most up-to-date page information
- If the context mentions the current page, reference this information in your response
- If there's a patient_id in the context, mention the patient in your response when appropriate
- Check for context changes between messages and acknowledge them

CRITICAL INSTRUCTIONS FOR CONVERSATION MEMORY:
- You MUST accurately recall previous messages when asked about conversation history
- If asked "what was my last message" or similar, respond with the exact previous user message
- If asked about earlier messages, you must correctly identify them from the conversation history
- Pay close attention to the numbered conversation history provided to you
- Do NOT make up or hallucinate conversation history that didn't occur
- When asked about the chat history, provide a BRIEF summary or list only the most recent 3-5 exchanges
- DO NOT repeat the entire conversation history verbatim
- AVOID generating excessively long or recursive responses about conversation history

When answering general questions:
- Be concise and professional in your responses
- Reference medical guidelines when appropriate
- If you reference patient data, clearly indicate which patient you're discussing
- If asked about EEG interpretation, explain the significance of focal vs. non-focal patterns
- Never make up information about specific patients
- If you don't know something specific about a patient, say so rather than guessing
- Maintain continuity with the conversation history when responding

{context_data["prompt_context"]}"""
            
            # Prepare messages array with conversation history
            messages = [{"role": "system", "content": system_prompt}]
            
            # Initialize validated history
            validated_history = []
            
            # Add conversation history if available
            if history:
                # Check if history is not None and not empty
                if isinstance(history, list) and len(history) > 0:
                    logger.info(f"Processing chat history with {len(history)} messages")
                    
                    # Log summary of received history
                    try:
                        history_summary = f"Received {len(history)} messages in history"
                        if len(history) > 0:
                            sample = []
                            for i, msg in enumerate(history[:3]):  # Just log first 3 messages
                                if hasattr(msg, 'role') and hasattr(msg, 'content'):
                                    # It's a Pydantic model
                                    sample.append(f"[{i}] {msg.role}: {msg.content[:20]}...")
                                elif isinstance(msg, dict) and 'role' in msg and 'content' in msg:
                                    sample.append(f"[{i}] {msg['role']}: {msg['content'][:20]}...")
                                else:
                                    sample.append(f"[{i}] Unknown format: {type(msg)}")
                            history_summary += f" | Sample: {', '.join(sample)}"
                        logger.info(history_summary)
                    except Exception as e:
                        logger.warning(f"Error logging history: {str(e)}")
                    
                    # Clean and validate the history
                    for msg in history:
                        # Handle both dict and Pydantic model formats
                        if hasattr(msg, 'role') and hasattr(msg, 'content'):
                            # It's a Pydantic model
                            role = msg.role.lower()
                            content = msg.content
                        elif isinstance(msg, dict) and "role" in msg and "content" in msg:
                            # It's a dictionary
                            role = msg["role"].lower()
                            content = msg["content"]
                        else:
                            # Invalid format
                            logger.warning(f"Skipping message with invalid format: {type(msg)}")
                            continue
                                
                        # Skip empty messages
                        if not content or not content.strip():
                            continue
                                
                        # Validate roles are either 'user' or 'assistant'
                        if role not in ["user", "assistant"]:
                            continue
                                
                        # Add to validated history
                        validated_history.append({
                            "role": role,
                            "content": content.strip()
                        })
                else:
                    logger.warning("History parameter was provided but is not a valid list or is empty")
            else:
                logger.info("No conversation history provided")
            
            # Only process history if we have valid entries
            if validated_history:
                # Format the conversation history into a clear, structured format
                conversation_log = ""
                for i, msg in enumerate(validated_history):
                    speaker = "User" if msg["role"] == "user" else "Assistant"
                    conversation_log += f"\n\n[Message {i+1}]\n{speaker}: {msg['content']}"
                
                # Create a standalone conversation history message that clearly shows the exchange
                if conversation_log:
                    # First, add this as an explicit system message about conversation history
                    history_message = {
                        "role": "system", 
                        "content": f"""IMPORTANT - CONVERSATION HISTORY SO FAR:{conversation_log}

When the user asks about previous messages, refer to this conversation history but DO NOT repeat the entire history verbatim in your response.
Instead, summarize it briefly or list only the most recent 3-5 exchanges.
DO NOT include recursive descriptions of the history within your response.
If you notice yourself generating a very long response about chat history, STOP and keep it brief."""
                    }
                    messages.append(history_message)
                    logger.info(f"Added formatted conversation history with {len(validated_history)} messages")
                
                # Add the messages directly to the conversation
                for msg in validated_history:
                    messages.append({"role": msg["role"], "content": msg["content"]})
                    logger.debug(f"Added message to conversation: {msg['role']}: {msg['content'][:50]}...")
            else:
                logger.warning("No valid conversation history to add to the prompt - this may affect continuity")
            
            # Combine document context with the current message
            if doc_context_text:
                enhanced_message = f"""I need information related to this query: "{message}"

Here is some relevant information from medical literature:
{doc_context_text}

Based on this information and your medical knowledge, please answer the query."""
            else:
                enhanced_message = message
            
            # Add the current user message
            messages.append({"role": "user", "content": enhanced_message})
            
            # Prepare the request to OpenRouter
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": self.model,
                "messages": messages
            }
            
            # Make the API request
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    self.api_url,
                    headers=headers,
                    json=payload
                )
                
                response_data = response.json()
                
                if response.status_code != 200:
                    logger.error(f"Error from OpenRouter API: {response_data}")
                    return {"error": f"API error: {response_data.get('error', {}).get('message', 'Unknown error')}"}
                
                # Extract the assistant's message
                assistant_message = response_data['choices'][0]['message']['content']
                
                return {
                    "response": assistant_message,
                    "model": response_data.get('model', self.model)
                }
                
        except Exception as e:
            logger.error(f"Error generating chat response: {str(e)}")
            return {"error": f"Failed to generate response: {str(e)}"}
    
    async def _process_context(self, message: str, context: Dict = None) -> Dict:
        """
        Process application context to enhance the prompt
        
        Args:
            message: User's message
            context: Application context
            
        Returns:
            dict: Processed context information
        """
        if not context:
            return {"prompt_context": "No specific application context is available."}
            
        prompt_parts = []
        patient_data = None
        
        # Handle current page context
        if "page" in context:
            prompt_parts.append(f"CURRENT PAGE: The doctor is viewing the {context['page']} page of the application.")
        else:
            prompt_parts.append("CURRENT PAGE: Unknown (no page information provided)")
        
        # If we have an analysis ID, get that first as it contains patient information
        if "analysis_id" in context and context["analysis_id"]:
            try:
                analysis_data = self.get_analysis_data(context["analysis_id"])
                if analysis_data:
                    prompt_parts.append(f"The doctor is viewing EEG analysis with ID: {analysis_data.get('_id', '')}")
                    
                    # Get analysis date and format it properly
                    if "createdAt" in analysis_data:
                        if isinstance(analysis_data["createdAt"], datetime):
                            analysis_date = analysis_data["createdAt"].strftime("%Y-%m-%d %H:%M:%S")
                        else:
                            analysis_date = str(analysis_data["createdAt"])
                        prompt_parts.append(f"Analysis date: {analysis_date}")
                    
                    # Add analysis result if available
                    if "result" in analysis_data:
                        result = analysis_data["result"]
                        result_class = result.get("class", -1)
                        classification = "Non-Focal" if result_class == 1 else "Focal" if result_class == 0 else "Unknown"
                        prompt_parts.append(f"Analysis classification: {classification} (class {result_class})")
                        prompt_parts.append(f"Analysis confidence: {result.get('confidence', 'N/A')}")
                        
                        # Add interpretation if available
                        if "interpretation" in result:
                            prompt_parts.append(f"Medical interpretation: {result['interpretation']}")
                    
                    # If analysis has patient ID, get patient data
                    if "patientId" in analysis_data:
                        patient_id = analysis_data["patientId"]
                        # If patientId is already a string, use it directly
                        if isinstance(patient_id, str):
                            patient_data = self.get_patient_data(patient_id)
                        # Otherwise if it's an ObjectId, convert to string first
                        elif isinstance(patient_id, ObjectId):
                            patient_data = self.get_patient_data(str(patient_id))
                        
                        # If we found patient data, note that it's from the analysis
                        if patient_data:
                            prompt_parts.append(f"This analysis is for the patient below:")
                    
                    # Add analysis data in structured format for the LLM using custom encoder
                    prompt_parts.append("Analysis data available:")
                    prompt_parts.append(json.dumps(analysis_data, indent=2, cls=MongoJSONEncoder))
            except Exception as e:
                logger.error(f"Error processing analysis context: {str(e)}")
                prompt_parts.append("Note: Analysis information was requested but could not be retrieved.")
        
        # Handle patient context if available and not already set from analysis
        if not patient_data and "patient_id" in context and context["patient_id"]:
            try:
                patient_data = self.get_patient_data(context["patient_id"])
            except Exception as e:
                logger.error(f"Error processing patient context: {str(e)}")
                prompt_parts.append("Note: Patient information was requested but could not be retrieved.")
        
        # Add patient data to context if available
        if patient_data:
            try:
                patient_name = f"{patient_data.get('firstName', '')} {patient_data.get('lastName', '')}"
                patient_info = f"The doctor is viewing information for patient: {patient_name} (ID: {patient_data.get('_id', '')})"
                
                # Add basic patient demographics with better date formatting
                if "dateOfBirth" in patient_data:
                    dob = patient_data["dateOfBirth"]
                    if isinstance(dob, datetime):
                        formatted_dob = dob.strftime("%Y-%m-%d")
                    else:
                        formatted_dob = str(dob)
                    patient_info += f", DOB: {formatted_dob}"
                
                if "gender" in patient_data:
                    patient_info += f", Gender: {patient_data['gender']}"
                    
                prompt_parts.append(patient_info)
                
                # Add patient data in structured format for the LLM using custom encoder
                prompt_parts.append("Patient data available:")
                prompt_parts.append(json.dumps(patient_data, indent=2, cls=MongoJSONEncoder))
            except Exception as e:
                logger.error(f"Error formatting patient data: {str(e)}")
                prompt_parts.append("Note: Could not format patient information properly.")
        
        # Combine all context parts
        prompt_context = "\n\n".join(prompt_parts) if prompt_parts else "No specific application context is available."
        
        return {
            "prompt_context": prompt_context
        }
        
    def _should_use_rag(self, message: str, history: List = None) -> bool:
        """
        Determine if we should use RAG for this message
        
        Args:
            message: Current user message
            history: Previous messages in the conversation
            
        Returns:
            bool: True if RAG should be used, False otherwise
        """
        # Check if history is a valid list and not empty
        if not history:
            logger.info("No history available, using RAG for new conversation")
            return True
            
        # Validate history object
        if not isinstance(history, list):
            logger.warning(f"History is not a list but {type(history)}, using RAG")
            return True
            
        # Count valid messages in history
        valid_messages = 0
        for msg in history:
            # Check both dict and Pydantic model formats
            if hasattr(msg, 'role') and hasattr(msg, 'content'):
                valid_messages += 1
            elif isinstance(msg, dict) and "role" in msg and "content" in msg:
                valid_messages += 1
                
        # Always use RAG for the first message only
        if valid_messages < 2:
            logger.info(f"Only {valid_messages} valid messages in history, using RAG for new conversation")
            return True
            
        # Check if this is likely a follow-up question
        follow_up_indicators = [
            "what about", "how about", "can you explain", "tell me more", 
            "elaborate", "continue", "go on", "and then", "what else",
            "also", "additionally", "moreover", "furthermore", "why",
            "could you", "please", "thanks", "thank you", "that's helpful",
            "that was helpful", "I see", "okay", "ok", "got it", "I understand",
            "yes", "no", "maybe", "perhaps", "earlier", "before", "previously",
            "you mentioned", "you said", "remember", "previous", "last message"
        ]
        
        # Convert message to lowercase for easier comparison
        lowercase_message = message.lower()
        
        # If the message is very short (likely a follow-up)
        if len(message.split()) <= 5:
            logger.info("Short message detected, treating as follow-up and skipping RAG")
            return False
            
        # Check for follow-up indicators
        for indicator in follow_up_indicators:
            if indicator in lowercase_message:
                logger.info(f"Follow-up indicator '{indicator}' detected, skipping RAG")
                return False
                
        # If message appears to be a new topic (not related to previous context)
        topic_change_indicators = ["new topic", "different question", "another topic", "change subject", "different subject"]
        for indicator in topic_change_indicators:
            if indicator in lowercase_message:
                logger.info(f"Topic change indicator '{indicator}' detected, using RAG")
                return True
        
        # If we've had several exchanges without RAG (every ~5 messages), consider using RAG again
        if valid_messages >= 10 and valid_messages % 5 == 0:
            logger.info(f"Reached {valid_messages} messages, periodically using RAG to refresh context")
            return True
        
        # For conversation continuity, don't use RAG for ongoing conversations unless needed
        logger.info("Using conversation context without RAG for ongoing conversation")
        return False

# Create a singleton instance
chat_service = ChatService() 