
-- Migration to add OCR fields to transactions table
ALTER TABLE transactions 
ADD COLUMN image_url TEXT,
ADD COLUMN ocr_text TEXT,
ADD COLUMN ocr_vendor VARCHAR(255),
ADD COLUMN ocr_detected_amount DECIMAL(12, 2),
ADD COLUMN ocr_detected_date TIMESTAMP;
