USE medibook;

INSERT INTO patients (id, full_name, email, phone) VALUES
  (1, 'Ama Mensah', 'ama@mail.com',  '0244-111-222'),
  (2, 'Kojo Owusu', 'kojo@mail.com', '0555-333-444'),
  (3, 'Esi Quaye',  'esi@mail.com',  '0201-555-666'),
  (4, 'Yaw Darko',  'yaw@mail.com',  '0277-888-999');

INSERT INTO doctors (id, full_name, specialty, consultation_fee, room) VALUES
  (1, 'Dr. Boateng',   'Dermatology',      150.00, 'R-12'),
  (2, 'Dr. Adjei',     'Paediatrics',      100.00, 'R-03'),
  (3, 'Dr. Asante',    'Cardiology',       200.00, 'R-07'),
  (4, 'Dr. Frimpong',  'General Practice',  80.00, 'R-01'); -- no appointments

-- Dr. Boateng, 2027-01-11: 11 booked slots (09:00-14:00)
INSERT INTO appointments (patient_id, doctor_id, appt_datetime, status, amount_paid, booked_at) VALUES
  (1, 1, '2027-01-11 09:00:00', 'booked', 150.00, '2027-01-02 08:00:00'),
  (2, 1, '2027-01-11 09:30:00', 'booked', 120.00, '2027-01-02 08:10:00'),
  (3, 1, '2027-01-11 10:00:00', 'booked', 150.00, '2027-01-02 08:20:00'),
  (4, 1, '2027-01-11 10:30:00', 'booked', 150.00, '2027-01-02 08:30:00'),
  (1, 1, '2027-01-11 11:00:00', 'booked', 150.00, '2027-01-02 08:40:00'),
  (2, 1, '2027-01-11 11:30:00', 'booked', 150.00, '2027-01-02 08:50:00'),
  (3, 1, '2027-01-11 12:00:00', 'booked', 150.00, '2027-01-02 09:00:00'),
  (4, 1, '2027-01-11 12:30:00', 'booked', 150.00, '2027-01-02 09:10:00'),
  (1, 1, '2027-01-11 13:00:00', 'booked', 150.00, '2027-01-02 09:20:00'),
  (2, 1, '2027-01-11 13:30:00', 'booked', 150.00, '2027-01-02 09:30:00'),
  (3, 1, '2027-01-11 14:00:00', 'booked', 150.00, '2027-01-02 09:40:00');

-- Other bookings
INSERT INTO appointments (patient_id, doctor_id, appt_datetime, status, amount_paid, booked_at) VALUES
  (1, 2, '2027-01-15 10:00:00', 'booked', 100.00, '2027-01-03 10:00:00'),
  (4, 2, '2027-01-15 10:30:00', 'booked',  90.00, '2027-01-03 11:00:00'),
  (2, 3, '2027-01-20 15:00:00', 'booked', 200.00, '2027-01-04 09:00:00');

-- Cancelled with refunds
INSERT INTO appointments (patient_id, doctor_id, appt_datetime, status, amount_paid, refund_amount, booked_at, cancelled_at) VALUES
  (3, 3, '2027-01-20 16:00:00', 'cancelled', 200.00, 200.00, '2027-01-04 09:30:00', '2027-01-10 14:00:00'),
  (4, 2, '2027-01-15 11:00:00', 'cancelled', 100.00,  50.00, '2027-01-03 12:00:00', '2027-01-14 08:00:00');

-- Rebooking of the cancelled Dr. Adjei 11:00 slot
INSERT INTO appointments (patient_id, doctor_id, appt_datetime, status, amount_paid, booked_at) VALUES
  (2, 2, '2027-01-15 11:00:00', 'booked', 100.00, '2027-01-14 09:00:00');
