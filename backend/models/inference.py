import numpy as np
import logging
import os
import time
from .model_loader import model_loader
from .preprocessor import preprocessor

# Configure logger
logger = logging.getLogger(__name__)

class EEGInferenceEngine:
    """
    Class to run inference on EEG data using the CNN-BERN model
    Uses direct segmentation and classification approach
    """
    
    def __init__(self):
        """Initialize the inference engine"""
        self.model = None
        self.avg_inference_time = 0
        self.inference_count = 0
    
    def load_model(self):
        """
        Load the model for inference using model_loader
        
        Returns:
            bool: True if model loaded successfully, False otherwise
        """
        if self.model is None:
            # Use the model loader to get the model
            self.model = model_loader.get_model(force_reload=True)
            if self.model is None:
                logger.error("Failed to load model for inference. Check that the model file exists.")
                return False
        
        return True
    
    def run_inference(self, segments):
        """
        Run inference on preprocessed segments using direct approach
        
        Args:
            segments: Preprocessed EEG segments
            
        Returns:
            dict: Inference results
        """
        # Load model if not already loaded
        if not self.load_model():
            return {
                "error": "Failed to load inference model",
                "status": "failed"
            }
        
        try:
            # Start timing
            start_time = time.time()
            
            # Run inference directly on the segments
            segment_probs = self.model.predict(segments)
            segment_predictions = (segment_probs > 0.5).astype(int).flatten()
            
            # Calculate the overall prediction
            overall_prob = float(np.mean(segment_probs))
            overall_class = 1 if overall_prob > 0.5 else 0
            
            # Calculate confidence (distance from 0.5)
            confidence = float(abs(overall_prob - 0.5) * 2)  # Scale to 0-1
            
            # End timing and calculate average
            end_time = time.time()
            inference_time = end_time - start_time
            
            # Update average inference time
            self.avg_inference_time = ((self.avg_inference_time * self.inference_count) + inference_time) / (self.inference_count + 1)
            self.inference_count += 1
            
            # Process segment-wise results
            segment_results = []
            for i, prob in enumerate(segment_probs):
                prob_value = float(prob[0])
                segment_class = 1 if prob_value > 0.5 else 0
                segment_results.append({
                    "segment_id": i,
                    "class": segment_class,
                    "probability": prob_value,
                    "classification": "Non-Focal" if segment_class == 1 else "Focal"
                })
            
            # Create interpretation based on result
            if overall_class == 0:  # Class 0 is Focal (abnormal)
                interpretation = """Focal EEG patterns detected. These patterns suggest localized electrical activity that may be consistent with epileptiform activity originating from a specific brain region. Focal patterns are characterized by rhythmic discharges, sharp waves, or spikes that are confined to specific EEG channels or brain areas. This finding may warrant clinical correlation, especially if the patient presents with focal seizure symptoms, neurological deficits, or has a history of epilepsy."""
            else:  # Class 1 is Non-Focal (normal)
                interpretation = """Non-Focal EEG patterns observed. The recording shows distributed electrical activity without evidence of localized epileptiform discharges. Non-focal patterns indicate normal or diffuse brain activity without the characteristic sharp waves or spikes associated with epileptogenic zones. This suggests absence of focal seizure activity in the recorded segments, though clinical correlation is advised for a complete assessment."""
            
            # Calculate additional metrics
            focal_count = int(np.sum(segment_predictions == 0))
            non_focal_count = int(np.sum(segment_predictions == 1))
            
            confidence_metrics = {
                "mean_probability": overall_prob,
                "confidence_score": confidence,
                "majority_vote": int(np.bincount(segment_predictions).argmax()),
                "consistency": float(max(focal_count, non_focal_count) / len(segment_predictions))
            }
            
            return {
                "status": "completed",
                "overall_result": {
                    "class": overall_class,
                    "probability": overall_prob,
                    "confidence": confidence,
                    "classification": "Non-Focal" if overall_class == 1 else "Focal",
                    "interpretation": interpretation
                },
                "segment_results": segment_results,
                "metrics": {
                    "num_segments": len(segment_results),
                    "focal_count": focal_count,
                    "non_focal_count": non_focal_count,
                    "inference_time_ms": round(inference_time * 1000, 2),
                    "avg_inference_time_ms": round(self.avg_inference_time * 1000, 2),
                    "confidence_metrics": confidence_metrics
                }
            }
            
        except Exception as e:
            logger.error(f"Inference error: {str(e)}")
            return {
                "error": f"Inference failed: {str(e)}",
                "status": "failed"
            }
            
    def process_eeg_file(self, file_path):
        """
        Process an EEG file using direct segmentation classification approach
        
        Args:
            file_path: Path to the EEG file
            
        Returns:
            dict: Processing results
        """
        try:
            # Direct approach from user's code
            if os.path.splitext(file_path)[1].lower() == '.txt':
                # Use the preprocessor to prepare the segments
                segments, error = preprocessor.prepare_for_model(file_path)
                
                if error:
                    return {
                        "error": error,
                        "status": "failed"
                    }
                
                if segments is None or len(segments) == 0:
                    return {
                        "error": "No valid segments could be extracted from the EEG data",
                        "status": "failed"
                    }
                
                # Run inference on the segments
                results = self.run_inference(segments)
                
                # Ensure consistent classification terminology 
                if "overall_result" in results:
                    class_value = results["overall_result"].get("class")
                    if class_value == 0:
                        results["overall_result"]["classification"] = "Focal"
                    elif class_value == 1:
                        results["overall_result"]["classification"] = "Non-Focal"
                
                # Add file information
                try:
                    file_size = os.path.getsize(file_path)
                    file_name = os.path.basename(file_path)
                except:
                    file_size = 0
                    file_name = "unknown"
                    
                results["file_info"] = {
                    "file_name": file_name,
                    "file_size": file_size,
                    "file_path": file_path,
                }
                
                return results
                
            else:
                return {
                    "error": "Unsupported file format. Only .txt files are supported.",
                    "status": "failed"
                }
                
        except Exception as e:
            logger.error(f"Processing error: {str(e)}")
            return {
                "error": f"Processing failed: {str(e)}",
                "status": "failed"
            }

# Create a singleton inference engine instance
inference_engine = EEGInferenceEngine() 