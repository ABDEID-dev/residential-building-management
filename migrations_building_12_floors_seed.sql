ALTER TABLE apartments
  ADD COLUMN floor_number INT UNSIGNED NULL AFTER apartment_number,
  ADD COLUMN unit_number INT UNSIGNED NULL AFTER floor_number;

ALTER TABLE apartments
  ADD COLUMN previous_arrears DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER finish_status;

UPDATE apartments
SET floor_number = FLOOR((apartment_number - 1) / 4) + 1,
    unit_number = ((apartment_number - 1) % 4) + 1
WHERE floor_number IS NULL OR unit_number IS NULL;

INSERT IGNORE INTO users (role, username, password_hash, is_active)
SELECT 'resident', CONCAT('apt', n), '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 1
FROM (
  SELECT 41 n UNION SELECT 42 UNION SELECT 43 UNION SELECT 44 UNION
  SELECT 45 UNION SELECT 46 UNION SELECT 47 UNION SELECT 48
) numbers;

INSERT IGNORE INTO apartments (apartment_number, floor_number, unit_number, user_id, resident_name, phone, occupancy, finish_status, previous_arrears, notes)
SELECT
  CAST(SUBSTRING(username, 4) AS UNSIGNED),
  FLOOR((CAST(SUBSTRING(username, 4) AS UNSIGNED) - 1) / 4) + 1,
  ((CAST(SUBSTRING(username, 4) AS UNSIGNED) - 1) % 4) + 1,
  id,
  CONCAT('الساكن رقم ', CAST(SUBSTRING(username, 4) AS UNSIGNED)),
  CONCAT('01010530', LPAD(198 + CAST(SUBSTRING(username, 4) AS UNSIGNED), 3, '0')),
  CASE WHEN CAST(SUBSTRING(username, 4) AS UNSIGNED) <= 10 THEN 'tenant' ELSE 'owner' END,
  CASE WHEN CAST(SUBSTRING(username, 4) AS UNSIGNED) <= 21 THEN 'finished' ELSE 'unfinished' END,
  0,
  ''
FROM users
WHERE role = 'resident' AND CAST(SUBSTRING(username, 4) AS UNSIGNED) BETWEEN 41 AND 48;

UPDATE apartments
SET resident_name = CASE apartment_number
  WHEN 1 THEN 'الأستاذ محمد أحمد'
  WHEN 2 THEN 'الدكتور خالد إبراهيم'
  WHEN 3 THEN 'الأستاذة هالة ثروت'
  ELSE IF(resident_name = '' OR resident_name IS NULL, CONCAT('الساكن رقم ', apartment_number), resident_name)
END,
phone = IF(phone = '' OR phone IS NULL, CONCAT('01010530', LPAD(198 + apartment_number, 3, '0')), phone),
occupancy = CASE WHEN apartment_number <= 10 THEN 'tenant' ELSE 'owner' END,
finish_status = CASE WHEN apartment_number <= 21 THEN 'finished' ELSE 'unfinished' END
WHERE apartment_number BETWEEN 1 AND 48;
