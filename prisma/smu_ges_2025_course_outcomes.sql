-- SMU GES 2025 CourseOutcome inserts.
-- Source: C:\Users\USER\Downloads\Annex B_Web Publication SMU GES 2025.pdf
-- Source type stored below: SMU GES 2025 PDF
--
-- Mapping rule used:
-- - Mapped only to existing SMU course rows from courses.csv.
-- - Used the overall course row, not the "Cum Laude and above" subrow.
-- - career_prospects_score is intentionally NULL.
-- - Salary/rate fields are NULL where the PDF shows N.A. or withholds data.
--
-- Not inserted because the PDF does not provide a standalone matching row:
-- - course_id 72, Integrative Studies: no PDF row found.
-- - course_id 74, Politics, Law & Economics: no PDF row found.
-- - course_id 76, Software Engineering: no PDF row found.

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
  -- Accountancy
  (66, 4350.00, 4350.00, 94.40, 91.40, NULL, 2025, 'SMU GES 2025 PDF'),

  -- Business Management
  (67, 4500.00, 4600.00, 84.80, 75.90, NULL, 2025, 'SMU GES 2025 PDF'),

  -- Computer Science
  (68, 6000.00, 6000.00, 85.00, 83.30, NULL, 2025, 'SMU GES 2025 PDF'),

  -- Computing & Law
  (69, 5000.00, 5000.00, 81.00, 76.20, NULL, 2025, 'SMU GES 2025 PDF'),

  -- Economics
  (70, 4400.00, 4500.00, 82.90, 76.20, NULL, 2025, 'SMU GES 2025 PDF'),

  -- Information Systems
  (71, 5000.00, 5400.00, 90.50, 83.40, NULL, 2025, 'SMU GES 2025 PDF'),

  -- Law; PDF shows N.A. because Class of 2024 Law graduates will be surveyed
  -- in JAUGES 2026.
  (73, NULL, NULL, NULL, NULL, NULL, 2025, 'SMU GES 2025 PDF'),

  -- Social Sciences
  (75, 4000.00, 4000.00, 86.00, 74.40, NULL, 2025, 'SMU GES 2025 PDF')
ON CONFLICT (course_id, source_year) DO UPDATE SET
  basic_monthly_median = EXCLUDED.basic_monthly_median,
  gross_monthly_median = EXCLUDED.gross_monthly_median,
  employment_rate_overall = EXCLUDED.employment_rate_overall,
  employment_rate_ft_perm = EXCLUDED.employment_rate_ft_perm,
  career_prospects_score = EXCLUDED.career_prospects_score,
  source_type = EXCLUDED.source_type;
