import os
import tensorflow as tf
import logging
from tensorflow.keras.models import load_model
import gc

# Configure logger
logger = logging.getLogger(__name__)

class ModelLoader:
    """
    Class to load and manage the TensorFlow model for EEG classification
    """
    
    def __init__(self, model_path=None):
        """
        Initialize the model loader
        
        Args:
            model_path: Path to the model file. If None, uses the default path.
        """
        # If model_path is not provided, use the default
        if model_path is None:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            model_path = os.path.join(current_dir, 'CNN-BERN.h5')
        
        self.model_path = model_path
        self.model = None
        self.loaded = False
    
    def load_model(self):
        """
        Load the TensorFlow model into memory using direct Keras load_model
        
        Returns:
            bool: True if model loaded successfully, False otherwise
        """
        try:
            # Check if model file exists
            if not os.path.exists(self.model_path):
                logger.error(f"Model file not found at {self.model_path}")
                self.loaded = False
                return False
                
            logger.info(f"Loading model from {self.model_path}")
            
            # Load model directly using Keras as in user's code
            self.model = load_model(self.model_path)
            
            self.loaded = True
            logger.info("Model loaded successfully")
            return True
        except Exception as e:
            logger.error(f"Error loading model: {str(e)}")
            self.loaded = False
            return False
    
    def get_model(self, force_reload=False):
        """
        Get the loaded model. Load it first if not already loaded.
        
        Args:
            force_reload: If True, reload the model even if already loaded
            
        Returns:
            The TensorFlow model or None if loading fails
        """
        if not self.loaded or force_reload:
            self.clear_model()
            self.load_model()
        
        return self.model
    
    def get_model_info(self):
        """
        Get basic information about the model
        
        Returns:
            dict: Model information
        """
        model = self.get_model()
        if model is None:
            return {"error": "Model not loaded"}
        
        return {
            "name": "CNN-BERN",
            "type": "TensorFlow CNN",
            "input_shape": model.input_shape[1:],
            "output_shape": model.output_shape[1:],
            "layers": len(model.layers),
            "file_path": self.model_path
        }
    
    def clear_model(self):
        """
        Clear the model from memory to free resources
        
        Returns:
            bool: True if successful
        """
        try:
            # Clear TensorFlow session and model
            if self.model is not None:
                del self.model
                self.model = None
            
            # Clear Keras backend session
            tf.keras.backend.clear_session()
            
            # Force garbage collection
            gc.collect()
            
            self.loaded = False
            logger.info("Model resources cleared successfully")
            return True
        except Exception as e:
            logger.error(f"Error clearing model resources: {str(e)}")
            return False
    
    def reload_model(self):
        """
        Reload the model (clear and load again)
        
        Returns:
            bool: True if reload was successful
        """
        self.clear_model()
        return self.load_model()

# Singleton model loader instance
model_loader = ModelLoader() 