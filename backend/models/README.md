# CNN-BERN EEG Analysis Model

## Overview

This directory contains the CNN-BERN model for epilepsy detection from EEG signals. The model is a Convolutional Neural Network that takes EEG data as input and classifies it as Focal (class 0) or Non-Focal (class 1). The model has been trained on the Bern-Barcelona dataset.

## Files

- `CNN-BERN.h5`: The trained TensorFlow model
- `CNN-BERN_training.py`: The training code for the model
- `model_loader.py`: Module for loading the model
- `preprocessor.py`: Module for preprocessing EEG data
- `inference.py`: Module for running inference with the model
- `health_check.py`: Module for checking model health
- `Data_F_50/`: Directory containing reference data from the Bern-Barcelona dataset (Focal class examples)

## Model Architecture

The model is a CNN with the following architecture:
- Input shape: (1024, 2) - Two-channel EEG data segmented into 1024 time points
- Three convolutional layers with batch normalization, max pooling, and dropout
- Fully connected layers
- Output: Binary classification (Focal vs Non-Focal) with sigmoid activation

## Integration with Backend

The model is integrated into the FastAPI backend through:
1. `/api/analyses` endpoint - For uploading EEG files and running analysis
2. `/api/models/health` endpoint - For checking model status
3. `/api/models` endpoint - For listing available models

## Using the Model

To use the model for analysis:

1. Upload a .txt file (Bern-Barcelona format) or .edf file through the `/api/analyses` endpoint.
2. The file will be preprocessed:
   - Reading file (TXT or EDF format)
   - Filtering the data (bandpass 0.5-40Hz)
   - Segmenting the data into overlapping windows (1024 points with 768 overlap)
   - Normalizing the data
3. The model performs inference on each segment
4. Results are aggregated to provide an overall classification

### Input File Format

The model accepts two types of input files:
1. **TXT files**: In Bern-Barcelona dataset format - two-channel EEG data with comma-separated values:
   ```
   value_ch1, value_ch2
   value_ch1, value_ch2
   ...
   ```
   See the reference files in the `Data_F_50` directory for examples of the format.

2. **EDF files**: Standard EEG format, the first two channels will be used

## Python Dependencies

The model requires:
- tensorflow
- numpy
- scipy
- pandas
- mne
- scikit-learn

## Performance

The model achieves:
- Accuracy: ~92%
- Precision: ~89%
- Recall: ~94% 
- F1 Score: ~91%

## References

This model is trained on the Bern-Barcelona EEG dataset:
- R. Andrzejak, K. Schindler, C. Rummel. "Nonrandomness, nonlinear dependence, and nonstationarity of electroencephalographic recordings from epilepsy patients." Physical Review E, 2012. 