ALTER TABLE apartments
  ADD COLUMN finish_status ENUM('finished', 'unfinished') NOT NULL DEFAULT 'finished' AFTER occupancy;
