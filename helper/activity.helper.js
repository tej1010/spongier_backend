// activity.helper.js
const { recordActivity } = require('../models-routes-services/user/activityHistory/services');
const { eActivityType } = require('../data');

/**
 * Helper functions to auto-generate activity logs
 * These can be called from anywhere in the application
 */

/**
 * Log video watch activity
 */
async function logVideoWatchActivity ({
  userId,
  videoId,
  videoTitle,
  videoThumbnail,
  videoDuration,
  watchDuration,
  watchPercentage,
  subjectId,
  subjectName,
  termId,
  termName,
  gradeId,
  gradeName,
  isFirstVideo = false
}) {
  try {
    const activityType = isFirstVideo ? eActivityType.map.FIRST_VIDEO : eActivityType.map.VIDEO_WATCH;
    const title = isFirstVideo
      ? `Started learning journey by watching "${videoTitle}"`
      : `Watched "${videoTitle}"`;

    const description = `Watched ${Math.floor(watchPercentage || 0)}% of ${videoTitle}${subjectName ? ` in ${subjectName}` : ''}`;

    await recordActivity({
      iUserId: userId,
      eActivityType: activityType,
      sTitle: title,
      sDescription: description,
      oMetadata: {
        videoId,
        videoTitle,
        videoThumbnail,
        videoDuration,
        watchDuration,
        watchPercentage,
        subjectId,
        subjectName,
        termId,
        termName,
        gradeId,
        gradeName
      },
      iGradeId: gradeId,
      iSubjectId: subjectId,
      iTermId: termId,
      iVideoId: videoId,
      bHighlight: isFirstVideo
    });

    console.log(`✅ Activity logged: ${activityType} for user ${userId}`);
  } catch (error) {
    console.error('Error logging video watch activity:', error);
  }
}

/**
 * Log video completion activity
 */
async function logVideoCompleteActivity ({
  userId,
  videoId,
  videoTitle,
  videoThumbnail,
  videoDuration,
  subjectId,
  subjectName,
  termId,
  termName,
  gradeId,
  gradeName
}) {
  try {
    const title = `Completed "${videoTitle}"`;
    const description = `Successfully completed watching ${videoTitle}${subjectName ? ` in ${subjectName}` : ''}`;

    await recordActivity({
      iUserId: userId,
      eActivityType: eActivityType.map.VIDEO_COMPLETE,
      sTitle: title,
      sDescription: description,
      oMetadata: {
        videoId,
        videoTitle,
        videoThumbnail,
        videoDuration,
        watchPercentage: 100,
        subjectId,
        subjectName,
        termId,
        termName,
        gradeId,
        gradeName
      },
      iGradeId: gradeId,
      iSubjectId: subjectId,
      iTermId: termId,
      iVideoId: videoId,
      bHighlight: true
    });

    console.log(`✅ Activity logged: video_complete for user ${userId}`);
  } catch (error) {
    console.error('Error logging video complete activity:', error);
  }
}

/**
 * Log term completion activity
 */
async function logTermCompleteActivity ({
  userId,
  termId,
  termName,
  subjectId,
  subjectName,
  gradeId,
  gradeName,
  totalVideos,
  completedVideos
}) {
  try {
    const title = `Completed Term: ${termName}`;
    const description = `Completed all ${completedVideos} videos in ${termName}${subjectName ? ` - ${subjectName}` : ''}`;

    await recordActivity({
      iUserId: userId,
      eActivityType: eActivityType.map.TERM_COMPLETE,
      sTitle: title,
      sDescription: description,
      oMetadata: {
        termId,
        termName,
        subjectId,
        subjectName,
        gradeId,
        gradeName,
        totalItems: totalVideos,
        completedItems: completedVideos,
        completionPercentage: 100
      },
      iGradeId: gradeId,
      iSubjectId: subjectId,
      iTermId: termId,
      bHighlight: true
    });

    console.log(`✅ Activity logged: term_complete for user ${userId}`);
  } catch (error) {
    console.error('Error logging term complete activity:', error);
  }
}

/**
 * Log subject completion activity
 */
async function logSubjectCompleteActivity ({
  userId,
  subjectId,
  subjectName,
  gradeId,
  gradeName,
  totalVideos,
  completedVideos,
  totalTerms
}) {
  try {
    const title = `Completed Subject: ${subjectName}`;
    const description = `Completed all ${completedVideos} videos across ${totalTerms} terms in ${subjectName}`;

    await recordActivity({
      iUserId: userId,
      eActivityType: eActivityType.map.SUBJECT_COMPLETE,
      sTitle: title,
      sDescription: description,
      oMetadata: {
        subjectId,
        subjectName,
        gradeId,
        gradeName,
        totalItems: totalVideos,
        completedItems: completedVideos,
        totalTerms,
        completionPercentage: 100
      },
      iGradeId: gradeId,
      iSubjectId: subjectId,
      bHighlight: true
    });

    console.log(`✅ Activity logged: subject_complete for user ${userId}`);
  } catch (error) {
    console.error('Error logging subject complete activity:', error);
  }
}

/**
 * Log grade completion activity
 */
async function logGradeCompleteActivity ({
  userId,
  gradeId,
  gradeName,
  totalSubjects,
  totalVideos,
  completedVideos
}) {
  try {
    const title = `Completed Grade: ${gradeName}`;
    const description = `Completed all ${completedVideos} videos across ${totalSubjects} subjects in ${gradeName}`;

    await recordActivity({
      iUserId: userId,
      eActivityType: eActivityType.map.GRADE_COMPLETE,
      sTitle: title,
      sDescription: description,
      oMetadata: {
        gradeId,
        gradeName,
        totalSubjects,
        totalItems: totalVideos,
        completedItems: completedVideos,
        completionPercentage: 100
      },
      iGradeId: gradeId,
      bHighlight: true
    });

    console.log(`✅ Activity logged: grade_complete for user ${userId}`);
  } catch (error) {
    console.error('Error logging grade complete activity:', error);
  }
}

/**
 * Log streak achievement activity
 */
async function logStreakAchievementActivity ({
  userId,
  streakCount,
  streakType = 'daily'
}) {
  try {
    const title = `${streakCount} Day Streak!`;
    const description = `Achieved a ${streakCount} day learning streak`;

    await recordActivity({
      iUserId: userId,
      eActivityType: eActivityType.map.STREAK_ACHIEVED,
      sTitle: title,
      sDescription: description,
      oMetadata: {
        streakCount,
        streakType
      },
      bHighlight: streakCount >= 7 // Highlight 7+ day streaks
    });

    console.log(`✅ Activity logged: streak_achieved for user ${userId}`);
  } catch (error) {
    console.error('Error logging streak achievement activity:', error);
  }
}

/**
 * Log badge earned activity
 */
async function logBadgeEarnedActivity ({
  userId,
  badgeId,
  badgeName,
  badgeIcon,
  badgeDescription
}) {
  try {
    const title = `Earned Badge: ${badgeName}`;
    const description = badgeDescription || `Earned the ${badgeName} badge`;

    await recordActivity({
      iUserId: userId,
      eActivityType: eActivityType.map.BADGE_EARNED,
      sTitle: title,
      sDescription: description,
      oMetadata: {
        badgeId,
        badgeName,
        badgeIcon
      },
      bHighlight: true
    });

    console.log(`✅ Activity logged: badge_earned for user ${userId}`);
  } catch (error) {
    console.error('Error logging badge earned activity:', error);
  }
}

/**
 * Log resource access activity
 */
async function logResourceAccessActivity ({
  userId,
  resourceId,
  resourceTitle,
  resourceType,
  subjectId,
  subjectName,
  termId,
  termName,
  gradeId,
  gradeName
}) {
  try {
    const title = `Accessed ${resourceType || 'resource'}: ${resourceTitle}`;
    const description = `Accessed ${resourceTitle}${subjectName ? ` in ${subjectName}` : ''}`;

    await recordActivity({
      iUserId: userId,
      eActivityType: eActivityType.map.RESOURCE_ACCESSED,
      sTitle: title,
      sDescription: description,
      oMetadata: {
        resourceId,
        resourceTitle,
        resourceType,
        subjectId,
        subjectName,
        termId,
        termName,
        gradeId,
        gradeName
      },
      iGradeId: gradeId,
      iSubjectId: subjectId,
      iTermId: termId
    });

    console.log(`✅ Activity logged: resource_accessed for user ${userId}`);
  } catch (error) {
    console.error('Error logging resource access activity:', error);
  }
}

/**
 * Log quiz completion activity
 */
async function logQuizCompletedActivity ({
  userId,
  quizTitle,
  gradeId,
  gradeName,
  subjectId,
  subjectName,
  termId,
  termName,
  videoId,
  videoTitle,
  totalQuestions,
  correctAnswers,
  scoreEarned,
  totalMarks,
  percentage
}) {
  try {
    const safeQuizTitle = quizTitle || videoTitle || 'Quiz';
    const title = `Completed Quiz: ${safeQuizTitle}`;
    const description = `Scored ${scoreEarned}/${totalMarks} with ${correctAnswers}/${totalQuestions} correct answers`;

    await recordActivity({
      iUserId: userId,
      eActivityType: eActivityType.map.QUIZ_COMPLETED,
      sTitle: title,
      sDescription: description,
      oMetadata: {
        quizTitle: safeQuizTitle,
        videoId,
        videoTitle,
        gradeId,
        gradeName,
        subjectId,
        subjectName,
        termId,
        termName,
        totalQuestions,
        correctAnswers,
        totalMarks,
        scoreEarned,
        percentage
      },
      iGradeId: gradeId,
      iSubjectId: subjectId,
      iTermId: termId,
      iVideoId: videoId,
      bHighlight: percentage >= 80
    });

    console.log(`✅ Activity logged: quiz_completed for user ${userId}`);
  } catch (error) {
    console.error('Error logging quiz completion activity:', error);
  }
}

/**
 * Log custom activity
 */
async function logCustomActivity ({
  userId,
  activityType = 'other',
  title,
  description = '',
  metadata = {},
  gradeId = null,
  subjectId = null,
  termId = null,
  videoId = null,
  highlight = false
}) {
  try {
    await recordActivity({
      iUserId: userId,
      eActivityType: activityType,
      sTitle: title,
      sDescription: description,
      oMetadata: metadata,
      iGradeId: gradeId,
      iSubjectId: subjectId,
      iTermId: termId,
      iVideoId: videoId,
      bHighlight: highlight
    });

    console.log(`✅ Activity logged: ${activityType} for user ${userId}`);
  } catch (error) {
    console.error('Error logging custom activity:', error);
  }
}

module.exports = {
  logVideoWatchActivity,
  logVideoCompleteActivity,
  logTermCompleteActivity,
  logSubjectCompleteActivity,
  logGradeCompleteActivity,
  logStreakAchievementActivity,
  logBadgeEarnedActivity,
  logResourceAccessActivity,
  logQuizCompletedActivity,
  logCustomActivity
};
