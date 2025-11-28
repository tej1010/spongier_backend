const { messages, status } = require('../../../helper/api.responses');
const { handleServiceError, getPaginationValues2, secondsToHHMMSS } = require('../../../helper/utilities.services');
const UserModel = require('../model');
const GradeModel = require('../../course/grades/model');
const SubjectModel = require('../../course/subjects/model');
const VideoModel = require('../../course/videos/model');
const VideoWatchHistoryModel = require('../../course/videos/watchHistory/model');
const data = require('../../../data');
const { DEFAULT_STUDENT_PASSWORD } = require('../../../config/defaultConfig');
const { sendStudentInvitationEmail } = require('../../../helper/mail.services');
const { createFreemiumUserSubscription } = require('../../subscription/common');

/**
 * Parent-Specific Services
 * Handles parent operations for managing children accounts
 */

/**
 * Add Student by Parent
 */
const addStudentByParent = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const parentId = req.user._id;
    const { sName, sEmail, sPhone, sGender, iGradeId, nAge, iSchool, sSchool, oAddress, oUserDetails, sImage } = req.body;

    // Verify the logged-in user is a parent
    const parent = await UserModel.findById(parentId, null, { readPreference: 'primary' });
    if (!parent || parent.eRole !== data.eUserRoles.map.PARENT) {
      return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'accessDenied' });
    }

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

    // Create the student user
    const student = new UserModel({
      eRole: data.eUserRoles.map.STUDENT,
      sName: sName.trim(),
      sEmail: email,
      sPassword: defaultPassword,
      sPhone: sPhone.trim(),
      sImage: sImage,
      iSchool: iSchool || undefined,
      sSchool: sSchool || undefined,
      iGradeId: iGradeId || undefined,
      aParents: [parentId],
      oAddress: oAddress || {},
      oUserDetails: {
        ...oUserDetails,
        sGender: sGender,
        nAge: nAge
      },
      bIsEmailVerified: true, // Auto-verify since added by parent
      bTermsAndConditions: true,
      eStatus: data.eStatus.map.ACTIVE
    });

    await student.save();

    const subscription = await createFreemiumUserSubscription({ iUserId: student._id });
    if (subscription) {
      student.iSubscriptionId = subscription?._id;
      await student.save();
    }

    // Add student to parent's children array
    await UserModel.updateOne(
      { _id: parentId },
      { $addToSet: { aChildren: student._id } }
    );

    // Send invitation email to student (non-blocking)
    sendStudentInvitationEmail({
      studentName: sName.trim(),
      studentEmail: email,
      password: defaultPassword,
      addedBy: 'parent'
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
      message: messages[lang].studentAddedSuccess || 'Student added successfully. Invitation email sent.',
      data: { student: studentData },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'studentAddFailed' });
  }
};

/**
 * Update Student by Parent
 */
const updateStudentByParent = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const parentId = req.user._id;
    const { childId } = req.params;
    const { sName, sEmail, sPhone, sGender, iGradeId, nAge, iSchool, sSchool, oAddress, oUserDetails, sImage } = req.body;

    // Verify the logged-in user is a parent
    const parent = await UserModel.findById(parentId, null, { readPreference: 'primary' });
    if (!parent || parent.eRole !== data.eUserRoles.map.PARENT) {
      return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'accessDenied' });
    }

    // Find the student and verify it belongs to this parent
    const student = await UserModel.findById(childId, null, { readPreference: 'primary' });
    if (!student) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'userNotFound' });
    }

    // Check if student belongs to this parent
    if (!student.aParents.includes(parentId)) {
      return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'accessDenied' });
    }

    // If email is being updated, check for uniqueness
    if (sEmail && sEmail.toLowerCase().trim() !== student.sEmail) {
      const email = sEmail.toLowerCase().trim();
      const existingStudent = await UserModel.findOne({
        sEmail: email,
        _id: { $ne: childId },
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
      childId,
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
      message: messages[lang].studentUpdatedSuccess || 'Student updated successfully',
      data: { student: updatedStudent },
      error: {}
    });
  } catch (error) {
    console.log('updateStudentByParent error:', error);
    return handleServiceError(error, req, res, { messageKey: 'studentUpdateFailed' });
  }
};

/**
 * Get Children List by Parent
 */
const getChildrenByParent = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const parentId = req.user._id;
    const { childId, search, limit = 10, start = 0, grade, school, status: userStatus, filter = 'daily', isFullResponse } = req.query;

    // Verify the logged-in user is a parent
    const parent = await UserModel.findById(parentId, null, { readPreference: 'primary' });
    if (!parent || parent.eRole !== data.eUserRoles.map.PARENT) {
      return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'accessDenied' });
    }

    // Calculate date range based on filter (daily, weekly, monthly)
    const now = new Date();
    let startDate;
    switch (filter.toLowerCase()) {
      case 'weekly':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case 'daily':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
    }

    // Get children IDs from parent's aChildren array
    const parentChildrenIds = Array.isArray(parent.aChildren) ? parent.aChildren : [];

    // If parent has no children, return empty result
    if (parentChildrenIds.length === 0) {
      return res.status(status.OK).json({
        success: true,
        message: messages[lang].childrenListSuccess || 'Children list retrieved successfully',
        data: {
          total: 0,
          results: [],
          limit: Number(limit),
          start: Number(start),
          filter: {
            type: filter.toLowerCase(),
            startDate: startDate,
            endDate: now
          }
        },
        error: {}
      });
    }

    // If childId is provided, verify it belongs to this parent
    if (childId) {
      const isChildLinked = parentChildrenIds.some(id => id.toString() === childId.toString());
      if (!isChildLinked) {
        return handleServiceError(null, req, res, {
          statusCode: status.Forbidden,
          messageKey: 'childNotLinkedToParent'
        });
      }
    }

    // Build query to find ONLY children in parent's aChildren array
    const query = {
      _id: childId || { $in: parentChildrenIds },
      eRole: data.eUserRoles.map.STUDENT,
      bDelete: false
    };

    // Add search filter if provided
    if (search) {
      const { searchRegExp } = require('../../../helper/utilities.services');
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

    // Add school filter if provided
    if (school) {
      query.iSchool = school; // Now expects ObjectId
    }

    // Add status filter if provided
    if (userStatus) {
      query.eStatus = userStatus;
    }

    // Get total count and paginated results
    let total = 0;
    let children = [];

    if ([true, 'true'].includes(isFullResponse)) {
      children = await UserModel.find(query)
        .select('-sPassword -sOtp -dOtpExpiration -aRefreshTokens')
        .populate({ path: 'iGradeId', model: GradeModel, select: 'sName sDescription' })
        .populate('iSchool', 'sName sAddress sCity sState sCountry')
        .populate('iSubscriptionId', 'eType nSeats eStatus dTrialEndDate dTenewalDate')
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
          .populate('iSubscriptionId', 'eType nSeats eStatus dTrialEndDate dTenewalDate')
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
      return res.status(status.OK).json({
        success: true,
        message: messages[lang].childrenListSuccess || 'Children list retrieved successfully',
        data: {
          total: 0,
          results: [],
          limit: [true, 'true'].includes(isFullResponse) ? null : Number(limit),
          start: [true, 'true'].includes(isFullResponse) ? null : Number(start),
          filter: {
            type: filter.toLowerCase(),
            startDate: startDate,
            endDate: now
          }
        },
        error: {}
      });
    }

    // Add active subjects and watch stats to each child individually
    const childrenIds = children.map(c => c._id);

    // Get watch history stats for each child (including completed videos) with date filter
    const watchHistoryStats = await VideoWatchHistoryModel.aggregate([
      {
        $match: {
          iUserId: { $in: childrenIds },
          bDelete: { $ne: true },
          dLastWatchedAt: { $gte: startDate }
        }
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
          nTotalWatchTime: '00:00:00'
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
        nTotalWatchTime: secondsToHHMMSS(totalWatchTimeSeconds)
      };
    });

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].childrenListSuccess || 'Children list retrieved successfully',
      data: {
        total,
        results: enhancedChildren,
        limit: [true, 'true'].includes(isFullResponse) ? null : Number(limit),
        start: [true, 'true'].includes(isFullResponse) ? null : Number(start),
        filter: {
          type: filter.toLowerCase(),
          startDate: startDate,
          endDate: now
        }
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'childrenListFailed' });
  }
};

/**
 * Get recently watched videos by child (for parents and schools)
 */
const getRecentVideosByChild = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const userId = req.user._id;
    const { childId } = req.query;
    const { limit = 20, start = 0 } = getPaginationValues2(req.query);

    // Verify that the requester is a parent or teacher (school)
    const user = await UserModel.findById(userId, 'eRole aChildren', { readPreference: 'primary' }).lean();

    if (!user) {
      return handleServiceError(null, req, res, {
        statusCode: status.NotFound,
        messageKey: 'userNotFound'
      });
    }

    // Check if user is parent or teacher (school)
    const isParent = user.eRole === data.eUserRoles.map.PARENT;
    const isTeacher = user.eRole === data.eUserRoles.map.TEACHER;
    const isAllowedRole = isParent || isTeacher;
    if (!isAllowedRole) {
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
      // For teachers (schools), get students linked via iSchool or aChildren
      // Use the same logic as getChildrenBySchool
      const students = await UserModel.find({
        $or: [
          { iSchool: userId }, // Students linked via iSchool field
          { _id: { $in: user.aChildren || [] } } // Students in teacher's children array
        ],
        eRole: data.eUserRoles.map.STUDENT,
        bDelete: false
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
          limit: Number(limit),
          start: Number(start)
        },
        error: {}
      });
    }

    // If childId is provided, validate it belongs to parent/school
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

    const [total, recentVideos] = await Promise.all([
      VideoWatchHistoryModel.countDocuments(query),
      VideoWatchHistoryModel.find(query)
        .sort({ dLastWatchedAt: -1 })
        .skip(Number(start))
        .limit(Number(limit))
        .lean()
    ]);

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
        limit: Number(limit),
        start: Number(start)
      },
      error: {}
    });
  } catch (error) {
    console.log('getRecentVideosByChild error:', error);
    return handleServiceError(error, req, res, { messageKey: 'failedToRetrieveRecentVideos' });
  }
};

/**
 * Delete Student by Parent - soft delete
 */
const deleteStudentByParent = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const parentId = req.user._id;
    const { id: childId } = req.params;

    // Verify the logged-in user is a parent
    const parent = await UserModel.findById(parentId, null, { readPreference: 'primary' });
    if (!parent || parent.eRole !== data.eUserRoles.map.PARENT) {
      return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'accessDenied' });
    }

    // Find the student and verify it exists
    const student = await UserModel.findById(childId, null, { readPreference: 'primary' });
    if (!student) {
      return handleServiceError(null, req, res, { statusCode: status.NotFound, messageKey: 'userNotFound' });
    }

    // Verify student role
    if (student.eRole !== data.eUserRoles.map.STUDENT) {
      return handleServiceError(null, req, res, { statusCode: status.BadRequest, messageKey: 'invalidUserRole' });
    }

    // Check if student belongs to this parent
    if (!student.aParents || !student.aParents.includes(parentId)) {
      return handleServiceError(null, req, res, { statusCode: status.Forbidden, messageKey: 'accessDenied' });
    }

    // Perform soft delete
    student.bDelete = true;
    await student.save();

    // Remove student from parent's children array
    await UserModel.updateOne(
      { _id: parentId },
      { $pull: { aChildren: student._id } }
    );

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].userDeleted || 'Student deleted successfully',
      data: {},
      error: {}
    });
  } catch (error) {
    console.error('Error deleting student by parent:', error);
    return handleServiceError(error, req, res, { messageKey: 'errorDeletingUser' });
  }
};

module.exports = {
  addStudentByParent,
  updateStudentByParent,
  getChildrenByParent,
  getRecentVideosByChild,
  deleteStudentByParent
};
