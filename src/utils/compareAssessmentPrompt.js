function isJcProfile(qualificationType) {
  const normalized = String(qualificationType || "").toLowerCase();

  return (
    normalized.includes("a-level") ||
    normalized.includes("a level") ||
    normalized.includes("jc") ||
    normalized.includes("junior college")
  );
}

function removeTravelFields(value) {
  if (Array.isArray(value)) {
    return value
      .filter(item => {
        if (typeof item !== "string") return true;
        return !/(postal|distance|travel|commute)/i.test(item);
      })
      .map(removeTravelFields);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.entries(value).reduce((acc, [key, entryValue]) => {
    if (/(postal|distance|travel|commute)/i.test(key)) {
      return acc;
    }

    acc[key] = removeTravelFields(entryValue);
    return acc;
  }, {});
}

function getNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;

    const number = Number(value);
    if (!Number.isNaN(number)) return number;
  }

  return null;
}

function getCourseLabel(course) {
  return course?.university_code || course?.raw?.university_code || course?.course_name || "Unknown";
}

function compareHigherMetric(label, leftValue, rightValue, leftLabel, rightLabel) {
  if (leftValue === null || rightValue === null) return null;

  const better =
    leftValue === rightValue ? "Tie" : leftValue > rightValue ? leftLabel : rightLabel;

  return `${label}: ${leftLabel} ${leftValue}, ${rightLabel} ${rightValue}. Higher is better. Better: ${better}.`;
}

function compareLowerMetric(label, leftValue, rightValue, leftLabel, rightLabel) {
  if (leftValue === null || rightValue === null) return null;

  const easier =
    leftValue === rightValue ? "Tie" : leftValue < rightValue ? leftLabel : rightLabel;

  return `${label}: ${leftLabel} ${leftValue}, ${rightLabel} ${rightValue}. Lower cutoff is easier for admission. Easier admission: ${easier}.`;
}

function buildStructuredComparisonFacts(payload, isJc) {
  const leftCourse = payload.leftCourse || {};
  const rightCourse = payload.rightCourse || {};
  const leftLabel = getCourseLabel(leftCourse);
  const rightLabel = getCourseLabel(rightCourse);

  const facts = [
    compareHigherMetric(
      "Gross monthly median salary",
      getNumber(leftCourse.salary, leftCourse.ges?.gross_monthly_median),
      getNumber(rightCourse.salary, rightCourse.ges?.gross_monthly_median),
      leftLabel,
      rightLabel
    ),
    compareHigherMetric(
      "Overall employment rate",
      getNumber(leftCourse.employability, leftCourse.ges?.employment_rate_overall),
      getNumber(rightCourse.employability, rightCourse.ges?.employment_rate_overall),
      leftLabel,
      rightLabel
    ),
    compareHigherMetric(
      "University prestige score",
      getNumber(leftCourse.prestige, leftCourse.prestige_score, leftCourse.raw?.prestige_score),
      getNumber(rightCourse.prestige, rightCourse.prestige_score, rightCourse.raw?.prestige_score),
      leftLabel,
      rightLabel
    ),
    compareLowerMetric(
      isJc ? "Admissions cutoff UAS 70" : "Admissions cutoff GPA",
      isJc
        ? getNumber(leftCourse.tenth_percentile_uas_70)
        : getNumber(leftCourse.min_gpa),
      isJc
        ? getNumber(rightCourse.tenth_percentile_uas_70)
        : getNumber(rightCourse.min_gpa),
      leftLabel,
      rightLabel
    ),
  ].filter(Boolean);

  const leftIntake = getNumber(leftCourse.intake_size);
  const rightIntake = getNumber(rightCourse.intake_size);

  if (leftIntake !== null && rightIntake !== null) {
    const fewerPlaces =
      leftIntake === rightIntake ? "Tie" : leftIntake < rightIntake ? leftLabel : rightLabel;

    facts.push(
      `Intake size: ${leftLabel} ${leftIntake}, ${rightLabel} ${rightIntake}. Smaller intake means fewer places and may be more competitive. Fewer places: ${fewerPlaces}.`
    );
  }

  return facts;
}

function buildCompareAssessmentPrompt(payload) {
  const userProfile = payload.userProfile || {};
  const latestAcademicProfile = userProfile.academic_profiles?.[0] || null;

  const qualificationType =
    latestAcademicProfile?.qualification_type ||
    payload.preferences?.user_context?.qualification_type ||
    "Unknown";

  const isJc = isJcProfile(qualificationType);
  const structuredComparisonFacts = buildStructuredComparisonFacts(payload, isJc);

  const userContext = {
    user_id: userProfile.user_id ?? payload.userId,
    first_name: userProfile.first_name || "Unknown",
    email: userProfile.email || "Unknown",
    citizenship: userProfile.citizenship || "Unknown",
    qualification_type: qualificationType,
    admissions_metric_to_use: isJc
      ? "Use tenth_percentile_uas_70 for JC/A-Level comparison. Do not use tenth_percentile_rp as the main admissions comparison metric."
      : "Use min_gpa for Polytechnic/Diploma comparison.",
    academic_profile: latestAcademicProfile,
  };

  return `
You are comparing two Singapore university courses for a student.

Use the provided JSON data first.
Use web search only for missing or detail-heavy facts such as:
1. official curriculum/course structure,
2. official tuition fees by citizenship,
3. official programme structure or modules.

Do not assess commute logistics. That is calculated separately outside this prompt.
Do not invent fees, curriculum details, or university policies.
If web search cannot confirm something, say it is unknown.

IMPORTANT USER CONTEXT:
${JSON.stringify(userContext, null, 2)}

The user's citizenship is:
${userContext.citizenship}

Use the user's citizenship when assessing tuition fees or total cost.
If citizenship is "Singapore Citizen", compare against Singapore Citizen subsidised fees where official fee data is available.
If citizenship is "Permanent Resident" or "International Student", use the matching official fee category where available.
If official fee data cannot be verified, say the fee comparison is unknown.

ADMISSIONS COMPARISON RULE:
${isJc
  ? `The student is a JC/A-Level profile. For admissions/cutoff comparison, use tenth_percentile_uas_70 as the main cutoff metric. Do not compare using tenth_percentile_rp unless tenth_percentile_uas_70 is missing.`
  : `The student is a Polytechnic/Diploma profile. For admissions/cutoff comparison, use min_gpa as the main cutoff metric.`
}

INTAKE SIZE RULE:
Use intake_size as a competitiveness signal.
A smaller intake size usually means fewer available places and potentially higher competition, but do not treat it as the only factor.
Compare intake size together with cutoff gap, admissions cutoff, prestige, and course demand.

NUMBER CHECK RULE:
Do not contradict these computed facts. If your prose conflicts with these facts, the prose is wrong.
${structuredComparisonFacts.map(fact => `- ${fact}`).join("\n")}

WORDING RULE:
In left_course and right_course pros, cons, risks, and best_for, avoid comparative words such as "higher", "lower", "better", "worse", "stronger", "weaker", "larger", or "smaller".
Use absolute wording such as "high employment rate of 84.8%", "median salary of S$4,600", or "intake size of 980 students".
Use comparative words only in side_by_side_judgement, where you must compare against the other course using the computed facts above.

User interests and preferences:
${JSON.stringify(payload.preferences?.interests, null, 2)}

Comparison focus:
${JSON.stringify(removeTravelFields(payload.preferences?.compare_factors), null, 2)}

Left course:
${JSON.stringify(removeTravelFields(payload.leftCourse), null, 2)}

Right course:
${JSON.stringify(removeTravelFields(payload.rightCourse), null, 2)}

Assess:
- citizenship-based total cost using the user's citizenship if official fee data is available
- curriculum alignment with wanted interests
- risks from unfavoured interests
- salary and employability
- admissions cut-off using ${
    isJc ? "tenth_percentile_uas_70 for JC/A-Level" : "min_gpa for Polytechnic/Diploma"
  }
- cutoff gap after boost if available
- intake size as a competitiveness factor
- prestige score
- recommendation score if available

Prefer official university and Singapore government/MOE pages.
Keep the answer practical for choosing between the two courses.
Do not overstate certainty.
`;
}

module.exports = {
  buildCompareAssessmentPrompt,
};
