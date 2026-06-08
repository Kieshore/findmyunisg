-- SUSS GES 2025 CourseOutcome inserts.
-- Source: C:\Users\USER\Downloads\Web Publication SUSS GES 2025.pdf
-- Source type stored below: SUSS GES 2025 PDF
--
-- Mapping rule used:
-- - Mapped only to existing SUSS course rows from courses.csv.
-- - Used the default/non-specialisation course where there is a clean match.
-- - career_prospects_score is intentionally NULL.
-- - Salary/rate fields are NULL where the PDF shows N.A. or withholds data.
--
-- Not inserted because the PDF does not provide a standalone matching row:
-- - course_id 129, Bachelor of Arts in Chinese Studies: no PDF row found.
-- - course_id 135, Bachelor of Science in Information and Communication Technology: no PDF row found.
-- - course_id 137, Bachelor of Science in Psychology: no PDF row found.
-- - Bachelor of Laws (LLB): PDF row shows N.A., but there is no matching course row
--   in courses.csv.

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
  -- Bachelor of Accountancy
  (128, 4350.00, 4350.00, 87.50, 85.90, NULL, 2025, 'SUSS GES 2025 PDF'),

  -- Bachelor of Early Childhood Education
  (130, 3700.00, 3800.00, 97.90, 93.80, NULL, 2025, 'SUSS GES 2025 PDF'),

  -- Bachelor of Human Resource Management
  (131, 4000.00, 4000.00, 85.20, 72.80, NULL, 2025, 'SUSS GES 2025 PDF'),

  -- Bachelor of Public Safety and Security
  (132, 4215.00, 5000.00, 87.80, 69.40, NULL, 2025, 'SUSS GES 2025 PDF'),

  -- Bachelor of Science in Business Analytics
  (133, 4600.00, 4800.00, 80.30, 69.70, NULL, 2025, 'SUSS GES 2025 PDF'),

  -- Bachelor of Science in Finance
  (134, 4325.00, 4400.00, 83.80, 64.90, NULL, 2025, 'SUSS GES 2025 PDF'),

  -- Bachelor of Science in Marketing
  (136, 3600.00, 3715.00, 77.40, 56.20, NULL, 2025, 'SUSS GES 2025 PDF'),

  -- Bachelor of Science in Supply Chain Management
  (138, 3800.00, 4000.00, 72.10, 63.20, NULL, 2025, 'SUSS GES 2025 PDF'),

  -- Bachelor of Social Work
  (139, 3950.00, 3950.00, 88.60, 82.30, NULL, 2025, 'SUSS GES 2025 PDF')
ON CONFLICT (course_id, source_year) DO UPDATE SET
  basic_monthly_median = EXCLUDED.basic_monthly_median,
  gross_monthly_median = EXCLUDED.gross_monthly_median,
  employment_rate_overall = EXCLUDED.employment_rate_overall,
  employment_rate_ft_perm = EXCLUDED.employment_rate_ft_perm,
  career_prospects_score = EXCLUDED.career_prospects_score,
  source_type = EXCLUDED.source_type;
