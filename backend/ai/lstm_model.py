# backend/ai/lstm_model.py
"""
LSTM Occupancy Prediction Model — ParkSmart AI
Phase 2 implementation.

Run training:
  cd backend
  python -m ai.lstm_model --area_id PA001 --days 90

Requirements (install when ready for Phase 2):
  pip install tensorflow numpy pandas scikit-learn
"""

import os
import json
from datetime import datetime, timedelta
from typing import List, Tuple, Optional


# ── Model Architecture ────────────────────────────────────────────────────────

def build_lstm_model(sequence_len: int = 168, n_features: int = 5):
    """
    Builds LSTM model for occupancy forecasting.

    Input shape : (batch, sequence_len=168, n_features=5)
                  168 = 7 days × 24 hours
    Output shape: (batch, 24)  — 24 hourly occupancy % predictions

    Features per timestep:
      0: hour_sin        — cyclical hour encoding sin(2π×h/24)
      1: hour_cos        — cyclical hour encoding cos(2π×h/24)
      2: day_of_week_sin — cyclical day encoding sin(2π×d/7)
      3: day_of_week_cos — cyclical day encoding cos(2π×d/7)
      4: occupancy_pct   — normalised occupancy (0.0–1.0)
    """
    try:
        import tensorflow as tf
        from tensorflow import keras

        model = keras.Sequential([
            keras.layers.Input(shape=(sequence_len, n_features)),

            # Encoder LSTM 1
            keras.layers.LSTM(128, return_sequences=True, dropout=0.2,
                              recurrent_dropout=0.1, name="lstm_1"),
            keras.layers.BatchNormalization(),

            # Encoder LSTM 2
            keras.layers.LSTM(64, return_sequences=False, dropout=0.2,
                              name="lstm_2"),
            keras.layers.BatchNormalization(),

            # Dense decoder
            keras.layers.Dense(64, activation="relu", name="dense_1"),
            keras.layers.Dropout(0.2),
            keras.layers.Dense(32, activation="relu", name="dense_2"),

            # Output: 24 hourly occupancy predictions (0–1)
            keras.layers.Dense(24, activation="sigmoid", name="output"),
        ], name="ParkSmart_LSTM")

        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss="mse",
            metrics=["mae"],
        )
        return model

    except ImportError:
        print("[LSTM] TensorFlow not installed. Run: pip install tensorflow")
        return None


# ── Feature Engineering ───────────────────────────────────────────────────────

def build_feature_vector(
    hourly_occupancy: List[float],
    timestamps: List[datetime],
) -> List[List[float]]:
    """
    Converts raw occupancy data into normalised feature vectors.

    Args:
        hourly_occupancy: list of occupancy % values (0–100)
        timestamps:       corresponding datetime for each value

    Returns:
        List of feature vectors [hour_sin, hour_cos, dow_sin, dow_cos, occ_norm]
    """
    import math
    vectors = []
    for occ, ts in zip(hourly_occupancy, timestamps):
        h   = ts.hour
        d   = ts.weekday()
        vec = [
            math.sin(2 * math.pi * h / 24),
            math.cos(2 * math.pi * h / 24),
            math.sin(2 * math.pi * d / 7),
            math.cos(2 * math.pi * d / 7),
            min(occ / 100.0, 1.0),   # normalise to 0–1
        ]
        vectors.append(vec)
    return vectors


# ── Data Preparation ──────────────────────────────────────────────────────────

def prepare_training_data(
    parking_area_id: str,
    days: int = 90,
    sequence_len: int = 168,
) -> Tuple[Optional[object], Optional[object]]:
    """
    Fetches booking history from Firestore and prepares X, y arrays for training.

    Returns:
        (X_train, y_train) numpy arrays, or (None, None) if insufficient data.
    """
    try:
        import numpy as np
        from api.services.ai_service import get_historical_occupancy
    except ImportError:
        print("[LSTM] numpy not installed. Run: pip install numpy")
        return None, None

    print(f"[LSTM] Fetching {days} days of data for area {parking_area_id}...")
    hist = get_historical_occupancy(parking_area_id, days=days)
    hourly_avg = hist["hourlyAverage"]

    # Replicate pattern across days to build sequence
    full_sequence  = hourly_avg * days
    base_date      = datetime.utcnow() - timedelta(days=days)
    timestamps     = [base_date + timedelta(hours=i) for i in range(len(full_sequence))]
    feature_vecs   = build_feature_vector(full_sequence, timestamps)

    X, y = [], []
    for i in range(len(feature_vecs) - sequence_len - 24):
        X.append(feature_vecs[i:i + sequence_len])
        y.append([v / 100.0 for v in full_sequence[i + sequence_len:i + sequence_len + 24]])

    if len(X) < 10:
        print(f"[LSTM] Insufficient data: only {len(X)} sequences. Need at least 10.")
        return None, None

    X_arr = np.array(X, dtype=np.float32)
    y_arr = np.array(y, dtype=np.float32)
    print(f"[LSTM] Prepared {len(X_arr)} training sequences. Shape: {X_arr.shape}")
    return X_arr, y_arr


# ── Training ───────────────────────────────────────────────────────────────────

def train_model(parking_area_id: str, days: int = 90, epochs: int = 50) -> str:
    """
    Trains LSTM model for a specific parking area.
    Saves model to: ai/models/{parking_area_id}.h5

    Returns: path to saved model file
    """
    X, y = prepare_training_data(parking_area_id, days=days)
    if X is None:
        raise RuntimeError("Not enough data to train model")

    model = build_lstm_model()
    if model is None:
        raise RuntimeError("TensorFlow not available")

    try:
        from tensorflow import keras
        callbacks = [
            keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True),
            keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=5, min_lr=1e-6),
        ]
        print(f"[LSTM] Training on {len(X)} samples for {epochs} epochs...")
        history = model.fit(
            X, y,
            epochs=epochs,
            batch_size=32,
            validation_split=0.15,
            callbacks=callbacks,
            verbose=1,
        )

        os.makedirs("ai/models", exist_ok=True)
        model_path = f"ai/models/{parking_area_id}.h5"
        model.save(model_path)
        print(f"[LSTM] Model saved to {model_path}")

        final_mae = history.history["val_mae"][-1]
        print(f"[LSTM] Final validation MAE: {final_mae:.4f} "
              f"(~{final_mae * 100:.1f}% occupancy error)")
        return model_path

    except Exception as e:
        raise RuntimeError(f"Training failed: {e}")


# ── Inference ─────────────────────────────────────────────────────────────────

def predict_next_24h(parking_area_id: str, recent_168h: List[float]) -> Optional[List[float]]:
    """
    Runs inference using a saved model.
    Returns list of 24 occupancy % predictions (0–100).

    Args:
        parking_area_id: used to load the correct saved model
        recent_168h:     last 168 hours of occupancy data (0–100 values)
    """
    model_path = f"ai/models/{parking_area_id}.h5"
    if not os.path.exists(model_path):
        print(f"[LSTM] No trained model found at {model_path}. Run training first.")
        return None

    try:
        import numpy as np
        from tensorflow import keras

        model      = keras.models.load_model(model_path)
        base_date  = datetime.utcnow() - timedelta(hours=168)
        timestamps = [base_date + timedelta(hours=i) for i in range(168)]
        features   = build_feature_vector(recent_168h, timestamps)
        X          = np.array([features], dtype=np.float32)   # shape (1, 168, 5)
        preds      = model.predict(X, verbose=0)[0]            # shape (24,)
        return [round(float(p) * 100, 1) for p in preds]

    except Exception as e:
        print(f"[LSTM] Inference error: {e}")
        return None


# ── CLI entry point ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="ParkSmart AI LSTM Trainer")
    parser.add_argument("--area_id", required=True, help="Parking area ID")
    parser.add_argument("--days",    type=int, default=90, help="Days of history to use")
    parser.add_argument("--epochs",  type=int, default=50, help="Training epochs")
    args = parser.parse_args()

    try:
        path = train_model(args.area_id, days=args.days, epochs=args.epochs)
        print(f"✅ Model trained and saved to {path}")
    except Exception as e:
        print(f"❌ Training failed: {e}")
