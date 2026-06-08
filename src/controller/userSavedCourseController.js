const userSavedCourseModel = require("../models/userSavedCourse");

module.exports.listSavedCourses = async function listSavedCourses(req, res) {
  try {
    const courseIds = await userSavedCourseModel.listSavedCourseIds(req.userId);

    return res.status(200).json({
      message: "Saved courses retrieved successfully",
      data: {
        courseIds,
      },
    });
  } catch (error) {
    console.error("Error retrieving saved courses:", error);

    return res.status(500).json({
      message: "Failed to retrieve saved courses",
      error: error.message,
    });
  }
};

module.exports.saveCourse = async function saveCourse(req, res) {
  try {
    const courseIds = await userSavedCourseModel.saveCourse(
      req.userId,
      req.params.courseId
    );

    return res.status(200).json({
      message: "Course saved successfully",
      data: {
        courseIds,
      },
    });
  } catch (error) {
    console.error("Error saving course:", error);

    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to save course",
      error: error.message,
    });
  }
};

module.exports.removeCourse = async function removeCourse(req, res) {
  try {
    const courseIds = await userSavedCourseModel.removeCourse(
      req.userId,
      req.params.courseId
    );

    return res.status(200).json({
      message: "Course removed from saved courses",
      data: {
        courseIds,
      },
    });
  } catch (error) {
    console.error("Error removing saved course:", error);

    return res.status(500).json({
      message: "Failed to remove saved course",
      error: error.message,
    });
  }
};
