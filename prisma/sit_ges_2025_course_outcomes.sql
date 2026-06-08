-- SIT GES 2025 CourseOutcome inserts.
-- Source: C:\Users\USER\Downloads\Web Publication SIT GES 2025 (1).pdf
-- Source type stored below: SIT GES 2025 PDF
--
-- Mapping rule used:
-- - Mapped only to existing SIT course rows from courses.csv.
-- - Used the default/non-specialisation course where there is a clean match.
-- - career_prospects_score is intentionally NULL.
-- - Salary/rate fields are NULL where the PDF shows N.A. or withholds salary data.
--
-- Not inserted because the PDF does not provide a clean standalone matching row,
-- or the row is shared across specialisations with no default course row:
-- - course_id 83, Aircraft Systems Engineering: no PDF row found.
-- - course_id 85, Applied Computing (Fintech): no PDF row found.
-- - course_id 86, Applied Computing Degree (via CSM Pathway): no PDF row found.
-- - course_id 88, Business and Infocomm Technology: no PDF row found.
-- - course_id 102, Electrical and Electronic Engineering: no PDF row found.
-- - course_id 105, Engineering Systems: no PDF row found.
-- - course_id 106 & 107, Pastry Arts and Culinary Arts both mapped to Food Business Management
-- - course_id 114, Integrated Studies in Technology and Management with
--   Specialisation in Supply Chain: no PDF row found.
-- - course_id 119, Nursing (Pre-registration and Specialty Training): no PDF row found.
-- - course_id 123, Radiation Therapy: no PDF row found.

INSERT INTO course_outcomes (
  course_id,
  basic_monthly_median,
  gross_monthly_median,
  employment_rate_overall,
  employment_rate_ft_perm,
  career_prospects_score,
  source_year,
  source_type
)
VALUES
  -- Accountancy: Bachelor of Accountancy with Honours
  (82, 4350.00, 4350.00, 96.00, 87.30, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Applied Artificial Intelligence
  (84, 4500.00, 4550.00, 62.90, 57.10, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Aviation Management: PDF row is Air Transport Management
  (87, 3800.00, 4100.00, 71.10, 60.00, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Chemical Engineering
  (89, 4000.00, 4250.00, 79.30, 75.90, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Civil Engineering
  (90, 4125.00, 4200.00, 81.60, 75.00, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Communication and Digital Media: PDF row is Digital Communications and Integrated Media
  (92, 3600.00, 3675.00, 81.60, 69.40, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Computer Engineering
  (93, 4500.00, 4534.00, 70.80, 64.60, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Computer Science in Interactive Media and Game Development
  (94, 4510.00, 4560.00, 65.10, 51.20, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Computer Science in Real-Time Interactive Simulation
  (95, 4900.00, 5000.00, 90.30, 83.90, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Computing Science
  (96, 5000.00, 5000.00, 68.30, 65.30, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Diagnostic Radiography
  (97, 3900.00, 4000.00, 96.20, 92.40, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Dietetics and Nutrition
  (98, 4000.00, 4000.00, 96.00, 92.00, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Digital Art and Animation; PDF withholds salary data.
  (99, NULL, NULL, 66.70, 44.40, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Digital Supply Chain
  (100, 4000.00, 4080.00, 90.90, 84.80, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Electrical Power Engineering
  (101, 4100.00, 4250.00, 77.50, 73.20, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Electronics and Data Engineering
  (104, 4400.00, 4700.00, 82.50, 77.50, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Food Business Management (Baking and Pastry Arts)
  (106, 3000.00, 3500.00, 90.90, 63.60, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Food Business Management (Culinary Arts)
  (107, 3000.00, 3500.00, 90.90, 63.60, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Food Technology
  (108, 3500.00, 3600.00, 85.70, 55.10, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Hospitality and Tourism Management: PDF row is Hospitality Business
  (109, 3500.00, 3500.00, 84.80, 70.70, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Information and Communications Technology (Information Security)
  (110, 5000.00, 5000.00, 82.10, 74.70, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Information and Communications Technology (Software Engineering)
  (111, 5000.00, 5000.00, 80.90, 76.50, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Infrastructure and Systems Engineering: PDF row is Sustainable Infrastructure Engineering (Land)
  (112, 4225.00, 4550.00, 77.60, 65.30, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Mechanical Design and Manufacturing Engineering
  (115, 4200.00, 4200.00, 78.70, 72.30, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Mechanical Engineering
  (116, 4183.00, 4200.00, 83.30, 75.00, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Naval Architecture and Marine Engineering
  (117, 4150.00, 4700.00, 79.50, 77.30, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Nursing
  (118, 3900.00, 4163.00, 92.50, 75.50, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Occupational Therapy
  (120, 3850.00, 3925.00, 98.00, 98.00, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Pharmaceutical Engineering
  (121, 3975.00, 4500.00, 95.20, 92.10, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Physiotherapy
  (122, 4020.00, 4110.00, 100.00, 99.00, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Robotics Systems
  (124, 4500.00, 4650.00, 76.00, 72.00, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Speech and Language Therapy
  (125, 3900.00, 3900.00, 100.00, 95.50, NULL, 2025, 'SIT GES 2025 PDF'),

  -- Sustainable Built Environment: PDF row is Sustainable Infrastructure Engineering (Building Services)
  (126, 4000.00, 4000.00, 84.30, 80.40, NULL, 2025, 'SIT GES 2025 PDF'),

  -- User Experience and Game Design
  (127, 3550.00, 3600.00, 72.50, 50.00, NULL, 2025, 'SIT GES 2025 PDF')
ON CONFLICT (course_id, source_year) DO UPDATE SET
  basic_monthly_median = EXCLUDED.basic_monthly_median,
  gross_monthly_median = EXCLUDED.gross_monthly_median,
  employment_rate_overall = EXCLUDED.employment_rate_overall,
  employment_rate_ft_perm = EXCLUDED.employment_rate_ft_perm,
  career_prospects_score = EXCLUDED.career_prospects_score,
  source_type = EXCLUDED.source_type;
