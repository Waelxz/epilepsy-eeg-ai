import numpy as np
import logging
import os

# Configure logger
logger = logging.getLogger(__name__)

# Constants for data processing
SEGMENT_LENGTH = 1024
OVERLAP = 768

class EEGPreprocessor:
    """
    Class to preprocess raw EEG data for the CNN-BERN model
    Simplified to use the direct segmentation approach from the user's code
    """
    
    def __init__(self):
        """Initialize the EEG preprocessor"""
        pass
    
    def read_txt_file(self, file_path):
        """
        Read TXT file and extract the EEG channels
        
        Args:
            file_path: Path to the TXT file
            
        Returns:
            tuple: (channel_1, channel_2) or (None, None) if error
        """
        try:
            # Read data directly using numpy as in the user's code
            file_data = np.loadtxt(file_path, delimiter=',')
            
            # Extract the two channels
            if file_data.shape[1] == 2:  # Ensure file has 2 columns
                channel_1 = file_data[:, 0]
                channel_2 = file_data[:, 1]
                
                logger.info(f"Successfully read TXT file with {len(channel_1)} samples")
                return channel_1, channel_2
            else:
                logger.error(f"TXT file has unexpected format: {file_data.shape[1]} columns instead of 2")
                return None, None
                
        except Exception as e:
            logger.error(f"Error reading TXT file: {str(e)}")
            return None, None
    
    def segment_data(self, channel_1, channel_2, segment_length=SEGMENT_LENGTH, overlap=OVERLAP):
        """
        Segment EEG data into overlapping windows using the user's direct approach
        
        Args:
            channel_1: First EEG channel data
            channel_2: Second EEG channel data
            segment_length: Length of each segment
            overlap: Overlap between segments
            
        Returns:
            ndarray: Segmented data array of shape (n_segments, segment_length, channels)
        """
        try:
            # Create segments with overlap using direct approach from user's code
            segments = []
            
            for i in range(0, len(channel_1) - segment_length + 1, segment_length - overlap):
                # Create a segment with both channels side by side
                segment = np.column_stack((
                    channel_1[i:i+segment_length],
                    channel_2[i:i+segment_length]
                ))
                
                # Only add complete segments
                if segment.shape[0] == segment_length:
                    segments.append(segment)
            
            if not segments:
                logger.warning("No valid segments could be created")
                return None
                
            return np.array(segments)
            
        except Exception as e:
            logger.error(f"Error segmenting data: {str(e)}")
            return None
    
    def prepare_for_model(self, file_path):
        """
        Complete preprocessing pipeline using direct segmentation approach
        
        Args:
            file_path: Path to the EEG file (.txt)
            
        Returns:
            tuple: (segmented_data, error_message)
        """
        try:
            # Check if file exists
            if not os.path.exists(file_path):
                return None, f"File not found: {file_path}"
            
            # Check file extension
            file_extension = os.path.splitext(file_path)[1].lower()
            
            if file_extension != '.txt':
                return None, f"Unsupported file format: {file_extension}. Only .txt files are supported."
            
            # Read EEG data
            channel_1, channel_2 = self.read_txt_file(file_path)
            
            if channel_1 is None:
                return None, f"Failed to read file: {file_path}"
            
            # Create segments
            segments = self.segment_data(channel_1, channel_2)
            
            if segments is None:
                return None, "Failed to create segments from EEG data"
            
            logger.info(f"Preprocessing complete. Generated {segments.shape[0]} segments")
            
            return segments, None
            
        except Exception as e:
            error_msg = f"Error in preprocessing: {str(e)}"
            logger.error(error_msg)
            return None, error_msg

# Create a singleton preprocessor instance
preprocessor = EEGPreprocessor() 