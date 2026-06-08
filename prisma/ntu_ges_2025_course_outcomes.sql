-- NTU GES 2025 CourseOutcome inserts.
-- Source: C:\Users\USER\Downloads\Web Publication NTU GES 2025.pdf
-- Source type stored below: NTU GES 2025 PDF
--
-- Mapping rule used:
-- - Mapped only to existing NTU course rows from courses.csv.
-- - Used the default/non-specialisation course where there is a clean match.
-- - career_prospects_score is intentionally NULL.
-- - Salary/rate fields are NULL where the PDF shows N.A. or withholds salary data.
--
-- Not inserted because the PDF does not provide a single clean matching row for
-- the existing default course row, or the row is an aggregate/double-degree:
-- - course_id 26, Applied Computing in Finance: no PDF row found.
-- - course_id 30, Artificial Intelligence and Society: no PDF row found.
-- - course_id 37, Chinese Medicine: only appears inside the Biomedical Sciences
--   aggregate note, not as a standalone row.
-- - course_id 45, Economics and Data Science: only appears inside the
--   Interdisciplinary Double / Integrated Major aggregate note.
-- - course_id 59, Philosophy, Politics, and Economics: no PDF row found.
-- - course_id 63, Robotics: no PDF row found.
-- - Accountancy and Business, Double Degree in Business and Computer
--   Engineering/Computing, Double Degree in Engineering / Computer Science and
--   Economics, Interdisciplinary Double / Integrated Major, Interdisciplinary
--   Double Major, NIE Arts/Science: aggregate/double-degree rows without a clean
--   default course row mapping in courses.csv.

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
  (23, 4350.00, 4350.00, 92.30, 88.50, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Aerospace Engineering
  (25, 4500.00, 4640.00, 71.10, 62.90, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Art, Design and Media (Design Art): PDF row is Art, Design and Media
  (28, 3350.00, 3350.00, 69.70, 34.80, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Bioengineering
  (31, 4000.00, 4300.00, 74.20, 62.90, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Biological Sciences
  (32, 4000.00, 4000.00, 83.90, 69.40, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Business
  (33, 4354.00, 4500.00, 85.60, 71.80, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Chemical and Biomolecular Engineering
  (34, 4200.00, 4400.00, 78.00, 69.10, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Chemistry and Biological Chemistry
  (35, 4000.00, 4200.00, 72.80, 64.80, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Chinese
  (36, 4140.00, 4345.00, 89.80, 73.50, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Civil Engineering
  (38, 4190.00, 4200.00, 86.70, 79.60, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Communication Studies
  (39, 4000.00, 4000.00, 83.60, 55.70, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Computer Engineering
  (40, 5000.00, 5150.00, 83.10, 75.40, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Computer Science
  (41, 5400.00, 5500.00, 85.10, 79.70, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Data Science and Artificial Intelligence
  (43, 5250.00, 5250.00, 81.00, 75.90, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Economics
  (44, 4500.00, 4621.00, 86.20, 78.50, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Electrical and Electronic Engineering
  (46, 4640.00, 4800.00, 83.30, 75.80, NULL, 2025, 'NTU GES 2025 PDF'),

  -- English
  (47, 4000.00, 4100.00, 70.60, 51.50, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Environmental Earth Systems Science
  (48, 4300.00, 4350.00, 90.00, 76.70, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Environmental Engineering
  (49, 4000.00, 4200.00, 73.70, 63.20, NULL, 2025, 'NTU GES 2025 PDF'),

  -- History
  (50, 4500.00, 4583.00, 75.00, 52.30, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Information Engineering and Media
  (51, 4900.00, 4950.00, 66.70, 59.60, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Linguistics and Multilingual Studies
  (52, 3800.00, 3950.00, 69.80, 47.20, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Maritime Studies
  (53, 4200.00, 4200.00, 86.40, 80.70, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Materials Engineering
  (54, 4640.00, 4700.00, 78.40, 72.00, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Mathematical Sciences
  (55, 4500.00, 4680.00, 69.90, 64.40, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Mechanical Engineering
  (56, 4400.00, 4500.00, 79.50, 73.30, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Medicine
  (57, 5050.00, 6500.00, 100.00, 100.00, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Philosophy
  (58, 4050.00, 4390.00, 75.00, 62.50, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Physics / Applied Physics: PDF row is Physics and Applied Physics
  (60, 4600.00, 4600.00, 71.90, 56.30, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Psychology
  (61, 4000.00, 4065.00, 77.80, 58.60, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Public Policy and Global Affairs
  (62, 4698.00, 4880.00, 77.40, 71.00, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Sociology
  (64, 4225.00, 4500.00, 75.90, 64.80, NULL, 2025, 'NTU GES 2025 PDF'),

  -- Sport Science and Management: PDF row is Sports Science and Management
  (65, 3975.00, 4100.00, 85.40, 66.70, NULL, 2025, 'NTU GES 2025 PDF')
ON CONFLICT (course_id, source_year) DO UPDATE SET
  basic_monthly_median = EXCLUDED.basic_monthly_median,
  gross_monthly_median = EXCLUDED.gross_monthly_median,
  employment_rate_overall = EXCLUDED.employment_rate_overall,
  employment_rate_ft_perm = EXCLUDED.employment_rate_ft_perm,
  career_prospects_score = EXCLUDED.career_prospects_score,
  source_type = EXCLUDED.source_type;
