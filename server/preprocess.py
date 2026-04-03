# =========================
# STEP 1: IMPORT LIBRARIES
# =========================
import os
import pandas as pd
import numpy as np
import cv2
import pydicom
from tqdm import tqdm
import re
import sys

# =========================
# STEP 2: PATHS
# =========================
if len(sys.argv) != 4:
    print("Usage: python preprocess.py <data_path> <csv_path> <output_base>")
    sys.exit(1)

data_path = sys.argv[1]
csv_path = sys.argv[2]
output_base = sys.argv[3]

# =========================
# STEP 3: LOAD CSV
# =========================
df = pd.read_csv(csv_path)

# Keep only required columns
df = df[["ImageID", "Group"]]

# =========================
# STEP 4: CREATE OUTPUT FOLDERS
# =========================
classes = df["Group"].unique()

for c in classes:
    os.makedirs(os.path.join(output_base, c), exist_ok=True)

# =========================
# STEP 5: FIND ALL DICOM FILES
# =========================
dicom_files = []

for root, dirs, files in os.walk(data_path):
    for file in files:
        if file.endswith(".dcm"):
            dicom_files.append(os.path.join(root, file))

print("Total DICOM files found:", len(dicom_files))

# =========================
# STEP 6: CREATE IMAGEID → PATH MAP
# =========================
image_id_to_dicom_paths = {}

for path in dicom_files:
    filename = os.path.basename(path)

    # Extract ImageID (Ixxxx)
    match = re.search(r'(I\d+)\.dcm$', filename)
    if match:
        image_id = match.group(1)

        if image_id not in image_id_to_dicom_paths:
            image_id_to_dicom_paths[image_id] = []

        image_id_to_dicom_paths[image_id].append(path)

print("Mapped ImageIDs:", len(image_id_to_dicom_paths))

# =========================
# STEP 7: PREPROCESS FUNCTION
# =========================
def preprocess_dicom(path):
    ds = pydicom.dcmread(path)
    img = ds.pixel_array.astype(np.float32)

    # Normalize
    img = (img - np.min(img)) / (np.max(img) - np.min(img) + 1e-8)

    # Convert to 8-bit
    img = (img * 255).astype(np.uint8)

    # Skull stripping (simple)
    _, thresh = cv2.threshold(img, 30, 255, cv2.THRESH_BINARY)
    brain = cv2.bitwise_and(img, img, mask=thresh)

    # Resize
    brain = cv2.resize(brain, (128, 128))

    # Normalize again
    brain = brain / 255.0

    return brain

# =========================
# STEP 8: CREATE 3D NPY (FINAL)
# =========================
processed_count = 0

for _, row in tqdm(df.iterrows(), total=len(df)):
    image_id = str(row["ImageID"])
    group = str(row["Group"])

    if image_id in image_id_to_dicom_paths:
        dicom_paths = image_id_to_dicom_paths[image_id]

        slices = []

        for path in dicom_paths:
            try:
                ds = pydicom.dcmread(path)
                img = preprocess_dicom(path)

                # Use InstanceNumber for correct order
                instance_number = getattr(ds, "InstanceNumber", 0)
                slices.append((instance_number, img))

            except Exception as e:
                print(f"Error in {image_id}: {e}")

        if len(slices) > 0:

            # ✅ Sort slices properly
            slices.sort(key=lambda x: x[0])

            # Extract images
            processed_slices = [s[1] for s in slices]

            # ✅ Stack → 3D volume
            volume = np.stack(processed_slices, axis=0)

            # ✅ Save directly in class folder
            save_path = os.path.join(output_base, group, image_id + ".npy")
            np.save(save_path, volume)

            processed_count += 1

        else:
            print(f"No slices for {image_id}")

    else:
        print(f"{image_id} not found")

print("Total 3D volumes saved:", processed_count)