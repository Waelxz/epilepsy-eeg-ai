import logging
import os
import time
from .model_loader import model_loader
from .inference import inference_engine

# Configure logger
logger = logging.getLogger(__name__)

class ModelHealthChecker:
    """
    Class to check model health and provide model information
    """
    
    def __init__(self):
        """Initialize the health checker"""
        pass
    
    def get_model_status(self):
        """
        Check if the model is loaded and working
        
        Returns:
            dict: Status information
        """
        start_time = time.time()
        
        # Check if model loads
        model = model_loader.get_model()
        
        load_time = time.time() - start_time
        
        if model is None:
            return {
                "status": "error",
                "message": "Failed to load model",
                "load_time_ms": round(load_time * 1000, 2),
            }
        
        # Get model information
        model_info = model_loader.get_model_info()
        
        return {
            "status": "ok",
            "message": "Model loaded successfully",
            "load_time_ms": round(load_time * 1000, 2),
            "model_info": model_info,
            "memory_usage": self._get_model_memory_usage(),
            "device": self._get_model_device()
        }
    
    def _get_model_memory_usage(self):
        """Estimate model memory usage"""
        try:
            model = model_loader.get_model()
            if model is None:
                return "Unknown"
            
            # Get model size on disk
            model_path = model_loader.model_path
            model_size = os.path.getsize(model_path) if os.path.exists(model_path) else 0
            
            return f"{round(model_size / (1024 * 1024), 2)} MB"
        except Exception as e:
            logger.error(f"Error getting model memory usage: {str(e)}")
            return "Unknown"
    
    def _get_model_device(self):
        """Get the device the model is running on (CPU/GPU)"""
        try:
            import tensorflow as tf
            gpus = tf.config.list_physical_devices('GPU')
            if gpus:
                return f"GPU ({len(gpus)} available)"
            else:
                return "CPU"
        except Exception as e:
            logger.error(f"Error getting model device: {str(e)}")
            return "Unknown"
        
# Create a singleton health checker instance
health_checker = ModelHealthChecker() 