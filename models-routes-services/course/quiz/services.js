// quiz/services.js
const mongoose = require('mongoose');
const { status, messages } = require('../../../helper/api.responses');
const { handleServiceError, getPaginationValues2 } = require('../../../helper/utilities.services');
const QuizModel = require('./model');
const QuizQuestionModel = require('./question.model');
const QuizAttemptModel = require('./attempt.model');
const GradeModel = require('../grades/model');
const SubjectModel = require('../subjects/model');
const TermModel = require('../terms/model');
const VideoModel = require('../videos/model');
const data = require('../../../data');
const { logQuizCompletedActivity, logBadgeEarnedActivity } = require('../../../helper/activity.helper');
const { evaluateQuizBadges } = require('../../../helper/badge.helper');

class ServiceError extends Error {
  constructor (messageKey, statusCode = status.BadRequest) {
    super(messageKey);
    this.messageKey = messageKey;
    this.statusCode = statusCode;
  }
}

const objectId = (value) => mongoose.Types.ObjectId(value);

const sanitizeOptionsForStorage = (options = []) => {
  return options.map((option, index) => ({
    _id: option._id ? mongoose.Types.ObjectId(option._id) : new mongoose.Types.ObjectId(),
    sText: (option.sText || '').trim(),
    sImage: option.sImage || '',
    iOrder: typeof option.iOrder === 'number' ? option.iOrder : index
  }));
};

const toOptionSnapshot = (options = []) => options.map((option) => ({
  iOptionId: option._id,
  sText: option.sText,
  sImage: option.sImage,
  iOrder: option.iOrder
}));

const mapQuestionResponse = (question, includeCorrectAnswer = true) => {
  if (!question) return null;
  const base = {
    _id: question._id,
    sQuestion: question.sQuestion,
    sExplanation: question.sExplanation,
    // aTags: question.aTags || [],
    aOptions: toOptionSnapshot(question.aOptions || []),
    nMarks: question.nMarks,
    iQuizId: question.iQuizId,
    eStatus: question.eStatus,
    dCreatedAt: question.dCreatedAt,
    dUpdatedAt: question.dUpdatedAt
  };
  if (includeCorrectAnswer) {
    base.oCorrectAnswer = {
      ...question.oCorrectAnswer,
      iOptionId: question.oCorrectAnswer?.iOptionId
    };
  }
  return base;
};

async function ensureCourseHierarchy ({ iGradeId, iSubjectId, iTermId, iVideoId }) {
  const [grade, subject, term, video] = await Promise.all([
    GradeModel.findOne({ _id: iGradeId, eStatus: { $ne: data.eStatus.map.INACTIVE } }, 'sName').lean(),
    SubjectModel.findOne({ _id: iSubjectId, eStatus: { $ne: data.eStatus.map.INACTIVE } }, 'sName iGradeId').lean(),
    TermModel.findOne({ _id: iTermId, eStatus: { $ne: data.eStatus.map.INACTIVE } }, 'sName iGradeId iSubjectId').lean(),
    iVideoId ? VideoModel.findOne({ _id: iVideoId, eStatus: { $ne: data.eVideoStatus?.map?.INACTIVE || data.eStatus.map.INACTIVE }, bDelete: { $ne: true } }, 'sTitle iGradeId iSubjectId iTermId').lean() : Promise.resolve(null)
  ]);

  if (!grade) throw new ServiceError('gradeNotFound');
  if (!subject) throw new ServiceError('subjectNotFound');
  if (subject.iGradeId.toString() !== iGradeId.toString()) throw new ServiceError('subjectNotInGrade');

  if (!term) throw new ServiceError('termNotFound');
  if (term.iGradeId.toString() !== iGradeId.toString() || term.iSubjectId.toString() !== iSubjectId.toString()) {
    throw new ServiceError('termNotInGradeOrSubject');
  }

  if (iVideoId) {
    if (!video) throw new ServiceError('videoNotFound');
    if (
      video.iGradeId.toString() !== iGradeId.toString() ||
      video.iSubjectId.toString() !== iSubjectId.toString() ||
      video.iTermId.toString() !== iTermId.toString()
    ) {
      throw new ServiceError('videoNotInContext');
    }
  }

  return { grade, subject, term, video };
}

const handleCaughtError = (error, req, res, fallbackMessageKey = 'error') => {
  if (error instanceof ServiceError) {
    return handleServiceError(null, req, res, { statusCode: error.statusCode, messageKey: error.messageKey });
  }
  return handleServiceError(error, req, res, { messageKey: fallbackMessageKey });
};

// Admin: Create quiz question
const createQuizQuestion = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const {
      sQuestion,
      sExplanation,
      aOptions,
      nCorrectOptionIndex,
      nMarks,
      iQuizId,
      // aTags = [],
      eStatus: requestedStatus
    } = req.body;

    if (!iQuizId) {
      throw new ServiceError('quizRequired', status.BadRequest);
    }

    const quiz = await QuizModel.findOne({
      _id: iQuizId,
      bDelete: false,
      eStatus: { $ne: data.eStatus.map.INACTIVE }
    }).lean();

    if (!quiz) {
      throw new ServiceError('quizNotFound', status.NotFound);
    }

    await ensureCourseHierarchy({
      iGradeId: quiz.iGradeId,
      iSubjectId: quiz.iSubjectId,
      iTermId: quiz.iTermId,
      iVideoId: quiz.iVideoId
    });

    if (nCorrectOptionIndex >= aOptions.length) {
      throw new ServiceError('invalidCorrectOption');
    }

    const sanitizedOptions = sanitizeOptionsForStorage(aOptions);
    const correctOption = sanitizedOptions[nCorrectOptionIndex];

    const payload = {
      sQuestion: sQuestion.trim(),
      sExplanation: sExplanation || '',
      aOptions: sanitizedOptions,
      oCorrectAnswer: {
        iOptionId: correctOption._id,
        nOptionIndex: nCorrectOptionIndex,
        sText: correctOption.sText
      },
      nMarks: typeof nMarks === 'number' ? nMarks : 1,
      iQuizId: quiz._id,
      // aTags,
      eStatus: requestedStatus || data.eStatus.map.ACTIVE
    };

    const question = await QuizQuestionModel.create(payload);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].quizQuestionCreated || 'Quiz question created successfully.',
      data: { question: mapQuestionResponse(question) },
      error: {}
    });
  } catch (error) {
    return handleCaughtError(error, req, res, 'failedToCreateQuizQuestion');
  }
};

// Admin: Get quiz question
const getQuizQuestion = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    const question = await QuizQuestionModel.findOne({ _id: id, bDelete: false })
      .populate('iQuizId', 'sTitle iGradeId iSubjectId iTermId iVideoId')
      .lean();

    if (!question) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'quizQuestionNotFound' });
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].quizQuestionRetrieved || 'Quiz question retrieved successfully.',
      data: { question: mapQuestionResponse(question) },
      error: {}
    });
  } catch (error) {
    return handleCaughtError(error, req, res, 'failedToRetrieveQuizQuestion');
  }
};

// Admin: Update quiz question
const updateQuizQuestion = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    const updatePayload = req.body || {};

    const existingQuestion = await QuizQuestionModel.findOne({ _id: id, bDelete: false });
    if (!existingQuestion) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'quizQuestionNotFound' });
    }

    const iQuizId = updatePayload.iQuizId || existingQuestion.iQuizId;
    if (!iQuizId) {
      throw new ServiceError('quizRequired', status.BadRequest);
    }

    const quiz = await QuizModel.findOne({
      _id: iQuizId,
      bDelete: false,
      eStatus: { $ne: data.eStatus.map.INACTIVE }
    }).lean();

    if (!quiz) {
      throw new ServiceError('quizNotFound', status.NotFound);
    }

    await ensureCourseHierarchy({
      iGradeId: quiz.iGradeId,
      iSubjectId: quiz.iSubjectId,
      iTermId: quiz.iTermId,
      iVideoId: quiz.iVideoId
    });

    if (updatePayload.sQuestion) existingQuestion.sQuestion = updatePayload.sQuestion.trim();
    if (updatePayload.sExplanation !== undefined) existingQuestion.sExplanation = updatePayload.sExplanation || '';
    // if (updatePayload.aTags) existingQuestion.aTags = updatePayload.aTags;
    if (updatePayload.eStatus) existingQuestion.eStatus = updatePayload.eStatus;
    if (typeof updatePayload.nMarks === 'number') existingQuestion.nMarks = updatePayload.nMarks;

    existingQuestion.iQuizId = quiz._id;

    if (updatePayload.aOptions) {
      if (typeof updatePayload.nCorrectOptionIndex !== 'number') {
        throw new ServiceError('correctOptionRequired', status.BadRequest);
      }
      if (updatePayload.nCorrectOptionIndex >= updatePayload.aOptions.length) {
        throw new ServiceError('invalidCorrectOption', status.BadRequest);
      }
      const sanitisedOptions = sanitizeOptionsForStorage(updatePayload.aOptions);
      const correctOption = sanitisedOptions[updatePayload.nCorrectOptionIndex];
      existingQuestion.aOptions = sanitisedOptions;
      existingQuestion.oCorrectAnswer = {
        iOptionId: correctOption._id,
        nOptionIndex: updatePayload.nCorrectOptionIndex,
        sText: correctOption.sText
      };
    } else if (typeof updatePayload.nCorrectOptionIndex === 'number') {
      if (updatePayload.nCorrectOptionIndex >= existingQuestion.aOptions.length) {
        throw new ServiceError('invalidCorrectOption', status.BadRequest);
      }
      const correctOption = existingQuestion.aOptions[updatePayload.nCorrectOptionIndex];
      existingQuestion.oCorrectAnswer = {
        iOptionId: correctOption._id,
        nOptionIndex: updatePayload.nCorrectOptionIndex,
        sText: correctOption.sText
      };
    }

    await existingQuestion.save();

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].quizQuestionUpdated || 'Quiz question updated successfully.',
      data: { question: mapQuestionResponse(existingQuestion.toObject()) },
      error: {}
    });
  } catch (error) {
    return handleCaughtError(error, req, res, 'failedToUpdateQuizQuestion');
  }
};

// Admin: Delete quiz question
const deleteQuizQuestion = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    const question = await QuizQuestionModel.findOneAndUpdate(
      { _id: id, bDelete: false },
      { bDelete: true, eStatus: data.eStatus.map.INACTIVE },
      { new: true }
    );

    if (!question) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'quizQuestionNotFound' });
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].quizQuestionDeleted || 'Quiz question deleted successfully.',
      data: {},
      error: {}
    });
  } catch (error) {
    return handleCaughtError(error, req, res, 'failedToDeleteQuizQuestion');
  }
};

// Admin: List quiz questions
const listQuizQuestions = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { limit, start } = getPaginationValues2(req.query);
    const {
      quizId,
      status: requestedStatus,
      search,
      sortBy = 'dCreatedAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { bDelete: false };
    if (quizId) query.iQuizId = objectId(quizId);
    if (requestedStatus) query.eStatus = requestedStatus;
    if (search) query.sQuestion = new RegExp(search, 'i');

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [total, questions] = await Promise.all([
      QuizQuestionModel.countDocuments(query),
      QuizQuestionModel.find(query)
        .sort(sort)
        .skip(Number(start))
        .limit(Number(limit))
        .lean()
    ]);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].quizQuestionsListed || 'Quiz questions listed successfully.',
      data: {
        total,
        limit: Number(limit),
        start: Number(start),
        results: questions.map((question) => mapQuestionResponse(question))
      },
      error: {}
    });
  } catch (error) {
    return handleCaughtError(error, req, res, 'failedToListQuizQuestions');
  }
};

// Admin: Get question count for a video
const getVideoQuestionCount = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { videoId } = req.params;

    const video = await VideoModel.findOne({ _id: videoId, bDelete: { $ne: true } }, '_id').lean();
    if (!video) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'videoNotFound' });
    }

    const quizzes = await QuizModel.find({
      iVideoId: videoId,
      bDelete: false,
      eStatus: { $ne: data.eStatus.map.INACTIVE }
    }).select('_id').lean();

    const quizIds = quizzes.map(quiz => quiz._id);

    const totalQuestions = await QuizQuestionModel.countDocuments({
      iQuizId: { $in: quizIds },
      bDelete: false,
      eStatus: data.eStatus.map.ACTIVE
    });

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].videoQuestionCountRetrieved || 'Video question count retrieved successfully.',
      data: {
        videoId,
        totalQuestions
      },
      error: {}
    });
  } catch (error) {
    return handleCaughtError(error, req, res, 'failedToGetVideoQuestionCount');
  }
};

// User: Get random quiz questions
const getRandomQuizQuestions = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const {
      quizId,
      limit = 5
    } = req.query;

    if (!quizId) {
      throw new ServiceError('quizRequired', status.BadRequest);
    }

    const quiz = await QuizModel.findOne({
      _id: quizId,
      bDelete: false,
      eStatus: { $ne: data.eStatus.map.INACTIVE }
    }).lean();

    if (!quiz) {
      throw new ServiceError('quizNotFound', status.NotFound);
    }

    await ensureCourseHierarchy({
      iGradeId: quiz.iGradeId,
      iSubjectId: quiz.iSubjectId,
      iTermId: quiz.iTermId,
      iVideoId: quiz.iVideoId
    });

    const sanitizedLimit = Math.min(Math.max(parseInt(limit, 10) || 1, 1), 50);

    const matchQuery = {
      bDelete: false,
      eStatus: data.eStatus.map.ACTIVE,
      iQuizId: objectId(quizId)
    };

    const pipeline = [
      {
        $match: matchQuery
      },
      { $sample: { size: sanitizedLimit } },
      {
        $project: {
          sQuestion: 1,
          sExplanation: 1,
          // aTags: 1,
          nMarks: 1,
          aOptions: 1
        }
      }
    ];

    const [rawQuestions, totalQuestions] = await Promise.all([
      QuizQuestionModel.aggregate(pipeline),
      QuizQuestionModel.countDocuments(matchQuery)
    ]);

    const questions = rawQuestions.map((question) => ({
      _id: question._id,
      sQuestion: question.sQuestion,
      sExplanation: question.sExplanation,
      // aTags: question.aTags || [],
      nMarks: question.nMarks,
      aOptions: toOptionSnapshot(question.aOptions || [])
    }));

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].quizQuestionsFetched || 'Quiz questions fetched successfully.',
      data: {
        quiz: {
          _id: quiz._id,
          sTitle: quiz.sTitle,
          sDescription: quiz.sDescription,
          nTotalQuestions: totalQuestions,
          nTimeLimitInMinutes: quiz.nTimeLimitInMinutes
        },
        total: questions.length,
        limit: sanitizedLimit,
        questions
      },
      error: {}
    });
  } catch (error) {
    return handleCaughtError(error, req, res, 'failedToFetchQuizQuestions');
  }
};

const buildAttemptQuery = ({ gradeId, subjectId, termId, videoId, quizId, from, to, userId }) => {
  const query = {};
  if (gradeId) query.iGradeId = objectId(gradeId);
  if (subjectId) query.iSubjectId = objectId(subjectId);
  if (termId) query.iTermId = objectId(termId);
  if (videoId) query.iVideoId = objectId(videoId);
  if (quizId) query.iQuizId = objectId(quizId);
  if (userId) query.iUserId = objectId(userId);
  if (from || to) {
    query.dCreatedAt = {};
    if (from) query.dCreatedAt.$gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      query.dCreatedAt.$lte = toDate;
    }
  }
  return query;
};

const computeAttemptStats = (questionDocs, responseMap) => {
  let nCorrectAnswers = 0;
  let nTotalMarks = 0;
  let nScoreEarned = 0;
  const questionResults = [];

  questionDocs.forEach((question) => {
    const selectedOptionId = responseMap.get(question._id.toString());
    const correctOptionId = question.oCorrectAnswer?.iOptionId?.toString();
    const isCorrect = !!selectedOptionId && selectedOptionId === correctOptionId;
    const questionMarks = question.nMarks || 1;

    nTotalMarks += questionMarks;
    if (isCorrect) {
      nCorrectAnswers += 1;
      nScoreEarned += questionMarks;
    }

    questionResults.push({
      iQuestionId: question._id,
      sQuestion: question.sQuestion,
      aOptions: toOptionSnapshot(question.aOptions),
      nMarks: questionMarks,
      iSelectedOptionId: selectedOptionId ? objectId(selectedOptionId) : null,
      iCorrectOptionId: question.oCorrectAnswer?.iOptionId,
      bIsCorrect: isCorrect,
      sExplanation: question.sExplanation || ''
    });
  });

  const nTotalQuestions = questionResults.length;
  const nIncorrectAnswers = nTotalQuestions - nCorrectAnswers;
  const nPercentage = nTotalMarks ? Number(((nScoreEarned / nTotalMarks) * 100).toFixed(2)) : 0;

  return {
    questionResults,
    stats: {
      nTotalQuestions,
      nCorrectAnswers,
      nIncorrectAnswers,
      nTotalMarks,
      nScoreEarned,
      nPercentage
    }
  };
};

// User: Submit quiz attempt
const submitQuizAttempt = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const {
      iQuizId,
      aResponses,
      nTimeTakenInSeconds,
      dStartedAt,
      dCompletedAt
    } = req.body;
    const userId = req.user._id;

    if (!iQuizId) {
      throw new ServiceError('quizRequired', status.BadRequest);
    }

    const quiz = await QuizModel.findOne({
      _id: iQuizId,
      bDelete: false,
      eStatus: { $ne: data.eStatus.map.INACTIVE }
    }).lean();

    if (!quiz) {
      throw new ServiceError('quizNotFound', status.NotFound);
    }

    const context = await ensureCourseHierarchy({
      iGradeId: quiz.iGradeId,
      iSubjectId: quiz.iSubjectId,
      iTermId: quiz.iTermId,
      iVideoId: quiz.iVideoId
    });

    const questionIds = aResponses.map((response) => response.iQuestionId);
    const responseMap = new Map(aResponses.map((response) => [response.iQuestionId, response.iSelectedOptionId]));

    const questionQuery = {
      _id: { $in: questionIds },
      bDelete: false,
      eStatus: data.eStatus.map.ACTIVE,
      iQuizId: objectId(iQuizId)
    };

    const questionDocs = await QuizQuestionModel.find(questionQuery).lean();

    if (!questionDocs.length) {
      throw new ServiceError('quizQuestionNotFound', status.BadRequest);
    }

    const { questionResults, stats } = computeAttemptStats(questionDocs, responseMap);

    const attemptPayload = {
      iUserId: userId,
      iGradeId: quiz.iGradeId,
      iSubjectId: quiz.iSubjectId,
      iTermId: quiz.iTermId,
      iQuizId: quiz._id,
      iVideoId: quiz.iVideoId || null,
      aQuestions: questionResults,
      nTotalQuestions: stats.nTotalQuestions,
      nCorrectAnswers: stats.nCorrectAnswers,
      nIncorrectAnswers: stats.nIncorrectAnswers,
      nTotalMarks: stats.nTotalMarks,
      nScoreEarned: stats.nScoreEarned,
      nPercentage: stats.nPercentage,
      nTimeTakenInSeconds: nTimeTakenInSeconds || 0,
      dStartedAt: dStartedAt ? new Date(dStartedAt) : undefined,
      dCompletedAt: dCompletedAt ? new Date(dCompletedAt) : new Date(),
      oSummary: {
        iGradeId: quiz.iGradeId,
        iSubjectId: quiz.iSubjectId,
        iTermId: quiz.iTermId,
        iVideoId: quiz.iVideoId || null,
        iQuizId: quiz._id
      }
    };

    const attempt = await QuizAttemptModel.create(attemptPayload);

    // Fire-and-forget activity log
    logQuizCompletedActivity({
      userId,
      gradeId: quiz.iGradeId,
      gradeName: context.grade?.sName,
      subjectId: quiz.iSubjectId,
      subjectName: context.subject?.sName,
      termId: quiz.iTermId,
      termName: context.term?.sName,
      videoId: quiz.iVideoId,
      videoTitle: context.video?.sTitle,
      totalQuestions: stats.nTotalQuestions,
      correctAnswers: stats.nCorrectAnswers,
      scoreEarned: stats.nScoreEarned,
      totalMarks: stats.nTotalMarks
    }).catch(() => { });

    // Award badge if student got all questions correct (perfect score)
    const isPerfectScore = stats.nCorrectAnswers === stats.nTotalQuestions && stats.nTotalQuestions > 0;
    if (isPerfectScore) {
      const badgeName = `Perfect Score - ${stats.nTotalQuestions}/${stats.nTotalQuestions}`;
      const badgeDescription = `Scored ${stats.nTotalQuestions} out of ${stats.nTotalQuestions} in ${context.subject?.sName || 'quiz'}`;

      // Fire-and-forget badge award
      logBadgeEarnedActivity({
        userId,
        badgeId: `quiz_perfect_${quiz.iVideoId}_${stats.nTotalQuestions}`,
        badgeName,
        badgeIcon: '🏆',
        badgeDescription
      }).catch(() => { });
      evaluateQuizBadges({ userId }).catch(() => { });
    }

    const responseData = {
      attempt: {
        _id: attempt._id,
        ...stats,
        nTimeTakenInSeconds: attempt.nTimeTakenInSeconds,
        dStartedAt: attempt.dStartedAt,
        dCompletedAt: attempt.dCompletedAt,
        aQuestions: questionResults
      }
    };

    // Include badge information if perfect score
    if (isPerfectScore) {
      responseData.badgeEarned = {
        badgeId: `quiz_perfect_${quiz.iVideoId}_${stats.nTotalQuestions}`,
        badgeName: `Perfect Score - ${stats.nTotalQuestions}/${stats.nTotalQuestions}`,
        badgeIcon: '🏆',
        message: messages[lang].quizPerfectScoreBadgeEarned || 'Congratulations! You earned a Perfect Score Badge for getting all questions correct!'
      };
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].quizAttemptRecorded || 'Quiz attempt recorded successfully.',
      data: responseData,
      error: {}
    });
  } catch (error) {
    return handleCaughtError(error, req, res, 'failedToSubmitQuizAttempt');
  }
};

// User: List quiz attempts (self)
const listMyQuizAttempts = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const userId = req.user._id;
    const { limit, start } = getPaginationValues2(req.query);
    const { sortBy = 'dCreatedAt', sortOrder = 'desc' } = req.query;
    const query = buildAttemptQuery({ ...req.query });
    query.iUserId = userId;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [total, attempts] = await Promise.all([
      QuizAttemptModel.countDocuments(query),
      QuizAttemptModel.find(query)
        .sort(sort)
        .skip(Number(start))
        .limit(Number(limit))
        .lean()
    ]);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].quizAttemptsFetched || 'Quiz attempts fetched successfully.',
      data: {
        total,
        limit: Number(limit),
        start: Number(start),
        results: attempts
      },
      error: {}
    });
  } catch (error) {
    return handleCaughtError(error, req, res, 'failedToFetchQuizAttempts');
  }
};

// Admin: List quiz attempts across students
const listQuizAttempts = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { limit, start } = getPaginationValues2(req.query);
    const { sortBy = 'dCreatedAt', sortOrder = 'desc', userId } = req.query;
    const query = buildAttemptQuery({ ...req.query, userId });
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [total, attempts] = await Promise.all([
      QuizAttemptModel.countDocuments(query),
      QuizAttemptModel.find(query)
        .sort(sort)
        .skip(Number(start))
        .limit(Number(limit))
        .lean()
    ]);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].quizAttemptsListed || 'Quiz attempts listed successfully.',
      data: {
        total,
        limit: Number(limit),
        start: Number(start),
        results: attempts
      },
      error: {}
    });
  } catch (error) {
    return handleCaughtError(error, req, res, 'failedToListQuizAttempts');
  }
};

const mapQuizResponse = (quiz) => {
  if (!quiz) return null;
  return {
    _id: quiz._id,
    sTitle: quiz.sTitle,
    sDescription: quiz.sDescription,
    iGradeId: quiz.iGradeId,
    iSubjectId: quiz.iSubjectId,
    iTermId: quiz.iTermId,
    iVideoId: quiz.iVideoId,
    nTotalMarks: quiz.nTotalMarks,
    nTimeLimitInMinutes: quiz.nTimeLimitInMinutes,
    eStatus: quiz.eStatus,
    dCreatedAt: quiz.dCreatedAt,
    dUpdatedAt: quiz.dUpdatedAt
  };
};

const createQuiz = async (req, res) => {
  const lang = req.userLanguage;
  console.log(req.body, 'req.body');
  try {
    const {
      sTitle,
      sDescription,
      iGradeId,
      iSubjectId,
      iTermId,
      iVideoId,
      nTotalMarks,
      nTimeLimitInMinutes,
      eStatus: requestedStatus
    } = req.body;

    if (!iVideoId) {
      throw new ServiceError('videoRequired', status.BadRequest);
    }

    const video = await VideoModel.findOne(
      { _id: iVideoId, bDelete: { $ne: true } },
      'iGradeId iSubjectId iTermId'
    ).lean();

    if (!video) {
      throw new ServiceError('videoNotFound', status.NotFound);
    }

    // Ensure only one quiz can be linked to a video
    const existingQuizForVideo = await QuizModel.findOne({
      iVideoId,
      bDelete: false,
      eStatus: { $ne: data.eStatus.map.INACTIVE }
    }).lean();

    if (existingQuizForVideo) {
      throw new ServiceError('quizAlreadyExistsForVideo', status.BadRequest);
    }

    const resolvedGradeId = iGradeId || video.iGradeId;
    const resolvedSubjectId = iSubjectId || video.iSubjectId;
    const resolvedTermId = iTermId || video.iTermId;

    await ensureCourseHierarchy({
      iGradeId: resolvedGradeId,
      iSubjectId: resolvedSubjectId,
      iTermId: resolvedTermId,
      iVideoId
    });

    const payload = {
      sTitle: sTitle.trim(),
      sDescription: sDescription || '',
      iGradeId: resolvedGradeId,
      iSubjectId: resolvedSubjectId,
      iTermId: resolvedTermId,
      iVideoId: iVideoId || null,
      nTotalMarks: typeof nTotalMarks === 'number' ? nTotalMarks : 0,
      nTimeLimitInMinutes: typeof nTimeLimitInMinutes === 'number' ? nTimeLimitInMinutes : 0,
      eStatus: requestedStatus || data.eStatus.map.ACTIVE
    };

    const quiz = await QuizModel.create(payload);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].quizCreated || 'Quiz created successfully.',
      data: { quiz: mapQuizResponse(quiz.toObject()) },
      error: {}
    });
  } catch (error) {
    console.log('error while creating quiz', error);
    return handleCaughtError(error, req, res, 'failedToCreateQuiz');
  }
};

const getQuiz = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    const quiz = await QuizModel.findOne({ _id: id, bDelete: false })
      .populate('iGradeId', 'sName')
      .populate('iSubjectId', 'sName')
      .populate('iTermId', 'sName')
      .populate('iVideoId', 'sTitle')
      .lean();

    if (!quiz) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'quizNotFound' });
    }

    const questionCount = await QuizQuestionModel.countDocuments({
      iQuizId: id,
      bDelete: false,
      eStatus: data.eStatus.map.ACTIVE
    });

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].quizRetrieved || 'Quiz retrieved successfully.',
      data: {
        quiz: mapQuizResponse(quiz),
        nQuestionCount: questionCount
      },
      error: {}
    });
  } catch (error) {
    return handleCaughtError(error, req, res, 'failedToRetrieveQuiz');
  }
};

const updateQuiz = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    const updatePayload = req.body || {};

    const existingQuiz = await QuizModel.findOne({ _id: id, bDelete: false });
    if (!existingQuiz) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'quizNotFound' });
    }

    const resolvedVideoId = updatePayload.iVideoId !== undefined ? updatePayload.iVideoId : existingQuiz.iVideoId;
    let resolvedGradeId = updatePayload.iGradeId || existingQuiz.iGradeId;
    let resolvedSubjectId = updatePayload.iSubjectId || existingQuiz.iSubjectId;
    let resolvedTermId = updatePayload.iTermId || existingQuiz.iTermId;

    if (
      updatePayload.iVideoId &&
      (!updatePayload.iGradeId || !updatePayload.iSubjectId || !updatePayload.iTermId)
    ) {
      const video = await VideoModel.findOne(
        { _id: updatePayload.iVideoId, bDelete: { $ne: true } },
        'iGradeId iSubjectId iTermId'
      ).lean();

      if (!video) {
        throw new ServiceError('videoNotFound', status.NotFound);
      }

      resolvedGradeId = updatePayload.iGradeId || video.iGradeId;
      resolvedSubjectId = updatePayload.iSubjectId || video.iSubjectId;
      resolvedTermId = updatePayload.iTermId || video.iTermId;
    }

    const contextIds = {
      iGradeId: resolvedGradeId,
      iSubjectId: resolvedSubjectId,
      iTermId: resolvedTermId,
      iVideoId: resolvedVideoId
    };

    await ensureCourseHierarchy(contextIds);

    // Ensure only one quiz can be linked to a video
    if (resolvedVideoId) {
      const existingQuizForVideo = await QuizModel.findOne({
        iVideoId: resolvedVideoId,
        _id: { $ne: id },
        bDelete: false,
        eStatus: { $ne: data.eStatus.map.INACTIVE }
      }).lean();

      if (existingQuizForVideo) {
        throw new ServiceError('quizAlreadyExistsForVideo', status.BadRequest);
      }
    }

    if (updatePayload.sTitle) existingQuiz.sTitle = updatePayload.sTitle.trim();
    if (updatePayload.sDescription !== undefined) existingQuiz.sDescription = updatePayload.sDescription || '';
    if (updatePayload.eStatus) existingQuiz.eStatus = updatePayload.eStatus;
    if (typeof updatePayload.nTotalMarks === 'number') existingQuiz.nTotalMarks = updatePayload.nTotalMarks;
    if (typeof updatePayload.nTimeLimitInMinutes === 'number') existingQuiz.nTimeLimitInMinutes = updatePayload.nTimeLimitInMinutes;

    existingQuiz.iGradeId = resolvedGradeId;
    existingQuiz.iSubjectId = resolvedSubjectId;
    existingQuiz.iTermId = resolvedTermId;
    existingQuiz.iVideoId = resolvedVideoId || null;

    await existingQuiz.save();

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].quizUpdated || 'Quiz updated successfully.',
      data: { quiz: mapQuizResponse(existingQuiz.toObject()) },
      error: {}
    });
  } catch (error) {
    return handleCaughtError(error, req, res, 'failedToUpdateQuiz');
  }
};

const deleteQuiz = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { id } = req.params;
    const quiz = await QuizModel.findOneAndUpdate(
      { _id: id, bDelete: false },
      { bDelete: true, eStatus: data.eStatus.map.INACTIVE },
      { new: true }
    );

    if (!quiz) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'quizNotFound' });
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].quizDeleted || 'Quiz deleted successfully.',
      data: {},
      error: {}
    });
  } catch (error) {
    return handleCaughtError(error, req, res, 'failedToDeleteQuiz');
  }
};

const listQuizzes = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { limit, start } = getPaginationValues2(req.query);
    const {
      gradeId,
      subjectId,
      termId,
      videoId,
      status: requestedStatus,
      search,
      sortBy = 'dCreatedAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { bDelete: false };
    if (gradeId) query.iGradeId = objectId(gradeId);
    if (subjectId) query.iSubjectId = objectId(subjectId);
    if (termId) query.iTermId = objectId(termId);
    if (videoId) query.iVideoId = objectId(videoId);
    if (requestedStatus) query.eStatus = requestedStatus;
    if (search) {
      query.$or = [
        { sTitle: new RegExp(search, 'i') },
        { sDescription: new RegExp(search, 'i') }
      ];
    }

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [total, quizzes] = await Promise.all([
      QuizModel.countDocuments(query),
      QuizModel.find(query)
        .sort(sort)
        .skip(Number(start))
        .limit(Number(limit))
        .populate('iGradeId', 'sName')
        .populate('iSubjectId', 'sName')
        .populate('iTermId', 'sName')
        .populate('iVideoId', 'sTitle')
        .lean()
    ]);

    const quizzesWithCounts = await Promise.all(
      quizzes.map(async (quiz) => {
        const questionCount = await QuizQuestionModel.countDocuments({
          iQuizId: quiz._id,
          bDelete: false,
          eStatus: data.eStatus.map.ACTIVE
        });
        return {
          ...mapQuizResponse(quiz),
          nQuestionCount: questionCount
        };
      })
    );

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].quizzesListed || 'Quizzes listed successfully.',
      data: {
        total,
        limit: Number(limit),
        start: Number(start),
        results: quizzesWithCounts
      },
      error: {}
    });
  } catch (error) {
    return handleCaughtError(error, req, res, 'failedToListQuizzes');
  }
};

module.exports = {
  createQuizQuestion,
  getQuizQuestion,
  updateQuizQuestion,
  deleteQuizQuestion,
  listQuizQuestions,
  getVideoQuestionCount,
  getRandomQuizQuestions,
  submitQuizAttempt,
  listMyQuizAttempts,
  listQuizAttempts,
  createQuiz,
  getQuiz,
  updateQuiz,
  deleteQuiz,
  listQuizzes
};
