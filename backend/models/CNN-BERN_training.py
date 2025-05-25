import os
import numpy as np
from sklearn.model_selection import train_test_split
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout, Conv1D, MaxPooling1D, Flatten, BatchNormalization, GaussianNoise
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
from tensorflow.keras.regularizers import l2
import matplotlib.pyplot as plt
from sklearn.metrics import accuracy_score, recall_score, precision_score, confusion_matrix, f1_score, roc_auc_score
from sklearn.preprocessing import StandardScaler

# Function to load data from directory with time series segmentation
def load_data_from_directory(directory_path, label, segment_length=1024, overlap=512):
    data_segments = []
    labels = []

    # Check if the directory exists
    if not os.path.exists(directory_path):
        print(f"Error: Directory {directory_path} not found.")
        return np.array([]), np.array([])

    # List all files in the directory
    files = [f for f in os.listdir(directory_path) if f.lower().endswith('.txt')]

    if len(files) == 0:
        print(f"No .txt files found in {directory_path}.")
        return np.array([]), np.array([])

    print(f"Processing {len(files)} files from {directory_path}...")

    for filename in files:
        file_path = os.path.join(directory_path, filename)
        try:
            # Load the file data
            file_data = np.loadtxt(file_path, delimiter=',')

            # Extract the two channels
            channel_1 = file_data[:, 0]
            channel_2 = file_data[:, 1]

            # Create segments with overlap
            for i in range(0, len(channel_1) - segment_length + 1, segment_length - overlap):
                # Create a segment with both channels side by side
                segment = np.column_stack((
                    channel_1[i:i+segment_length],
                    channel_2[i:i+segment_length]
                ))

                # Only add complete segments
                if segment.shape[0] == segment_length:
                    data_segments.append(segment)
                    labels.append(label)

        except Exception as e:
            print(f"Error loading {filename}: {e}")

    return np.array(data_segments), np.array(labels)

# Function to add noise to data for augmentation
def augment_with_noise(X, y, noise_level=0.05):
    # Add Gaussian noise to create augmented samples
    noise = np.random.normal(0, noise_level, X.shape)
    X_augmented = X + noise
    return np.vstack([X, X_augmented]), np.hstack([y, y])

# Paths to your datasets
path_Z = '/content/drive/MyDrive/Colab Notebooks/ANN/Data_F_Ind_1_750.zip (Unzipped Files)'  # Focal
path_S = '/content/drive/MyDrive/Colab Notebooks/ANN/Data_N_Ind_1_750.zip (Unzipped Files)'  # Non-Focal

# Set parameters for data segmentation
SEGMENT_LENGTH = 1024  # 1024 time points per segment
OVERLAP = 768         # 75% overlap for more segments

# Load and segment data
print("Loading data...")
data_F, labels_F = load_data_from_directory(path_Z, label=0, segment_length=SEGMENT_LENGTH, overlap=OVERLAP)
data_N, labels_N = load_data_from_directory(path_S, label=1, segment_length=SEGMENT_LENGTH, overlap=OVERLAP)

# Combine data and labels
if data_F.size > 0 and data_N.size > 0:
    print(f"Focal segments: {data_F.shape}")
    print(f"Non-Focal segments: {data_N.shape}")

    # Combine data
    X = np.concatenate((data_F, data_N), axis=0)
    y = np.concatenate((labels_F, labels_N), axis=0)

    print(f"Total dataset: {X.shape}")
    print(f"Class distribution - Focal: {np.sum(y == 0)}, Non-Focal: {np.sum(y == 1)}")

    # Split into train/val/test sets with stratification
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.3, random_state=42, stratify=y
    )

    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp
    )

    # Augment training data only
    X_train, y_train = augment_with_noise(X_train, y_train, noise_level=0.03)

    print(f"Training set after augmentation: {X_train.shape}")
    print(f"Validation set: {X_val.shape}")
    print(f"Test set: {X_test.shape}")

    # Define callbacks for training
    early_stopping = EarlyStopping(
        monitor='val_loss',
        patience=20,
        restore_best_weights=True,
        verbose=1
    )

    reduce_lr = ReduceLROnPlateau(
        monitor='val_loss',
        factor=0.2,
        patience=8,
        min_lr=0.0001,
        verbose=1
    )

    # Build improved CNN model with regularization
    model = Sequential([
        # Add noise layer for robustness during training
        GaussianNoise(0.01, input_shape=(SEGMENT_LENGTH, 2)),

        # First convolutional layer
        Conv1D(filters=32, kernel_size=32, activation='relu',
               kernel_regularizer=l2(0.001), padding='same'),
        BatchNormalization(),
        MaxPooling1D(pool_size=4),
        Dropout(0.3),

        # Second convolutional layer
        Conv1D(filters=64, kernel_size=16, activation='relu',
               kernel_regularizer=l2(0.001), padding='same'),
        BatchNormalization(),
        MaxPooling1D(pool_size=4),
        Dropout(0.4),

        # Third convolutional layer
        Conv1D(filters=128, kernel_size=8, activation='relu',
               kernel_regularizer=l2(0.001), padding='same'),
        BatchNormalization(),
        MaxPooling1D(pool_size=2),
        Dropout(0.5),

        # Flatten layer
        Flatten(),

        # Fully connected layers
        Dense(64, activation='relu', kernel_regularizer=l2(0.001)),
        BatchNormalization(),
        Dropout(0.5),

        # Output layer
        Dense(1, activation='sigmoid')
    ])

    # Compile the model with lower learning rate
    model.compile(
        optimizer=Adam(learning_rate=0.0003),
        loss='binary_crossentropy',
        metrics=['accuracy']
    )

    # Print model summary
    model.summary()

    # Train the model with separate validation set
    history = model.fit(
        X_train, y_train,
        epochs=100,  # More epochs with early stopping
        batch_size=16,  # Smaller batch size
        validation_data=(X_val, y_val),
        callbacks=[early_stopping, reduce_lr],
        verbose=1
    )

    # Evaluate on test set (data not seen during training or validation)
    y_pred_prob = model.predict(X_test)
    y_pred = (y_pred_prob > 0.5).astype(int)

    # Compute metrics
    accuracy = accuracy_score(y_test, y_pred)
    recall = recall_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_pred_prob)
    conf_matrix = confusion_matrix(y_test, y_pred)

    # Specificity calculation
    tn, fp, fn, tp = conf_matrix.ravel()
    specificity = tn / (tn + fp)

    # Print metrics
    print("\nFinal Evaluation Metrics:")
    print(f"Test Accuracy: {accuracy:.4f}")
    print(f"Test ROC-AUC: {auc:.4f}")
    print(f"Test Recall (Sensitivity): {recall:.4f}")
    print(f"Test Precision: {precision:.4f}")
    print(f"Test F1 Score: {f1:.4f}")
    print(f"Test Specificity: {specificity:.4f}")
    print(f"Confusion Matrix:\n{conf_matrix}")

    # Save the trained model
    model.save('eeg_classifier_model5.h5')
    print("\nModel saved as 'eeg_classifier_model.h5'")

    # Plot training history
    plt.figure(figsize=(12, 4))

    plt.subplot(1, 2, 1)
    plt.plot(history.history['accuracy'], label='Training Accuracy')
    plt.plot(history.history['val_accuracy'], label='Validation Accuracy')
    plt.title('Model Accuracy')
    plt.xlabel('Epoch')
    plt.ylabel('Accuracy')
    plt.legend()

    plt.subplot(1, 2, 2)
    plt.plot(history.history['loss'], label='Training Loss')
    plt.plot(history.history['val_loss'], label='Validation Loss')
    plt.title('Model Loss')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.legend()

    plt.tight_layout()
    plt.show()

else:
    print("Error: Data loading failed. Ensure the files are present and correctly formatted.")