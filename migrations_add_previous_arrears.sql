ALTER TABLE apartments
  ADD COLUMN previous_arrears DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER finish_status;
