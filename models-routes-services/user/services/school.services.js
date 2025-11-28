const { messages, status } = require('../../../helper/api.responses');
const { handleServiceError, secondsToHHMMSS, searchRegExp } = require('../../../helper/utilities.services');
const UserModel = require('../model');
const SubscriptionModel = require('../../subscription/model');
const GradeModel = require('../../course/grades/model');
const SubjectModel = require('../../course/subjects/model');
const VideoModel = require('../../course/videos/model');
const VideoWatchHistoryModel = require('../../course/videos/watchHistory/model');
const data = require('../../../data');
const { DEFAULT_STUDENT_PASSWORD } = require('../../../config/defaultConfig');
const { sendStudentInvitationEmail } = require('../../../helper/mail.services');
const { createFreemiumUserSubscription } = require('../../subscription/common');

/**
 * School-Specific Services
 * Handles school operations for managing children accounts
 */

/**
 * Add Student by School
 */
const addStudentBySchool = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const teacherId = req.user._id;
    const { sName, sEmail, sPhone, sGender, iGradeId, nAge, iSchool, sSchool, oAddress, oUserDetails, sImage } = req.body;

    // Verify the logged-in user is a teacher (school admin)
    const teacher = await UserModel.findById(teacherId, null, { readPreference: 'primary' });
    if (!teacher || teacher.eRole !== data.eUserRoles.map.TEACHER) {
      return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'accessDenied' });
    }

    // Check if the teacher has a school assigned
    // if (!teacher.iSchool) {
    //   return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'teacherNotAssignedToSchool' });
    // }

    // Check if student email already exists
    const email = sEmail.toLowerCase().trim();
    const existingStudent = await UserModel.findOne({
      sEmail: email,
      eStatus: data.eStatus.map.ACTIVE,
      bDelete: false
    }, null, { readPreference: 'primary' }).lean();

    if (existingStudent) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'emailExists' });
    }

    // Get default password from environment config
    const defaultPassword = DEFAULT_STUDENT_PASSWORD;

    // Create the student user - use teacher's school
    const student = new UserModel({
      eRole: data.eUserRoles.map.STUDENT,
      sName: sName.trim(),
      sEmail: email,
      sPassword: defaultPassword,
      sPhone: sPhone.trim(),
      sImage: sImage,
      iSchool: iSchool || teacherId,
      sSchool: sSchool || undefined,
      iGradeId: iGradeId || undefined,
      oAddress: oAddress || {},
      oUserDetails: {
        ...oUserDetails,
        sGender: sGender,
        nAge: nAge
      },
      bIsEmailVerified: true, // Auto-verify since added by school
      bTermsAndConditions: true,
      eStatus: data.eStatus.map.ACTIVE
    });

    await student.save();

    const subscription = await createFreemiumUserSubscription({ iUserId: student._id });
    if (subscription) {
      student.iSubscriptionId = subscription?._id;
      await student.save();
    }

    // Add student to teacher's children array
    await UserModel.updateOne(
      { _id: teacherId },
      { $addToSet: { aChildren: student._id } }
    );

    // Send invitation email to student (non-blocking)
    sendStudentInvitationEmail({
      studentName: sName.trim(),
      studentEmail: email,
      password: defaultPassword,
      addedBy: 'school'
    }).catch(err => console.error('Failed to send student invitation email:', err));

    // Populate the created student for response
    const populatedStudent = await UserModel.findById(student._id)
      .select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens')
      .populate('aParents', 'sName sEmail sPhone eRole')
      .populate('aChildren', 'sName sEmail sPhone eRole')
      .populate('iSchool', 'sName sAddress sCity sState sCountry')
      .populate({ path: 'iGradeId', model: GradeModel, select: 'sName sDescription' })
      .populate('iSubscriptionId')
      .lean();

    // Add default password to response (not stored in DB)
    const studentData = {
      ...populatedStudent,
      defaultPassword: defaultPassword
    };

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].schoolStudentAddedSuccess || 'Student added successfully. Invitation email sent.',
      data: { student: studentData },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'schoolStudentAddFailed' });
  }
};

/**
 * Update Student by School
 */
const updateStudentBySchool = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const teacherId = req.user._id;
    const { studentId } = req.params;
    const { sName, sEmail, sPhone, sGender, iGradeId, nAge, iSchool, sSchool, oAddress, oUserDetails, sImage } = req.body;

    // Verify the logged-in user is a teacher (school admin)
    const teacher = await UserModel.findById(teacherId, null, { readPreference: 'primary' });
    if (!teacher || teacher.eRole !== data.eUserRoles.map.TEACHER) {
      return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'accessDenied' });
    }

    // Find the student and verify it exists
    const student = await UserModel.findById(studentId, null, { readPreference: 'primary' });
    if (!student) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'userNotFound' });
    }

    // Verify student role
    if (student.eRole !== data.eUserRoles.map.STUDENT) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'invalidUserRole' });
    }

    // Check if the teacher has a school assigned
    // if (!teacher.iSchool) {
    //   return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'teacherNotAssignedToSchool' });
    // }

    // Check if student belongs to the same school as the teacher
    // Since teachers ARE schools themselves, students' iSchool should reference teacher._id
    if (!student.iSchool || !student.iSchool.equals(teacher._id)) {
      return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'studentNotInTeacherSchool' });
    }

    // If email is being updated, check for uniqueness
    if (sEmail && sEmail.toLowerCase().trim() !== student.sEmail) {
      const email = sEmail.toLowerCase().trim();
      const existingStudent = await UserModel.findOne({
        sEmail: email,
        _id: { $ne: studentId },
        eStatus: data.eStatus.map.ACTIVE,
        bDelete: false
      }, null, { readPreference: 'primary' }).lean();

      if (existingStudent) {
        return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'emailExists' });
      }
    }

    // Prepare update data
    const updateData = {};
    if (sName !== undefined) updateData.sName = sName.trim();
    if (sEmail !== undefined) updateData.sEmail = sEmail.toLowerCase().trim();
    if (sPhone !== undefined) updateData.sPhone = sPhone.trim();
    if (iSchool !== undefined) updateData.iSchool = iSchool;
    if (sSchool !== undefined) updateData.sSchool = sSchool;
    if (iGradeId !== undefined) updateData.iGradeId = iGradeId;
    if (oAddress !== undefined) updateData.oAddress = oAddress;
    if (sImage !== undefined) updateData.sImage = sImage;
    if (nAge !== undefined) updateData.nAge = nAge;

    // Handle user details update
    if (oUserDetails !== undefined || sGender !== undefined || nAge !== undefined) {
      const currentUserDetails = student.oUserDetails || {};
      updateData.oUserDetails = {
        ...currentUserDetails,
        ...oUserDetails
      };

      if (sGender !== undefined) updateData.oUserDetails.sGender = sGender;
      if (nAge !== undefined) updateData.oUserDetails.nAge = nAge;
    }

    // Update the student
    const updatedStudent = await UserModel.findByIdAndUpdate(
      studentId,
      updateData,
      { new: true, runValidators: true, readPreference: 'primary' }
    )
      .select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens')
      .populate('aParents', 'sName sEmail sPhone eRole')
      .populate('aChildren', 'sName sEmail sPhone eRole')
      .populate('iSchool', 'sName sAddress sCity sState sCountry')
      .populate({ path: 'iGradeId', model: GradeModel, select: 'sName sDescription' })
      .populate('iSubscriptionId')
      .lean();

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].schoolStudentUpdatedSuccess || 'Student updated successfully',
      data: { student: updatedStudent },
      error: {}
    });
  } catch (error) {
    console.log('updateStudentBySchool error:', error);
    return handleServiceError(error, req, res, { messageKey: 'schoolStudentUpdateFailed' });
  }
};

/**
 * Get Children List by School
 */
const getChildrenBySchool = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const teacherId = req.user._id;
    const { childId, search, limit = 10, start = 0, grade, status: userStatus, filter, isFullResponse, plan } = req.query;

    // Verify the logged-in user is a teacher (school admin)
    const teacher = await UserModel.findById(teacherId, null, { readPreference: 'primary' });
    if (!teacher || teacher.eRole !== data.eUserRoles.map.TEACHER) {
      return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'accessDenied' });
    }

    console.log('teacher', teacher);
    // Check if the teacher has a school assigned
    // if (!teacher.iSchool) {
    //   return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'teacherNotAssignedToSchool' });
    // }

    // Calculate date range based on filter (daily, weekly, monthly) if provided
    const now = new Date();
    let startDate;
    if (filter) {
      switch (filter.toLowerCase()) {
        case 'weekly':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          break;
        case 'monthly':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case 'daily':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        default:
          startDate = null;
          break;
      }
    } else {
      startDate = null;
    }

    // Build query to find students in the teacher's school
    // Since teachers ARE schools, students' iSchool should reference teacher._id
    // Also check students in teacher's aChildren array as a fallback
    const query = {
      $or: [
        { iSchool: teacher._id }, // Students linked via iSchool field
        { _id: { $in: teacher.aChildren || [] } } // Students in teacher's children array
      ],
      eRole: data.eUserRoles.map.STUDENT,
      bDelete: false
      // eStatus: data.eStatus.map.ACTIVE
    };

    // If childId is provided, add it to the query using $and to ensure it matches
    if (childId) {
      query.$and = query.$and || [];
      query.$and.push({ _id: childId });
    }

    // Add search filter if provided
    if (search) {
      const safe = searchRegExp(search);
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { sName: safe },
          { sEmail: safe },
          { sPhone: safe }
        ]
      });
    }

    // Add grade filter if provided
    if (grade) {
      query.iGradeId = grade;
    }

    // Note: School filter is already applied via teacher.iSchool
    // No need for additional school filtering as we only show students from teacher's school

    // Add status filter if provided
    if (userStatus) {
      query.eStatus = userStatus;
    }

    // Add plan filter if provided (filter by subscription eType)
    if (plan) {
      const planValues = String(plan).split(',').map(p => p.trim().toUpperCase());
      const eTypeValues = [];

      planValues.forEach(p => {
        if (p === 'FREEMIUM' || p === 'F') {
          eTypeValues.push(data.eSubscriptionType.map.FREEMIUM);
        } else if (p === 'PREMIUM' || p === 'P') {
          eTypeValues.push(data.eSubscriptionType.map.PREMIUM);
        }
      });

      if (eTypeValues.length > 0) {
        // Find matching subscription IDs
        const matchingSubscriptions = await SubscriptionModel.find({ eType: { $in: eTypeValues } }).select('_id').lean();
        const subscriptionIds = matchingSubscriptions.map(s => s._id);

        if (subscriptionIds.length > 0) {
          query.iSubscriptionId = { $in: subscriptionIds };
        } else {
          // No matching subscriptions found, return empty result
          query.iSubscriptionId = { $in: [] };
        }
      } else {
        // Invalid plan values, return empty result
        query.iSubscriptionId = { $in: [] };
      }
    }

    // Get total count and paginated results
    let total = 0;
    let children = [];

    if ([true, 'true'].includes(isFullResponse)) {
      children = await UserModel.find(query)
        .select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens')
        .populate({ path: 'iGradeId', model: GradeModel, select: 'sName sDescription' })
        .populate('iSchool', 'sName sAddress sCity sState sCountry')
        .populate('iSubscriptionId', 'ePlan eType nSeats eStatus dTrialEndDate dTenewalDate')
        .populate('aParents', 'sName sEmail sPhone eRole')
        .populate('aChildren', 'sName sEmail sPhone eRole') // Populate siblings
        .sort({ dCreatedAt: -1 })
        .lean();
      total = children.length;
    } else {
      [total, children] = await Promise.all([
        UserModel.countDocuments(query),
        UserModel.find(query)
          .select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens')
          .populate({ path: 'iGradeId', model: GradeModel, select: 'sName sDescription' })
          .populate('iSchool', 'sName sAddress sCity sState sCountry')
          .populate('iSubscriptionId', 'ePlan eType nSeats eStatus dTrialEndDate dTenewalDate')
          .populate('aParents', 'sName sEmail sPhone eRole')
          .populate('aChildren', 'sName sEmail sPhone eRole') // Populate siblings
          .sort({ dCreatedAt: -1 })
          .skip(Number(start))
          .limit(Number(limit))
          .lean()
      ]);
    }

    // If no children found, return empty array
    if (total === 0) {
      const responseData = {
        total: 0,
        results: [],
        limit: [true, 'true'].includes(isFullResponse) ? null : Number(limit),
        start: [true, 'true'].includes(isFullResponse) ? null : Number(start)
      };

      // Only add filter info if filter was provided
      if (filter && startDate) {
        responseData.filter = {
          type: filter.toLowerCase(),
          startDate: startDate,
          endDate: now
        };
      }
      if (grade) {
        responseData.grade = String(grade);
      }
      if (userStatus) {
        responseData.status = String(userStatus);
      }
      if (plan) {
        responseData.plan = String(plan);
      }

      return res.status(status.OK).json({
        success: true,
        message: messages[lang].schoolChildrenListSuccess || 'Students list retrieved successfully',
        data: responseData,
        error: {}
      });
    }

    // Add active subjects and watch stats to each child individually
    const childrenIds = children.map(c => c._id);

    // Get watch history stats for each child (including completed videos) with date filter
    const watchHistoryMatch = {
      iUserId: { $in: childrenIds },
      bDelete: { $ne: true }
    };

    // Only add date filter if startDate is provided
    if (startDate) {
      watchHistoryMatch.dLastWatchedAt = { $gte: startDate };
    }

    const watchHistoryStats = await VideoWatchHistoryModel.aggregate([
      {
        $match: watchHistoryMatch
      },
      {
        $addFields: {
          nWatchDurationSeconds: {
            $switch: {
              branches: [
                {
                  case: {
                    $in: [
                      { $type: '$nWatchDuration' },
                      ['double', 'int', 'long', 'decimal']
                    ]
                  },
                  then: {
                    $convert: {
                      input: '$nWatchDuration',
                      to: 'double',
                      onError: 0,
                      onNull: 0
                    }
                  }
                },
                {
                  case: { $eq: [{ $type: '$nWatchDuration' }, 'string'] },
                  then: {
                    $let: {
                      vars: { timeParts: { $split: ['$nWatchDuration', ':'] } },
                      in: {
                        $cond: [
                          { $eq: [{ $size: '$$timeParts' }, 3] },
                          {
                            $add: [
                              {
                                $multiply: [
                                  { $toInt: { $arrayElemAt: ['$$timeParts', 0] } },
                                  3600
                                ]
                              },
                              {
                                $multiply: [
                                  { $toInt: { $arrayElemAt: ['$$timeParts', 1] } },
                                  60
                                ]
                              },
                              { $toInt: { $arrayElemAt: ['$$timeParts', 2] } }
                            ]
                          },
                          {
                            $convert: {
                              input: '$nWatchDuration',
                              to: 'double',
                              onError: 0,
                              onNull: 0
                            }
                          }
                        ]
                      }
                    }
                  }
                }
              ],
              default: 0
            }
          }
        }
      },
      {
        $group: {
          _id: {
            userId: '$iUserId',
            subjectId: '$iSubjectId'
          },
          nVideosWatched: { $sum: 1 },
          nVideosCompleted: {
            $sum: { $cond: ['$bCompleted', 1, 0] }
          },
          nTotalWatchTime: { $sum: '$nWatchDurationSeconds' }
        }
      },
      {
        $group: {
          _id: '$_id.userId',
          subjects: {
            $push: {
              subjectId: '$_id.subjectId',
              nVideosWatched: '$nVideosWatched',
              nVideosCompleted: '$nVideosCompleted',
              nTotalWatchTime: '$nTotalWatchTime'
            }
          },
          nTotalVideosWatched: { $sum: '$nVideosWatched' },
          nTotalWatchTime: { $sum: '$nTotalWatchTime' }
        }
      }
    ]);

    // Create a map of child stats
    const childStatsMap = new Map();
    watchHistoryStats.forEach(stat => {
      childStatsMap.set(stat._id.toString(), {
        subjects: stat.subjects,
        nTotalVideosWatched: stat.nTotalVideosWatched,
        nTotalWatchTime: stat.nTotalWatchTime
      });
    });

    // Get all unique subject IDs from all children's watch history
    const allSubjectIds = [...new Set(
      watchHistoryStats.flatMap(stat => stat.subjects.map(s => s.subjectId))
    )];

    // Fetch subject details
    const subjectDetailsMap = new Map();
    if (allSubjectIds.length > 0) {
      const subjects = await SubjectModel.find({
        _id: { $in: allSubjectIds },
        eStatus: data.eStatus.map.ACTIVE
      })
        .sort({ iOrder: 1 })
        .lean();

      // Fetch grade details for subjects
      const gradeIds = [...new Set(subjects.map(s => s.iGradeId))];
      const grades = await GradeModel.find({ _id: { $in: gradeIds } }, 'sName').lean();
      const gradeMap = new Map(grades.map(g => [g._id.toString(), g]));

      subjects.forEach(subject => {
        subjectDetailsMap.set(subject._id.toString(), {
          ...subject,
          iGradeId: gradeMap.get(subject.iGradeId.toString()) || subject.iGradeId
        });
      });

      // Get video counts for all subjects
      const videoCounts = await VideoModel.aggregate([
        {
          $match: {
            iSubjectId: { $in: allSubjectIds },
            eStatus: data.eStatus.map.ACTIVE,
            bDelete: { $ne: true }
          }
        },
        {
          $group: {
            _id: '$iSubjectId',
            count: { $sum: 1 }
          }
        }
      ]);

      // Add video counts to subject details
      videoCounts.forEach(vc => {
        const subject = subjectDetailsMap.get(vc._id.toString());
        if (subject) {
          subject.nTotalVideos = vc.count;
        }
      });
    }

    // Get total videos per subject for each child's grade (optimized single query)
    const uniqueGradeIds = [...new Set(
      children
        .filter(c => c.iGradeId && c.iGradeId._id)
        .map(c => c.iGradeId._id)
    )];

    // Get video counts grouped by grade and subject
    const gradeSubjectVideoCounts = uniqueGradeIds.length > 0
      ? await VideoModel.aggregate([
        {
          $match: {
            iGradeId: { $in: uniqueGradeIds },
            iSubjectId: { $in: allSubjectIds },
            eStatus: data.eStatus.map.ACTIVE,
            bDelete: { $ne: true }
          }
        },
        {
          $group: {
            _id: {
              gradeId: '$iGradeId',
              subjectId: '$iSubjectId'
            },
            count: { $sum: 1 }
          }
        }
      ])
      : [];

    // Build a map: gradeId -> (subjectId -> videoCount)
    const gradeSubjectVideoMap = new Map();
    gradeSubjectVideoCounts.forEach(item => {
      const gradeId = item._id.gradeId.toString();
      const subjectId = item._id.subjectId.toString();

      if (!gradeSubjectVideoMap.has(gradeId)) {
        gradeSubjectVideoMap.set(gradeId, new Map());
      }
      gradeSubjectVideoMap.get(gradeId).set(subjectId, item.count);
    });

    // Build child-specific maps
    const childGradeSubjectVideoCount = new Map();
    children.forEach(child => {
      if (child.iGradeId && child.iGradeId._id) {
        const gradeId = child.iGradeId._id.toString();
        const childId = child._id.toString();
        childGradeSubjectVideoCount.set(childId, gradeSubjectVideoMap.get(gradeId) || new Map());
      }
    });

    // Enhance each child with their active subjects and stats
    const enhancedChildren = children.map(child => {
      const childId = child._id.toString();
      const stats = childStatsMap.get(childId);

      if (!stats) {
        // No watch history for this child
        return {
          ...child,
          activeSubjects: [],
          completedSubjects: [],
          nTotalVideosWatched: 0,
          nTotalWatchTime: '00:00:00',
          ePlan: (child?.iSubscriptionId?.ePlan || child?.iSubscriptionId?.eType || 'NONE')
        };
      }

      const childSubjectVideoMap = childGradeSubjectVideoCount.get(childId) || new Map();

      // Build active subjects array and completed subjects array for this child
      const activeSubjects = [];
      const completedSubjects = [];

      stats.subjects.forEach(subjectStat => {
        const subjectId = subjectStat.subjectId.toString();
        const subjectDetails = subjectDetailsMap.get(subjectId);
        const totalVideosInSubject = childSubjectVideoMap.get(subjectId) || subjectDetails?.nTotalVideos || 0;

        // Calculate overall progress
        // Completed videos = 100% progress, Watched (not completed) = 50% progress
        let nOverallProgress = 0;
        if (totalVideosInSubject > 0) {
          const nVideosInProgress = subjectStat.nVideosWatched - subjectStat.nVideosCompleted;
          const completedProgress = subjectStat.nVideosCompleted * 100;
          const inProgressContribution = nVideosInProgress * 50;
          nOverallProgress = Math.round((completedProgress + inProgressContribution) / totalVideosInSubject);
        }

        // Convert nTotalWatchTime from seconds (number) to HH:MM:SS format (string)
        const watchTimeSeconds = typeof subjectStat.nTotalWatchTime === 'number'
          ? subjectStat.nTotalWatchTime
          : (typeof subjectStat.nTotalWatchTime === 'string'
            ? parseFloat(subjectStat.nTotalWatchTime) || 0
            : 0);

        const subjectData = {
          ...(subjectDetails || { _id: subjectStat.subjectId }),
          nVideosWatched: subjectStat.nVideosWatched,
          nVideosCompleted: subjectStat.nVideosCompleted,
          nTotalWatchTime: secondsToHHMMSS(watchTimeSeconds),
          nTotalVideos: totalVideosInSubject,
          nOverallProgress
        };

        activeSubjects.push(subjectData);

        // Check if subject is completed (all videos watched and completed)
        if (totalVideosInSubject > 0 && subjectStat.nVideosCompleted >= totalVideosInSubject) {
          completedSubjects.push({
            ...subjectData,
            bCompleted: true,
            nCompletionPercentage: 100
          });
        }
      });

      // Convert nTotalWatchTime from seconds (number) to HH:MM:SS format (string)
      const totalWatchTimeSeconds = typeof stats.nTotalWatchTime === 'number'
        ? stats.nTotalWatchTime
        : (typeof stats.nTotalWatchTime === 'string'
          ? parseFloat(stats.nTotalWatchTime) || 0
          : 0);

      return {
        ...child,
        activeSubjects,
        completedSubjects,
        nTotalVideosWatched: stats.nTotalVideosWatched,
        nTotalWatchTime: secondsToHHMMSS(totalWatchTimeSeconds),
        ePlan: (child?.iSubscriptionId?.ePlan || child?.iSubscriptionId?.eType || 'NONE')
      };
    });

    // Compute activity counts for current result set
    const nActiveStudents = enhancedChildren.reduce((acc, c) => acc + (c.eStatus === 'active' ? 1 : 0), 0);
    const nInactiveStudents = enhancedChildren.length - nActiveStudents;

    const responseData = {
      total: total,
      results: enhancedChildren,
      limit: [true, 'true'].includes(isFullResponse) ? null : Number(limit),
      start: [true, 'true'].includes(isFullResponse) ? null : Number(start),
      stats: {
        nActiveStudents,
        nInactiveStudents
      }
    };

    // Only add filter info if filter was provided
    if (filter && startDate) {
      responseData.filter = {
        type: filter.toLowerCase(),
        startDate: startDate,
        endDate: now
      };
    }
    if (grade) {
      responseData.grade = String(grade);
    }
    if (userStatus) {
      responseData.status = String(userStatus);
    }
    if (plan) {
      responseData.plan = String(plan);
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].schoolChildrenListSuccess || 'Students list retrieved successfully',
      data: responseData,
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'schoolChildrenListFailed' });
  }
};

/**
 * Get recently watched videos by child (for parents and schools)
 */
const getRecentVideosByChild = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const userId = req.user._id;
    const { childId, limit = 20, start = 0, isFullResponse } = req.query;

    // Verify that the requester is a parent or teacher
    const user = await UserModel.findById(userId, 'eRole aChildren iSchool', { readPreference: 'primary' }).lean();

    if (!user) {
      return handleServiceError(null, req, res, {
        statusCode: status.NotFound,
        messageKey: 'userNotFound'
      });
    }

    // Check if user is parent or teacher
    const isParent = user.eRole === data.eUserRoles.map.PARENT;
    const isTeacher = user.eRole === data.eUserRoles.map.TEACHER;

    if (!isParent && !isTeacher) {
      return handleServiceError(null, req, res, {
        statusCode: status.Forbidden,
        messageKey: 'accessDenied'
      });
    }

    // Get list of children/student IDs based on role
    let childrenIds = [];

    if (isParent) {
      // For parents, get from aChildren array
      childrenIds = (user.aChildren || []).map(id => id.toString());
    } else if (isTeacher) {
      // For teachers, check if they have a school assigned
      // if (!user.iSchool) {
      //   return handleServiceError(null, req, res, {
      //     statusCode: status.Forbidden,
      //     messageKey: 'teacherNotAssignedToSchool'
      //   });
      // }

      // Get all students from the teacher's school
      const students = await UserModel.find({
        iSchool: userId,
        eRole: data.eUserRoles.map.STUDENT,
        bDelete: false,
        eStatus: 'active'
      }, '_id', { readPreference: 'primary' }).lean();

      childrenIds = students.map(s => s._id.toString());
    }

    if (childrenIds.length === 0) {
      return res.status(status.OK).json({
        success: true,
        message: messages[lang].noChildrenFound || 'No children found',
        data: {
          total: 0,
          results: [],
          limit: [true, 'true'].includes(isFullResponse) ? null : Number(limit),
          start: [true, 'true'].includes(isFullResponse) ? null : Number(start)
        },
        error: {}
      });
    }

    // If childId is provided, validate it belongs to parent
    let targetChildrenIds = childrenIds;
    if (childId) {
      if (!childrenIds.includes(childId)) {
        return handleServiceError(null, req, res, {
          statusCode: status.Forbidden,
          messageKey: 'accessDenied'
        });
      }
      targetChildrenIds = [childId];
    }

    // Get recently watched videos for all children (or specific child)
    const query = {
      iUserId: { $in: targetChildrenIds },
      bDelete: false
    };

    let total = 0;
    let recentVideos = [];

    if ([true, 'true'].includes(isFullResponse)) {
      recentVideos = await VideoWatchHistoryModel.find(query)
        .sort({ dLastWatchedAt: -1 })
        .lean();
      total = recentVideos.length;
    } else {
      [total, recentVideos] = await Promise.all([
        VideoWatchHistoryModel.countDocuments(query),
        VideoWatchHistoryModel.find(query)
          .sort({ dLastWatchedAt: -1 })
          .skip(Number(start))
          .limit(Number(limit))
          .lean()
      ]);
    }

    // Manually populate for cross-database references
    if (recentVideos.length > 0) {
      const videoIds = [...new Set(recentVideos.map(r => r.iVideoId))];
      const gradeIds = [...new Set(recentVideos.map(r => r.iGradeId))];
      const subjectIds = [...new Set(recentVideos.map(r => r.iSubjectId))];
      const userIds = [...new Set(recentVideos.map(r => r.iUserId.toString()))];

      const [videos, grades, subjects, children] = await Promise.all([
        VideoModel.find({ _id: { $in: videoIds } }, 'sTitle sThumbnailUrl iDuration sUrl sDescription iLibraryId iExternalVideoId').lean(),
        GradeModel.find({ _id: { $in: gradeIds } }, 'sName').lean(),
        SubjectModel.find({ _id: { $in: subjectIds } }, 'sName').lean(),
        UserModel.find({ _id: { $in: userIds } }, 'sName sEmail sImage iGradeId').lean()
      ]);

      const normalizedVideos = videos.map(video => ({
        ...video,
        videoId: video._id,
        libraryId: video.iLibraryId || '',
        externalId: video.iExternalVideoId || ''
      }));
      const videoMap = new Map(normalizedVideos.map(v => [v._id.toString(), v]));
      const gradeMap = new Map(grades.map(g => [g._id.toString(), g]));
      const subjectMap = new Map(subjects.map(s => [s._id.toString(), s]));
      const childMap = new Map(children.map(c => [c._id.toString(), c]));

      recentVideos.forEach(watched => {
        // Ensure duration fields are strings in HH:MM:SS format (not numbers)
        watched.nWatchDuration = watched.nWatchDuration || '00:00:00';
        watched.nTotalDuration = watched.nTotalDuration || '00:00:00';
        watched.nLastPosition = watched.nLastPosition || '00:00:00';

        // Populate references
        watched.iVideoId = videoMap.get(watched.iVideoId.toString()) || watched.iVideoId;
        watched.iGradeId = gradeMap.get(watched.iGradeId.toString()) || watched.iGradeId;
        watched.iSubjectId = subjectMap.get(watched.iSubjectId.toString()) || watched.iSubjectId;

        // Add child information
        const childInfo = childMap.get(watched.iUserId.toString());
        watched.child = childInfo ? {
          _id: childInfo._id,
          sName: childInfo.sName,
          sEmail: childInfo.sEmail,
          sImage: childInfo.sImage,
          iGradeId: childInfo.iGradeId
        } : null;
      });
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].recentVideosRetrieved || 'Recent videos retrieved successfully',
      data: {
        total,
        results: recentVideos,
        limit: [true, 'true'].includes(isFullResponse) ? null : Number(limit),
        start: [true, 'true'].includes(isFullResponse) ? null : Number(start)
      },
      error: {}
    });
  } catch (error) {
    console.log('getRecentVideosByChild error:', error);
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveRecentVideos' });
  }
};

/**
 * Bulk Add Students by School
 */
const bulkAddStudentsBySchool = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const teacherId = req.user._id;
    const { students } = req.body; // Array of student objects

    // Verify the logged-in user is a teacher (school admin)
    const teacher = await UserModel.findById(teacherId, null, { readPreference: 'primary' });
    if (!teacher || teacher.eRole !== data.eUserRoles.map.TEACHER) {
      return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'accessDenied' });
    }

    // Validate that students is an array
    if (!Array.isArray(students) || students.length === 0) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'invalidStudentsArray' });
    }

    // Get default password from environment config
    const defaultPassword = DEFAULT_STUDENT_PASSWORD;

    // PHASE 1: VALIDATION - Check all students for errors before saving anything
    const validationErrors = [];
    const validatedStudents = [];

    for (let i = 0; i < students.length; i++) {
      const studentInput = students[i];
      const { sName, sEmail, sPhone, sGender, sGrade, nAge, iSchool = teacherId, sSchool, oAddress, oUserDetails, sImage } = studentInput;

      // Validate required fields
      if (!sName || !sEmail || !sPhone || !sGrade) {
        validationErrors.push({
          index: i,
          sEmail: sEmail || 'N/A',
          sName: sName || 'N/A',
          reason: messages[lang].missingRequiredFields || 'Missing required fields (sName, sEmail, sPhone, sGrade)'
        });
        continue;
      }

      // Look up grade by name
      const grade = await GradeModel.findOne({
        sName: sGrade.trim(),
        eStatus: data.eStatus.map.ACTIVE
      }, null, { readPreference: 'primary' }).lean();

      if (!grade) {
        validationErrors.push({
          index: i,
          sEmail: sEmail || 'N/A',
          sName: sName || 'N/A',
          reason: messages[lang].gradeNotFound || `Grade "${sGrade}" not found`
        });
        continue;
      }

      // Check if student email already exists
      const email = sEmail.toLowerCase().trim();
      const existingStudent = await UserModel.findOne({
        sEmail: email,
        eStatus: data.eStatus.map.ACTIVE,
        bDelete: false
      }, null, { readPreference: 'primary' }).lean();

      if (existingStudent) {
        validationErrors.push({
          index: i,
          sEmail: email,
          sName: sName || 'N/A',
          reason: messages[lang].emailExists || 'Email already exists. Please use a different email.'
        });
        continue;
      }

      // Store validated student data
      validatedStudents.push({
        index: i,
        sName,
        sEmail: email,
        sPhone,
        sGender,
        sGrade,
        iGradeId: grade._id,
        nAge,
        iSchool,
        sSchool,
        oAddress,
        oUserDetails,
        sImage
      });
    }

    // If there are ANY validation errors, return error response without saving anything
    if (validationErrors.length > 0) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang].bulkStudentsValidationFailed || 'Validation failed. No students were added.',
        data: {
          total: students.length,
          results: [],
          limit: null,
          start: null,
          validationErrors: validationErrors
        },
        error: {
          message: 'All students must pass validation before any can be added to the database.'
        }
      });
    }

    // PHASE 2: EXECUTION - All validations passed, now save to database
    const results = {
      successful: [],
      failed: [],
      skipped: []
    };

    for (const validatedStudent of validatedStudents) {
      try {
        const { sName, sEmail, sPhone, sGender, iGradeId, nAge, iSchool, sSchool, oAddress, oUserDetails, sImage } = validatedStudent;

        // Create the student user - use teacher's ID as school (since teachers ARE schools)
        const student = new UserModel({
          eRole: data.eUserRoles.map.STUDENT,
          sName: sName.trim(),
          sEmail: sEmail,
          sPassword: defaultPassword,
          sPhone: sPhone.trim(),
          sImage: sImage || '',
          iSchool: iSchool || teacher._id, // Use teacher._id as school since teachers ARE schools
          sSchool: sSchool || '',
          iGradeId: iGradeId,
          oAddress: oAddress || {},
          oUserDetails: {
            ...oUserDetails,
            sGender: sGender,
            nAge: nAge
          },
          bIsEmailVerified: true, // Auto-verify since added by school
          bTermsAndConditions: true,
          eStatus: data.eStatus.map.ACTIVE
        });

        await student.save();

        const subscription = await createFreemiumUserSubscription({ iUserId: student._id });
        if (subscription) {
          student.iSubscriptionId = subscription?._id;
          await student.save();
        }

        // Add student to teacher's children array
        await UserModel.updateOne(
          { _id: teacherId },
          { $addToSet: { aChildren: student._id } }
        );

        // Send invitation email to student (non-blocking)
        sendStudentInvitationEmail({
          studentName: sName.trim(),
          studentEmail: sEmail,
          password: defaultPassword,
          addedBy: 'school'
        }).catch(err => console.error('Failed to send student invitation email:', err));

        // Populate the created student for response (similar to single add)
        const populatedStudent = await UserModel.findById(student._id)
          .select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens')
          .populate('aParents', 'sName sEmail sPhone eRole')
          .populate('aChildren', 'sName sEmail sPhone eRole')
          .populate('iSchool', 'sName sAddress sCity sState sCountry')
          .populate({ path: 'iGradeId', model: GradeModel, select: 'sName sDescription' })
          .populate('iSubscriptionId')
          .lean();

        // Add default password to response (not stored in DB)
        const studentData = {
          ...populatedStudent,
          defaultPassword: defaultPassword
        };

        results.successful.push(studentData);
      } catch (error) {
        console.error('Error processing student:', error);
        results.failed.push({
          sEmail: validatedStudent.sEmail,
          sName: validatedStudent.sName,
          reason: error.message || messages[lang].error || 'Unknown error'
        });
      }
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].bulkStudentsAddedSuccess || 'Bulk students processed successfully.',
      data: {
        total: students.length,
        results: results.successful,
        limit: null,
        start: null
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'bulkStudentsAddFailed' });
  }
};

/**
 * Change Single Student Status by School
 */
const changeSingleStudentStatusBySchool = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const teacherId = req.user._id;
    const { studentId } = req.params;
    const statusParam = (req.params.status || '').toLowerCase();

    if (!['active', 'inactive'].includes(statusParam)) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'invalidStatus' });
    }

    // Verify the logged-in user is a teacher (school admin)
    const teacher = await UserModel.findById(teacherId, null, { readPreference: 'primary' });
    if (!teacher || teacher.eRole !== data.eUserRoles.map.TEACHER) {
      return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'accessDenied' });
    }

    // Find the student and verify it exists
    const student = await UserModel.findById(studentId, null, { readPreference: 'primary' });
    if (!student) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'userNotFound' });
    }

    // Verify student role
    if (student.eRole !== data.eUserRoles.map.STUDENT) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'invalidUserRole' });
    }

    // Check if student belongs to the same school as the teacher
    // Since teachers ARE schools themselves, students' iSchool should reference teacher._id
    if (!student.iSchool || !student.iSchool.equals(teacher._id)) {
      return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'studentNotInTeacherSchool' });
    }

    // Update student status
    if (statusParam === 'active') {
      student.eStatus = 'active';
    } else if (statusParam === 'inactive') {
      student.eStatus = 'inactive';
    }

    await student.save();

    // Populate the updated student for response
    const studentData = await UserModel.findById(student._id)
      .select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens')
      .populate('aParents', 'sName sEmail sPhone eRole')
      .populate('aChildren', 'sName sEmail sPhone eRole')
      .populate('iSchool', 'sName sAddress sCity sState sCountry')
      .populate({ path: 'iGradeId', model: GradeModel, select: 'sName sDescription' })
      .populate('iSubscriptionId')
      .lean();

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].userStatusUpdated,
      data: studentData,
      error: {}
    });
  } catch (error) {
    console.error('Error changing student status:', error);
    return handleServiceError(error, req, res, { messageKey: 'errorUpdatingUser' });
  }
};

// Delete user (school only) - soft delete
const deleteUser = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const teacherId = req.user._id;
    const { id } = req.params;

    // Verify the logged-in user is a teacher (school admin)
    const teacher = await UserModel.findById(teacherId, null, { readPreference: 'primary' });
    if (!teacher || teacher.eRole !== data.eUserRoles.map.TEACHER) {
      return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'accessDenied' });
    }

    // Find the student and verify it exists
    const student = await UserModel.findById(id, null, { readPreference: 'primary' });
    if (!student) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'userNotFound' });
    }

    // Verify student role
    if (student.eRole !== data.eUserRoles.map.STUDENT) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'invalidUserRole' });
    }

    // Check if student belongs to the same school as the teacher
    // Since teachers ARE schools themselves, students' iSchool should reference teacher._id
    if (!student.iSchool || !student.iSchool.equals(teacher._id)) {
      return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'studentNotInTeacherSchool' });
    }

    // Perform soft delete
    student.bDelete = true;
    await student.save();

    // Remove student from teacher's (school's) children array
    await UserModel.updateOne(
      { _id: teacherId },
      { $pull: { aChildren: id } }
    );

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].userDeleted,
      data: {},
      error: {}
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return handleServiceError(error, req, res, { messageKey: 'errorDeletingUser' });
  }
};

/**
 * Get recent activity by student (for schools)
 */
const getRecentActivityByStudent = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const teacherId = req.user._id;
    const { studentId, limit = 20, start = 0, isFullResponse } = req.query;

    // Verify the logged-in user is a teacher (school admin)
    const teacher = await UserModel.findById(teacherId, 'eRole aChildren', { readPreference: 'primary' }).lean();

    if (!teacher || teacher.eRole !== data.eUserRoles.map.TEACHER) {
      return handleServiceError(null, req, res, {
        statusCode: status.Forbidden,
        messageKey: 'accessDenied'
      });
    }

    // Get all students from the teacher's school
    const students = await UserModel.find({
      iSchool: teacherId,
      eRole: data.eUserRoles.map.STUDENT,
      bDelete: false,
      eStatus: 'active'
    }, '_id', { readPreference: 'primary' }).lean();

    const studentIds = students.map(s => s._id.toString());

    if (studentIds.length === 0) {
      return res.status(status.OK).json({
        success: true,
        message: messages[lang].noStudentsFound || 'No students found',
        data: {
          total: 0,
          results: [],
          limit: [true, 'true'].includes(isFullResponse) ? null : Number(limit),
          start: [true, 'true'].includes(isFullResponse) ? null : Number(start)
        },
        error: {}
      });
    }

    // If studentId is provided, validate it belongs to the school
    let targetStudentIds = studentIds;
    if (studentId) {
      if (!studentIds.includes(studentId)) {
        return handleServiceError(null, req, res, {
          statusCode: status.Forbidden,
          messageKey: 'accessDenied'
        });
      }
      targetStudentIds = [studentId];
    }

    // Get recent activities for the student(s)
    const ActivityHistoryModel = require('../activityHistory/model');
    const query = {
      iUserId: { $in: targetStudentIds },
      bDelete: false
    };

    let total = 0;
    let activities = [];

    if ([true, 'true'].includes(isFullResponse)) {
      activities = await ActivityHistoryModel.find(query)
        .sort({ dActivityDate: -1 })
        .lean();
      total = activities.length;
    } else {
      [total, activities] = await Promise.all([
        ActivityHistoryModel.countDocuments(query),
        ActivityHistoryModel.find(query)
          .sort({ dActivityDate: -1 })
          .skip(Number(start))
          .limit(Number(limit))
          .lean()
      ]);
    }

    // Get unique user IDs to fetch student details
    const userIds = [...new Set(activities.map(a => a.iUserId.toString()))];

    // Fetch student details
    const studentsDetails = userIds.length > 0
      ? await UserModel.find(
        { _id: { $in: userIds } },
        'sName sEmail sImage iGradeId oStreak'
      )
        .populate({ path: 'iGradeId', model: GradeModel, select: 'sName' })
        .lean()
      : [];

    const studentMap = new Map(studentsDetails.map(s => [s._id.toString(), s]));

    // Enhance activities with student information
    const enhancedActivities = activities.map(activity => {
      const student = studentMap.get(activity.iUserId.toString());

      return {
        ...activity,
        student: student ? {
          _id: student._id,
          sName: student.sName,
          sEmail: student.sEmail,
          sImage: student.sImage || '',
          iGradeId: student.iGradeId,
          oStreak: student.oStreak
        } : null
      };
    });

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].recentActivityRetrieved || 'Recent activity retrieved successfully',
      data: {
        total,
        results: enhancedActivities,
        limit: [true, 'true'].includes(isFullResponse) ? null : Number(limit),
        start: [true, 'true'].includes(isFullResponse) ? null : Number(start)
      },
      error: {}
    });
  } catch (error) {
    console.log('getRecentActivityByStudent error:', error);
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveRecentActivity' });
  }
};

/**
 * Get badges and achievements by student (for schools)
 */
const getBadgesAndAchievementsByStudent = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const teacherId = req.user._id;
    const { studentId, limit = 20, start = 0, isFullResponse } = req.query;

    // Verify the logged-in user is a teacher (school admin)
    const teacher = await UserModel.findById(teacherId, 'eRole aChildren', { readPreference: 'primary' }).lean();

    if (!teacher || teacher.eRole !== data.eUserRoles.map.TEACHER) {
      return handleServiceError(null, req, res, {
        statusCode: status.Forbidden,
        messageKey: 'accessDenied'
      });
    }

    // Get all students from the teacher's school
    const students = await UserModel.find({
      iSchool: teacherId,
      eRole: data.eUserRoles.map.STUDENT,
      bDelete: false,
      eStatus: 'active'
    }, '_id', { readPreference: 'primary' }).lean();

    const studentIds = students.map(s => s._id.toString());

    if (studentIds.length === 0) {
      return res.status(status.OK).json({
        success: true,
        message: messages[lang].noStudentsFound || 'No students found',
        data: {
          total: 0,
          results: [],
          limit: [true, 'true'].includes(isFullResponse) ? null : Number(limit),
          start: [true, 'true'].includes(isFullResponse) ? null : Number(start)
        },
        error: {}
      });
    }

    // If studentId is provided, validate it belongs to the school
    let targetStudentIds = studentIds;
    if (studentId) {
      if (!studentIds.includes(studentId)) {
        return handleServiceError(null, req, res, {
          statusCode: status.Forbidden,
          messageKey: 'accessDenied'
        });
      }
      targetStudentIds = [studentId];
    }

    // Get achievements (highlighted activities) for the student(s)
    const ActivityHistoryModel = require('../activityHistory/model');
    const query = {
      iUserId: { $in: targetStudentIds },
      bHighlight: true,
      bDelete: false
    };

    let total = 0;
    let achievements = [];

    if ([true, 'true'].includes(isFullResponse)) {
      achievements = await ActivityHistoryModel.find(query)
        .sort({ dActivityDate: -1 })
        .lean();
      total = achievements.length;
    } else {
      [total, achievements] = await Promise.all([
        ActivityHistoryModel.countDocuments(query),
        ActivityHistoryModel.find(query)
          .sort({ dActivityDate: -1 })
          .skip(Number(start))
          .limit(Number(limit))
          .lean()
      ]);
    }

    // Get unique user IDs to fetch student details
    const userIds = [...new Set(achievements.map(a => a.iUserId.toString()))];

    // Fetch student details
    const studentsDetails = userIds.length > 0
      ? await UserModel.find(
        { _id: { $in: userIds } },
        'sName sEmail sImage iGradeId oStreak'
      )
        .populate({ path: 'iGradeId', model: GradeModel, select: 'sName' })
        .lean()
      : [];

    const studentMap = new Map(studentsDetails.map(s => [s._id.toString(), s]));

    // Enhance achievements with student information
    const enhancedAchievements = achievements.map(achievement => {
      const student = studentMap.get(achievement.iUserId.toString());

      return {
        ...achievement,
        student: student ? {
          _id: student._id,
          sName: student.sName,
          sEmail: student.sEmail,
          sImage: student.sImage || '',
          iGradeId: student.iGradeId,
          oStreak: student.oStreak
        } : null
      };
    });

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].badgesAndAchievementsRetrieved || 'Badges and achievements retrieved successfully',
      data: {
        total,
        results: enhancedAchievements,
        limit: [true, 'true'].includes(isFullResponse) ? null : Number(limit),
        start: [true, 'true'].includes(isFullResponse) ? null : Number(start)
      },
      error: {}
    });
  } catch (error) {
    console.log('getBadgesAndAchievementsByStudent error:', error);
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveBadgesAndAchievements' });
  }
};

/**
 * Get completed courses by student (for schools)
 */
const getCompletedCoursesByStudent = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const teacherId = req.user._id;
    const { studentId, limit = 20, start = 0, isFullResponse } = req.query;

    // Verify the logged-in user is a teacher (school admin)
    const teacher = await UserModel.findById(teacherId, 'eRole aChildren', { readPreference: 'primary' }).lean();

    if (!teacher || teacher.eRole !== data.eUserRoles.map.TEACHER) {
      return handleServiceError(null, req, res, {
        statusCode: status.Forbidden,
        messageKey: 'accessDenied'
      });
    }

    // Get all students from the teacher's school
    const students = await UserModel.find({
      iSchool: teacherId,
      eRole: data.eUserRoles.map.STUDENT,
      bDelete: false,
      eStatus: 'active'
    }, '_id iGradeId', { readPreference: 'primary' }).lean();

    const studentIds = students.map(s => s._id.toString());

    if (studentIds.length === 0) {
      return res.status(status.OK).json({
        success: true,
        message: messages[lang].noStudentsFound || 'No students found',
        data: {
          total: 0,
          results: [],
          limit: [true, 'true'].includes(isFullResponse) ? null : Number(limit),
          start: [true, 'true'].includes(isFullResponse) ? null : Number(start)
        },
        error: {}
      });
    }

    // If studentId is provided, validate it belongs to the school
    let targetStudentIds = studentIds;
    if (studentId) {
      if (!studentIds.includes(studentId)) {
        return handleServiceError(null, req, res, {
          statusCode: status.Forbidden,
          messageKey: 'accessDenied'
        });
      }
      targetStudentIds = [studentId];
    }

    // Get completed subjects for each student
    const completedSubjects = await VideoWatchHistoryModel.aggregate([
      {
        $match: {
          iUserId: { $in: targetStudentIds.map(id => VideoWatchHistoryModel.base.mongo.ObjectId(id)) },
          bCompleted: true,
          bDelete: false
        }
      },
      {
        $group: {
          _id: {
            userId: '$iUserId',
            subjectId: '$iSubjectId'
          },
          nVideosCompleted: { $sum: 1 }
        }
      }
    ]);

    // Get all unique subject IDs
    const subjectIds = [...new Set(completedSubjects.map(cs => cs._id.subjectId))];

    // Get total video counts per subject
    const subjectVideoCounts = await VideoModel.aggregate([
      {
        $match: {
          iSubjectId: { $in: subjectIds },
          eStatus: data.eStatus.map.ACTIVE,
          bDelete: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$iSubjectId',
          totalVideos: { $sum: 1 }
        }
      }
    ]);

    const subjectVideoCountMap = new Map(
      subjectVideoCounts.map(svc => [svc._id.toString(), svc.totalVideos])
    );

    // Filter for fully completed subjects (all videos completed)
    const fullyCompletedSubjects = completedSubjects.filter(cs => {
      const subjectId = cs._id.subjectId.toString();
      const totalVideos = subjectVideoCountMap.get(subjectId) || 0;
      return totalVideos > 0 && cs.nVideosCompleted >= totalVideos;
    });

    // Fetch subject details
    const completedSubjectIds = [...new Set(fullyCompletedSubjects.map(cs => cs._id.subjectId))];
    const subjects = completedSubjectIds.length > 0
      ? await SubjectModel.find({
        _id: { $in: completedSubjectIds },
        eStatus: data.eStatus.map.ACTIVE
      })
        .populate({ path: 'iGradeId', model: GradeModel, select: 'sName' })
        .lean()
      : [];

    const subjectMap = new Map(subjects.map(s => [s._id.toString(), s]));

    // Fetch student details
    const userIds = [...new Set(fullyCompletedSubjects.map(cs => cs._id.userId.toString()))];
    const studentsDetails = userIds.length > 0
      ? await UserModel.find(
        { _id: { $in: userIds } },
        'sName sEmail sImage iGradeId'
      )
        .populate({ path: 'iGradeId', model: GradeModel, select: 'sName' })
        .lean()
      : [];

    const studentMap = new Map(studentsDetails.map(s => [s._id.toString(), s]));

    // Build completed courses data
    const completedCourses = fullyCompletedSubjects.map(cs => {
      const subjectId = cs._id.subjectId.toString();
      const userId = cs._id.userId.toString();
      const subject = subjectMap.get(subjectId);
      const student = studentMap.get(userId);

      return {
        student: student ? {
          _id: student._id,
          sName: student.sName,
          sEmail: student.sEmail,
          sImage: student.sImage || '',
          iGradeId: student.iGradeId
        } : null,
        subject: subject || { _id: cs._id.subjectId },
        nVideosCompleted: cs.nVideosCompleted,
        nTotalVideos: subjectVideoCountMap.get(subjectId) || 0,
        nCompletionPercentage: 100
      };
    });

    // Apply pagination
    const total = completedCourses.length;
    let paginatedResults = completedCourses;

    if (![true, 'true'].includes(isFullResponse)) {
      paginatedResults = completedCourses.slice(Number(start), Number(start) + Number(limit));
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].completedCoursesRetrieved || 'Completed courses retrieved successfully',
      data: {
        total,
        results: paginatedResults,
        limit: [true, 'true'].includes(isFullResponse) ? null : Number(limit),
        start: [true, 'true'].includes(isFullResponse) ? null : Number(start)
      },
      error: {}
    });
  } catch (error) {
    console.log('getCompletedCoursesByStudent error:', error);
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveCompletedCourses' });
  }
};

module.exports = {
  addStudentBySchool,
  updateStudentBySchool,
  getChildrenBySchool,
  getRecentVideosByChild,
  getRecentActivityByStudent,
  getBadgesAndAchievementsByStudent,
  getCompletedCoursesByStudent,
  bulkAddStudentsBySchool,
  changeSingleStudentStatusBySchool,
  deleteUser
};
