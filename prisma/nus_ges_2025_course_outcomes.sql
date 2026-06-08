-- NUS GES 2025 CourseOutcome inserts.
-- Source: C:\Users\USER\Downloads\Web Publication NUS GES 2025.pdf
-- Source type stored below: NUS GES 2025 PDF
--
-- Mapping rule used:
-- - Mapped only to existing NUS course rows from courses.csv.
-- - Used the default/non-specialisation course where there is a clean match.
-- - career_prospects_score is intentionally NULL.
-- - Salary/rate fields are NULL where the PDF shows N.A. or withholds salary data.
--
-- Not inserted because the PDF does not provide a single clean aggregate for the
-- existing default course row:
-- - course_id 9, Engineering: PDF gives multiple Engineering specialisations.
-- - course_id 12, Humanities & Sciences: PDF gives multiple Arts/Science/Social
--   Sciences/Yale-NUS rows, but no single "Humanities & Sciences" aggregate.
-- - course_id 7, Data Science & Economics: PDF gives Data Science and Analytics,
--   which is a different course name.
-- - course_id 4, Business Artificial Intelligence Systems: no PDF row found.
-- - course_id 11, Food Science & Technology: no PDF row found.
-- - course_id 20, Pharmaceutical Science: no PDF row found.
-- - course_id 22, Philosophy, Politics and Economics (PPE): no PDF row found.

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
  -- Architecture: Bachelor of Arts (Architecture)
  (1, 4600.00, 4600.00, 98.40, 96.80, NULL, 2025, 'NUS GES 2025 PDF'),

  -- Business Administration: Bachelor of Business Administration
  (2, 6000.00, 6000.00, 95.00, 82.50, NULL, 2025, 'NUS GES 2025 PDF'),

  -- Business Analytics: Bachelor of Science (Business Analytics)
  (3, 5500.00, 5700.00, 91.70, 85.70, NULL, 2025, 'NUS GES 2025 PDF'),

  -- Computer Science: Bachelor of Computing (Computer Science)
  (5, 6250.00, 6400.00, 87.30, 84.10, NULL, 2025, 'NUS GES 2025 PDF'),

  -- Computer Engineering: Bachelor of Engineering (Computer Engineering)
  (6, 5500.00, 5600.00, 84.60, 78.50, NULL, 2025, 'NUS GES 2025 PDF'),

  -- Dentistry: Bachelor of Dental Surgery
  (8, 4550.00, 4550.00, 100.00, 100.00, NULL, 2025, 'NUS GES 2025 PDF'),

  -- Environmental Studies: Bachelor of Environmental Studies
  (10, 4225.00, 4500.00, 92.00, 72.00, NULL, 2025, 'NUS GES 2025 PDF'),

  -- Industrial Design: Bachelor of Arts (Industrial Design)
  (13, 3900.00, 4050.00, 78.60, 47.60, NULL, 2025, 'NUS GES 2025 PDF'),

  -- Information Security: Bachelor of Computing (Information Security)
  (14, 5500.00, 6000.00, 88.00, 84.00, NULL, 2025, 'NUS GES 2025 PDF'),

  -- Landscape Architecture: Bachelor of Landscape Architecture
  (15, 3800.00, 3800.00, 60.00, 40.00, NULL, 2025, 'NUS GES 2025 PDF'),

  -- Law: Bachelor of Laws; PDF shows N.A. because Class of 2024 Law graduates
  -- will be surveyed in JAUGES 2026.
  (16, NULL, NULL, NULL, NULL, NULL, 2025, 'NUS GES 2025 PDF'),

  -- Medicine: Bachelor of Medicine and Bachelor of Surgery
  (17, 5050.00, 6500.00, 100.00, 100.00, NULL, 2025, 'NUS GES 2025 PDF'),

  -- Music: Bachelor of Music; PDF withholds salary data due to fewer than
  -- 10 respondents in full-time permanent employment.
  (18, NULL, NULL, 72.70, 4.50, NULL, 2025, 'NUS GES 2025 PDF'),

  -- Nursing: Bachelor of Science (Nursing)
  (19, 3750.00, 4000.00, 92.10, 87.60, NULL, 2025, 'NUS GES 2025 PDF'),

  -- Pharmacy: Bachelor of Pharmacy (Hons)
  (21, 4200.00, 4475.00, 97.40, 97.40, NULL, 2025, 'NUS GES 2025 PDF')
ON CONFLICT (course_id, source_year) DO UPDATE SET
  basic_monthly_median = EXCLUDED.basic_monthly_median,
  gross_monthly_median = EXCLUDED.gross_monthly_median,
  employment_rate_overall = EXCLUDED.employment_rate_overall,
  employment_rate_ft_perm = EXCLUDED.employment_rate_ft_perm,
  career_prospects_score = EXCLUDED.career_prospects_score,
  source_type = EXCLUDED.source_type;
