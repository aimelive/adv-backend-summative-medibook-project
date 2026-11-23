DROP DATABASE IF EXISTS medibook;
CREATE DATABASE medibook CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE medibook;

CREATE TABLE patients (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name  VARCHAR(100) NOT NULL,
  email      VARCHAR(150) NOT NULL,
  phone      VARCHAR(20)  NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_patients_email (email)
) ENGINE=InnoDB;

CREATE TABLE doctors (
  id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  full_name        VARCHAR(100)  NOT NULL,
  specialty        VARCHAR(100)  NOT NULL,
  consultation_fee DECIMAL(10,2) NOT NULL,
  room             VARCHAR(10)   NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT chk_doctors_fee CHECK (consultation_fee >= 0)
) ENGINE=InnoDB;

CREATE TABLE appointments (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  patient_id    INT UNSIGNED  NOT NULL,
  doctor_id     INT UNSIGNED  NOT NULL,
  appt_datetime DATETIME      NOT NULL,
  status        ENUM('booked','cancelled') NOT NULL DEFAULT 'booked',
  amount_paid   DECIMAL(10,2) NOT NULL,
  refund_amount DECIMAL(10,2) NULL,
  booked_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at  DATETIME      NULL,
  -- 1 while booked, NULL once cancelled (NULLs never collide in a UNIQUE index)
  active_slot   TINYINT GENERATED ALWAYS AS (IF(status = 'booked', 1, NULL)) STORED,
  PRIMARY KEY (id),
  -- no double booking; cancelled slots can be rebooked
  UNIQUE KEY uq_doctor_slot (doctor_id, appt_datetime, active_slot),
  KEY idx_appt_patient (patient_id),
  CONSTRAINT fk_appt_patient FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE RESTRICT,
  CONSTRAINT fk_appt_doctor  FOREIGN KEY (doctor_id)  REFERENCES doctors (id)  ON DELETE RESTRICT,
  CONSTRAINT chk_appt_minute  CHECK (MINUTE(appt_datetime) IN (0, 30)),
  CONSTRAINT chk_appt_second  CHECK (SECOND(appt_datetime) = 0),
  CONSTRAINT chk_appt_hours   CHECK (TIME(appt_datetime) BETWEEN '09:00:00' AND '16:30:00'),
  CONSTRAINT chk_appt_paid    CHECK (amount_paid >= 0),
  CONSTRAINT chk_appt_refund  CHECK (refund_amount IS NULL OR (refund_amount >= 0 AND refund_amount <= amount_paid))
) ENGINE=InnoDB;
