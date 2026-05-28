const express = require("express");
const path = require("path");
const app = express();

const gesRoutes = require("./routers/uniDataRoutes");
const courseRecommendationRoutes = require("./routers/courseRecommendationIGP");
const courseAdmissionsScoreUpdateRoutes = require("./routers/courseAdmissionScoreUpdate70rp");
const coursePriorityRecommendationRoutes = require("./routers/coursePriorityRecommendationRoutes");
const userProfileRoutes = require("./routers/userProfile");
const interestGroupRoutes = require("./routers/interestGroup");
const courseRoutes = require("./routers/course");
const courseCompareRoutes = require("./routers/courseCompare");
const compareAiAssessmentRoutes = require("./routers/courseAiAssessment");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routers/auth");
const userPreferenceStateRoutes = require("./routers/userPreferenceState");
app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.redirect("/login.html");
});

app.use(express.static(path.join(__dirname, "public")));

app.use("/ges", gesRoutes);
app.use("/course-recommendation", courseRecommendationRoutes);
app.use("/course-admissions-update", courseAdmissionsScoreUpdateRoutes);
app.use("/course-priority-recommendation", coursePriorityRecommendationRoutes);
app.use("/interest-groups", interestGroupRoutes);
app.use("/users", userProfileRoutes);
app.use("/courses", courseRoutes);
app.use("/course-compare", courseCompareRoutes);
app.use("/compare-ai-assessment", compareAiAssessmentRoutes);
app.use("/auth", authRoutes);
app.use("/user-preferences", userPreferenceStateRoutes);

module.exports = app;
