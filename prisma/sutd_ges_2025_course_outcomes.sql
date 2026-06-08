-- SUTD GES 2025 CourseOutcome inserts.
-- Source: C:\Users\USER\Downloads\Web Publication SUTD GES 2025.pdf
-- Source type stored below: SUTD GES 2025 PDF
--
-- Mapping rule used:
-- - Mapped only to existing SUTD course rows from courses.csv.
-- - Used the default/non-specialisation course where there is a clean match.
-- - career_prospects_score is intentionally NULL.
-- - Salary/rate fields are NULL where the PDF shows N.A. or withholds data.
--
-- All SUTD course rows in courses.csv had a clean matching PDF row.

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
  -- Architecture and Sustainable Design
  (77, 4465.00, 4490.00, 97.10, 91.40, NULL, 2025, 'SUTD GES 2025 PDF'),

  -- Computer Science and Design
  (78, 5000.00, 5000.00, 86.80, 76.90, NULL, 2025, 'SUTD GES 2025 PDF'),

  -- Design and Artificial Intelligence
  (79, 4850.00, 4925.00, 81.80, 63.60, NULL, 2025, 'SUTD GES 2025 PDF'),

  -- Engineering Product Development
  (80, 4900.00, 4965.00, 80.70, 71.90, NULL, 2025, 'SUTD GES 2025 PDF'),

  -- Engineering Systems and Design
  (81, 4525.00, 4900.00, 91.20, 73.70, NULL, 2025, 'SUTD GES 2025 PDF')
ON CONFLICT (course_id, source_year) DO UPDATE SET
  basic_monthly_median = EXCLUDED.basic_monthly_median,
  gross_monthly_median = EXCLUDED.gross_monthly_median,
  employment_rate_overall = EXCLUDED.employment_rate_overall,
  employment_rate_ft_perm = EXCLUDED.employment_rate_ft_perm,
  career_prospects_score = EXCLUDED.career_prospects_score,
  source_type = EXCLUDED.source_type;
