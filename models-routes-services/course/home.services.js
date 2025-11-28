// home.services.js
const { status, messages } = require('../../helper/api.responses');
const { handleServiceError, ObjectId } = require('../../helper/utilities.services');
const GradeModel = require('./grades/model');
const SubjectModel = require('./subjects/model');
const VideoModel = require('./videos/model');
const TermModel = require('./terms/model');
const BookmarkModel = require('./bookmarks/model');
const VideoWatchHistoryModel = require('./videos/watchHistory/model');
const VideoLikeModel = require('./videos/likes/model');
const UserModel = require('../user/model');
const { getSeoDataForRecords, getSeoDataForRecord } = require('../../helper/seo.helper');
const SeoModel = require('../seo/model');
const data = require('../../data');

// Helper function to add SEO data to explore response
const addSeoDataToExploreResponse = async (gradesWithData) => {
  try {
    // Collect all IDs for batch SEO queries
    const gradeIds = gradesWithData.map(g => g._id);
    const subjectIds = gradesWithData.reduce((acc, grade) => {
      return acc.concat(grade.subjects.map(s => s._id));
    }, []);
    const termIds = gradesWithData.reduce((acc, grade) => {
      return acc.concat(grade.subjects.reduce((subAcc, subject) => {
        return subAcc.concat(subject.terms.map(t => t._id));
      }, []));
    }, []);
    const videoIds = gradesWithData.reduce((acc, grade) => {
      return acc.concat(grade.subjects.reduce((subAcc, subject) => {
        return subAcc.concat(subject.videos.map(v => v._id));
      }, []));
    }, []);

    // Fetch SEO data for all entities in parallel
    const [gradeSeoData, subjectSeoData, termSeoData, videoSeoData] = await Promise.all([
      // Grade SEO data
      SeoModel.find({
        eType: data.eSeoType.map.GRADE,
        iId: { $in: gradeIds },
        eStatus: 'active'
      }, { iId: 1, sSlug: 1 }).lean(),
      // Subject SEO data
      subjectIds.length > 0 ? SeoModel.find({
        eType: data.eSeoType.map.SUBJECT,
        iId: { $in: subjectIds },
        eStatus: 'active'
      }, { iId: 1, sSlug: 1 }).lean() : [],
      // Term SEO data
      termIds.length > 0 ? SeoModel.find({
        eType: data.eSeoType.map.TERM,
        iId: { $in: termIds },
        eStatus: 'active'
      }, { iId: 1, sSlug: 1 }).lean() : [],
      // Video SEO data
      videoIds.length > 0 ? SeoModel.find({
        eType: data.eSeoType.map.VIDEO,
        iId: { $in: videoIds },
        eStatus: 'active'
      }, { iId: 1, sSlug: 1 }).lean() : []
    ]);

    // Create SEO maps for quick lookup
    const createSeoMap = (seoData) => {
      const map = new Map();
      seoData.forEach(seo => {
        map.set(String(seo.iId), {
          seoId: seo._id,
          slug: seo.sSlug
        });
      });
      return map;
    };

    const gradeSeoMap = createSeoMap(gradeSeoData);
    const subjectSeoMap = createSeoMap(subjectSeoData);
    const termSeoMap = createSeoMap(termSeoData);
    const videoSeoMap = createSeoMap(videoSeoData);

    // Add SEO data to the response
    return gradesWithData.map(grade => {
      const gradeSeo = gradeSeoMap.get(String(grade._id));
      return {
        ...grade,
        seo: gradeSeo || null,
        subjects: grade.subjects.map(subject => {
          const subjectSeo = subjectSeoMap.get(String(subject._id));
          return {
            ...subject,
            seo: subjectSeo || null,
            terms: subject.terms.map(term => {
              const termSeo = termSeoMap.get(String(term._id));
              return {
                ...term,
                seo: termSeo || null
              };
            }),
            videos: subject.videos.map(video => {
              const videoSeo = videoSeoMap.get(String(video._id));
              return {
                ...video,
                seo: videoSeo || null
              };
            })
          };
        })
      };
    });
  } catch (error) {
    console.error('Error adding SEO data to explore response:', error);
    // Return original data if SEO fetch fails
    return gradesWithData.map(grade => ({
      ...grade,
      seo: null,
      subjects: grade.subjects.map(subject => ({
        ...subject,
        seo: null,
        terms: subject.terms.map(term => ({ ...term, seo: null })),
        videos: subject.videos.map(video => ({ ...video, seo: null }))
      }))
    }));
  }
};

// GET home page with gradeWiseSubjects, featuredCourse, myLearning, and popularInGrade
const getHomePage = async (req, res) => {
  const lang = req.userLanguage;
  try {
    // Helper mappers to restrict fields and align names
    const mapGrade = (g) => ({
      _id: g._id,
      name: g.sName,
      image: g.sImage || '',
      description: g.sDescription || ''
      // order: g.iOrder
    });
    const mapSubject = (s) => ({
      _id: s._id,
      name: s.sName,
      image: s.sImage || '',
      featureImage: s.sFeatureImage || '',
      // description: s.sDescription || '',
      // order: s.iOrder,
      teacherName: s.sTeacher || '',

      gradeId: s.iGradeId || null
    });
    const mapVideo = (v) => ({
      _id: v._id,
      videoId: v._id,
      name: v.sTitle,
      image: v.sThumbnailUrl || '',
      views: v.nViewCount || 0,
      likes: v.nLikeCount || 0,
      libraryId: v.iLibraryId || '',
      externalId: v.iExternalVideoId || ''
    });

    const isUserLoggedIn = !!req?.user?._id;

    // 1) GRADE WISE SUBJECTS - All grades with ALL their subjects (sorted by order)
    const allActiveGrades = await GradeModel.find({ eStatus: 'active' })
      .sort({ iOrder: 1 })
      .lean();

    const allGradeIds = allActiveGrades.map(g => g._id);

    // Get all subjects for all grades, grouped by grade
    const subjectsForAllGrades = await SubjectModel.aggregate([
      { $match: { iGradeId: { $in: allGradeIds }, eStatus: 'active' } },
      { $sort: { iOrder: 1 } },
      {
        $group: {
          _id: '$iGradeId',
          subjects: { $push: '$$ROOT' }
        }
      }
    ]);

    const gradeIdToSubjects = new Map(subjectsForAllGrades.map(row => [String(row._id), row.subjects]));

    // Get video counts for each grade
    const videoCountsByGrade = await VideoModel.aggregate([
      {
        $match: {
          iGradeId: { $in: allGradeIds },
          eStatus: 'active',
          bDelete: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$iGradeId',
          videoCount: { $sum: 1 }
        }
      }
    ]);

    const gradeIdToVideoCount = new Map(videoCountsByGrade.map(row => [String(row._id), row.videoCount]));

    const gradeWiseSubjects = allActiveGrades.map(g => {
      const subjects = gradeIdToSubjects.get(String(g._id)) || [];
      return {
        ...mapGrade(g),
        subjectCount: subjects.length,
        videoCount: gradeIdToVideoCount.get(String(g._id)) || 0,
        subjects: subjects.map(mapSubject)
      };
    });

    // 2) FEATURED COURSE - Featured subjects top 5 (bFeature: true, no SEO)
    const featuredSubjects = await SubjectModel.find({ eStatus: 'active', bFeature: true })
      .sort({ iOrder: 1 })
      .limit(5)
      .lean();

    const featuredCourse = featuredSubjects.map(mapSubject);

    // 3) MY LEARNING - 5 recent videos watched by user (if logged in, else null)
    let myLearning = null;
    if (isUserLoggedIn) {
      const recentWatchHistory = await VideoWatchHistoryModel.find({
        iUserId: ObjectId(req.user._id),
        bDelete: false
      })
        .sort({ dLastWatchedAt: -1 })
        .limit(5)
        .select('iVideoId')
        .lean();

      if (recentWatchHistory.length > 0) {
        const recentVideoIds = recentWatchHistory.map(h => h.iVideoId);
        const recentVideos = await VideoModel.find({
          _id: { $in: recentVideoIds },
          eStatus: 'active',
          bDelete: { $ne: true }
        })
          .select('_id sTitle sThumbnailUrl sDescription iOrder nLikeCount nViewCount iLibraryId iExternalVideoId iTermId')
          .lean();

        // Get term details for myLearning videos
        const termIds = [...new Set(recentVideos.map(v => v.iTermId).filter(Boolean))];
        const terms = termIds.length > 0 ? await TermModel.find({ _id: { $in: termIds } }).select('_id sName').lean() : [];
        const termMap = new Map(terms.map(t => [String(t._id), t]));

        // Sort videos in the order they were watched
        const videoMap = new Map(recentVideos.map(v => [String(v._id), v]));
        myLearning = recentWatchHistory
          .map(h => videoMap.get(String(h.iVideoId)))
          .filter(v => v) // Remove any null/undefined values
          .map(v => {
            const term = termMap.get(String(v.iTermId));
            return {
              ...mapVideo(v),
              termName: term?.sName || ''
            };
          });
      }
    }

    // 4) POPULAR IN GRADE - Based on login status
    let popularInGrade = [];
    if (isUserLoggedIn) {
      // If logged in: get popular videos from user's grade based on likes and watch count
      // Fetch user's grade from database since JWT token doesn't contain it
      const user = await UserModel.findById(req.user._id).select('iGradeId').lean();
      const userGrade = user?.iGradeId;

      if (userGrade) {
        const popularVideos = await VideoModel.find({
          iGradeId: ObjectId(userGrade),
          eStatus: 'active',
          bDelete: { $ne: true }
        })
          .sort({ nLikeCount: -1, nViewCount: -1 })
          .limit(5)
          .select('_id sTitle sThumbnailUrl sDescription iOrder iGradeId iSubjectId iTermId nLikeCount nViewCount iLibraryId iExternalVideoId')
          .lean();

        if (popularVideos.length > 0) {
          // Get grade, subject and term details for these videos
          const subjectIds = [...new Set(popularVideos.map(v => v.iSubjectId))];
          const termIds = [...new Set(popularVideos.map(v => v.iTermId))];

          const [gradeInfo, subjects, terms] = await Promise.all([
            GradeModel.findById(userGrade).select('sName').lean(),
            SubjectModel.find({ _id: { $in: subjectIds } }).lean(),
            TermModel.find({ _id: { $in: termIds } }).lean()
          ]);

          const subjectMap = new Map(subjects.map(s => [String(s._id), s]));
          const termMap = new Map(terms.map(t => [String(t._id), t]));

          popularInGrade = popularVideos.map(v => {
            const subject = subjectMap.get(String(v.iSubjectId));
            const term = termMap.get(String(v.iTermId));
            return {
              ...mapVideo(v),
              gradeName: gradeInfo?.sName || '',
              subjectName: subject?.sName || '',
              termName: term?.sName || ''
            };
          });
        }
      }
    } else {
      // If not logged in: get popular videos based on likes and watch count
      const popularVideos = await VideoModel.find({
        eStatus: 'active',
        bDelete: { $ne: true }
      })
        .sort({ nLikeCount: -1, nViewCount: -1 })
        .limit(5)
        .select('_id sTitle sThumbnailUrl sDescription iOrder iGradeId iSubjectId iTermId nLikeCount nViewCount iLibraryId iExternalVideoId')
        .lean();

      if (popularVideos.length > 0) {
        // Get grade, subject and term details for these videos
        const gradeIds = [...new Set(popularVideos.map(v => v.iGradeId))];
        const subjectIds = [...new Set(popularVideos.map(v => v.iSubjectId))];
        const termIds = [...new Set(popularVideos.map(v => v.iTermId))];

        const [grades, subjects, terms] = await Promise.all([
          GradeModel.find({ _id: { $in: gradeIds } }).lean(),
          SubjectModel.find({ _id: { $in: subjectIds } }).lean(),
          TermModel.find({ _id: { $in: termIds } }).lean()
        ]);

        const gradeMap = new Map(grades.map(g => [String(g._id), g]));
        const subjectMap = new Map(subjects.map(s => [String(s._id), s]));
        const termMap = new Map(terms.map(t => [String(t._id), t]));

        popularInGrade = popularVideos.map(v => {
          const grade = gradeMap.get(String(v.iGradeId));
          const subject = subjectMap.get(String(v.iSubjectId));
          const term = termMap.get(String(v.iTermId));
          return {
            ...mapVideo(v),
            gradeName: grade?.sName || '',
            subjectName: subject?.sName || '',
            termName: term?.sName || ''
          };
        });
      }
    }

    // Add isBookmarked and isLiked flags to popularInGrade videos
    if (popularInGrade.length > 0) {
      if (isUserLoggedIn) {
        // For logged-in users, check bookmarks and likes
        const popularVideoIds = popularInGrade.map(v => ObjectId(v._id));
        const [bookmarks, likes] = await Promise.all([
          BookmarkModel.find({
            iUserId: ObjectId(req.user._id),
            iVideoId: { $in: popularVideoIds },
            bDelete: false
          }, { iVideoId: 1 }).lean(),
          VideoLikeModel.find({
            iUserId: ObjectId(req.user._id),
            iVideoId: { $in: popularVideoIds },
            bDelete: false
          }, { iVideoId: 1 }, { readPreference: 'primary' }).lean()
        ]);
        const bookmarkedSet = new Set(bookmarks.map(b => String(b.iVideoId)));
        const likedSet = new Set(likes.map(l => String(l.iVideoId)));
        popularInGrade = popularInGrade.map(v => ({
          ...v,
          isBookmarked: bookmarkedSet.has(String(v._id)),
          isLiked: likedSet.has(String(v._id))
        }));
      } else {
        // For guest users, all videos are not bookmarked or liked
        popularInGrade = popularInGrade.map(v => ({ ...v, isBookmarked: false, isLiked: false }));
      }
    }

    // Add isBookmarked and isLiked flags to myLearning videos if user is logged in
    if (myLearning && myLearning.length > 0) {
      const myLearningVideoIds = myLearning.map(v => ObjectId(v._id));
      const [bookmarks, likes] = await Promise.all([
        BookmarkModel.find({
          iUserId: ObjectId(req.user._id),
          iVideoId: { $in: myLearningVideoIds },
          bDelete: false
        }, { iVideoId: 1 }).lean(),
        VideoLikeModel.find({
          iUserId: ObjectId(req.user._id),
          iVideoId: { $in: myLearningVideoIds },
          bDelete: false
        }, { iVideoId: 1 }, { readPreference: 'primary' }).lean()
      ]);
      const bookmarkedSet = new Set(bookmarks.map(b => String(b.iVideoId)));
      const likedSet = new Set(likes.map(l => String(l.iVideoId)));
      myLearning = myLearning.map(v => ({
        ...v,
        isBookmarked: bookmarkedSet.has(String(v._id)),
        isLiked: likedSet.has(String(v._id))
      }));
    }

    // Build response data based on login status
    const responseData = {
      gradeWiseSubjects,
      featuredCourse,
      myLearning
    };

    // Add different key based on login status
    if (isUserLoggedIn) {
      responseData.popularInGrade = popularInGrade;
    } else {
      responseData.popularVideos = popularInGrade;
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].homePageRetrieved,
      data: responseData,
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'errorGettingHomePage' });
  }
};

// GET explore student data with grades, subjects, terms, and videos
const exploreStudent = async (req, res) => {
  const lang = req.userLanguage;
  try {
    // Get all active grades sorted by order
    const grades = await GradeModel.find({ eStatus: 'active' })
      .sort({ iOrder: 1 })
      .select('_id sName sDescription iOrder sImage')
      .lean();

    // Get all active subjects with populated data
    const subjects = await SubjectModel.find({ eStatus: 'active' })
      .sort({ iOrder: 1 })
      .select('_id sName iOrder sImage sTeacher iGradeId')
      .lean();

    // Get all active terms
    const terms = await TermModel.find({ eStatus: 'active' })
      .sort({ iOrder: 1 })
      .select('_id sName iOrder iSubjectId')
      .lean();

    // Get all active videos
    const videos = await VideoModel.find({
      eStatus: 'active',
      bDelete: { $ne: true }
    })
      .sort({ iOrder: 1 })
      .select('_id sTitle iOrder iSubjectId iTermId iLibraryId iExternalVideoId')
      .lean();

    // Annotate bookmarks on these videos
    let bookmarkedSet = new Set();
    if (req?.user?._id && videos.length) {
      const ids = videos.map(v => ObjectId(v._id));
      const bookmarks = await BookmarkModel.find({ iUserId: ObjectId(req.user._id), iVideoId: { $in: ids }, bDelete: false }, { iVideoId: 1 }).lean();
      bookmarkedSet = new Set(bookmarks.map(b => String(b.iVideoId)));
    }

    // Group subjects by grade
    const subjectsByGrade = {};
    subjects.forEach(subject => {
      const gradeId = String(subject.iGradeId);
      if (!subjectsByGrade[gradeId]) {
        subjectsByGrade[gradeId] = [];
      }
      subjectsByGrade[gradeId].push(subject);
    });

    // Group terms by subject
    const termsBySubject = {};
    terms.forEach(term => {
      const subjectId = String(term.iSubjectId);
      if (!termsBySubject[subjectId]) {
        termsBySubject[subjectId] = [];
      }
      termsBySubject[subjectId].push(term);
    });

    // Group videos by subject
    const videosBySubject = {};
    videos.forEach(video => {
      const subjectId = String(video.iSubjectId);
      if (!videosBySubject[subjectId]) {
        videosBySubject[subjectId] = [];
      }
      videosBySubject[subjectId].push(video);
    });

    // Build the response structure
    const gradesWithData = grades.map(grade => {
      const gradeId = String(grade._id);
      const gradeSubjects = subjectsByGrade[gradeId] || [];

      const subjectsWithData = gradeSubjects.map(subject => {
        const subjectId = String(subject._id);
        const subjectTerms = termsBySubject[subjectId] || [];
        const subjectVideos = videosBySubject[subjectId] || [];

        return {
          _id: subject._id,
          name: subject.sName,
          order: subject.iOrder,
          image: subject.sImage || '',
          teacherName: subject.sTeacher || '',
          termsCount: subjectTerms.length,
          videosCount: subjectVideos.length,
          terms: subjectTerms.map(term => ({
            _id: term._id,
            name: term.sName,
            order: term.iOrder
          })),
          videos: subjectVideos.map(video => ({
            _id: video._id,
            videoId: video._id,
            title: video.sTitle,
            order: video.iOrder,
            isBookmarked: bookmarkedSet.has(String(video._id)),
            libraryId: video.iLibraryId || '',
            externalId: video.iExternalVideoId || ''
          }))
        };
      });

      const gradeVideosCount = subjectsWithData.reduce((total, subject) => total + subject.videosCount, 0);

      return {
        _id: grade._id,
        name: grade.sName,
        order: grade.iOrder,
        image: grade.sImage || '',
        description: grade?.sDescription || '',
        subjectsCount: gradeSubjects.length,
        videosCount: gradeVideosCount,
        subjects: subjectsWithData
      };
    });

    // Add SEO data to all entities
    const gradesWithSeo = await addSeoDataToExploreResponse(gradesWithData);

    // Build feature series data (subjects sorted by order with grade context)
    const featureSeries = gradesWithSeo
      .flatMap(grade => {
        return grade.subjects.map(subject => ({
          gradeId: grade._id,
          gradeName: grade.name,
          gradeDescription: grade.description,
          gradeOrder: grade.order,
          gradeSeo: grade.seo || null,
          subjectId: subject._id,
          subjectName: subject.name,
          subjectOrder: subject.order,
          subjectImage: subject.image,
          teacherName: subject.teacherName,
          termsCount: subject.termsCount,
          videosCount: subject.videosCount,
          subjectSeo: subject.seo || null,
          terms: subject.terms
        }));
      })
      .sort((a, b) => {
        if (a.subjectOrder === b.subjectOrder) {
          return a.gradeOrder - b.gradeOrder;
        }
        return a.subjectOrder - b.subjectOrder;
      });

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].dashboardRetrieved,
      data: {
        grades: gradesWithSeo,
        featureSeries
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'errorGettingDashboard' });
  }
};

// GET aggregated course detail for a subject (accepts gradeId, subjectId, optional termId)
const getCourseDetail = async (req, res) => {
  const lang = req.userLanguage;
  try {
    const { gradeId, subjectId, termId } = req.query;

    if (!gradeId || !subjectId) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang].gradeIdAndSubjectIdRequired,
        data: {},
        error: {}
      });
    }

    // Fetch grade and subject; ensure the subject belongs to the grade
    const [grade, subject] = await Promise.all([
      GradeModel.findOne({ _id: gradeId, eStatus: 'active' }).lean(),
      SubjectModel.findOne({ _id: subjectId, eStatus: 'active' })
        .populate('iGradeId', 'sName iOrder sImage sDescription')
        .lean()
    ]);

    if (!grade) {
      return res.status(status.NotFound).json({
        success: false,
        message: (messages[lang]?.notFound?.replace('##', messages[lang]?.cGrade)) || 'Grade not found',
        data: {},
        error: {}
      });
    }

    if (!subject) {
      return res.status(status.NotFound).json({
        success: false,
        message: (messages[lang]?.notFound?.replace('##', messages[lang]?.cSubject)) || 'Subject not found',
        data: {},
        error: {}
      });
    }

    const subjectGradeId = subject.iGradeId?._id || subject.iGradeId;
    if (String(subjectGradeId) !== String(gradeId)) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang].subjectNotBelongToGrade,
        data: {},
        error: {}
      });
    }

    // Terms for this subject+grade
    const terms = await TermModel.find({ iSubjectId: subjectId, iGradeId: subjectGradeId, eStatus: 'active' })
      .sort({ iOrder: 1 })
      .select('_id sName iOrder')
      .lean();

    // Base video filter (optional term filter)
    const baseVideoFilter = { iGradeId: subjectGradeId, iSubjectId: subjectId, eStatus: 'active', bDelete: { $ne: true } };
    const filteredVideoFilter = { ...baseVideoFilter };
    if (termId) filteredVideoFilter.iTermId = termId;

    // Video list for the page (filtered if termId provided)
    const videos = await VideoModel.find(filteredVideoFilter)
      .sort({ iOrder: 1 })
      .select('_id sTitle sDescription iDuration sUrl sThumbnailUrl iOrder iTermId nLikeCount nViewCount iLibraryId iExternalVideoId')
      .lean();

    // Annotate isBookmarked and isLiked for course detail videos
    let bookmarkedSetForDetail = new Set();
    let likedSetForDetail = new Set();
    if (req?.user?._id && videos.length) {
      const ids = videos.map(v => ObjectId(v._id));
      const [bookmarks, likes] = await Promise.all([
        BookmarkModel.find({ iUserId: ObjectId(req.user._id), iVideoId: { $in: ids }, bDelete: false }, { iVideoId: 1 }).lean(),
        VideoLikeModel.find({ iUserId: ObjectId(req.user._id), iVideoId: { $in: ids }, bDelete: false }, { iVideoId: 1 }, { readPreference: 'primary' }).lean()
      ]);
      bookmarkedSetForDetail = new Set(bookmarks.map(b => String(b.iVideoId)));
      likedSetForDetail = new Set(likes.map(l => String(l.iVideoId)));
    }

    // Per-term video counts (for all terms in this subject within this grade)
    const objectIdSubject = SubjectModel.db.base.Types.ObjectId(subjectId);
    const perTermCountsAgg = await VideoModel.aggregate([
      { $match: { iGradeId: SubjectModel.db.base.Types.ObjectId(subjectGradeId), iSubjectId: objectIdSubject, eStatus: 'active', bDelete: { $ne: true } } },
      { $group: { _id: '$iTermId', nVideoCount: { $sum: 1 } } }
    ]);
    const perTermCountMap = new Map(perTermCountsAgg.map(x => [String(x._id), x.nVideoCount]));
    const perTermCounts = terms.map(t => ({ termId: t._id, nVideoCount: perTermCountMap.get(String(t._id)) || 0 }));

    // Totals for the subject within the grade
    const totalsAgg = await VideoModel.aggregate([
      { $match: { iGradeId: SubjectModel.db.base.Types.ObjectId(subjectGradeId), iSubjectId: objectIdSubject, eStatus: 'active', bDelete: { $ne: true } } },
      { $group: { _id: null, totalVideos: { $sum: 1 }, totalDuration: { $sum: '$iDuration' } } }
    ]);
    const totalVideosForSubject = totalsAgg[0]?.totalVideos || 0;
    const totalDurationForSubject = totalsAgg[0]?.totalDuration ? Number(totalsAgg[0].totalDuration) : 0;

    // Up next (top 3 by order, not filtered by term)
    const upNextDocs = await VideoModel.find(baseVideoFilter)
      .sort({ iOrder: 1 })
      .select('_id sTitle iDuration iOrder sThumbnailUrl iLibraryId iExternalVideoId')
      .limit(3)
      .lean();
    const upNext = upNextDocs.map(v => ({
      _id: v._id,
      videoId: v._id,
      title: v.sTitle,
      duration: v.iDuration || '00:00:00',
      order: v.iOrder,
      thumbnailUrl: v.sThumbnailUrl || '',
      libraryId: v.iLibraryId || '',
      externalId: v.iExternalVideoId || ''
    }));

    // Related subjects in the same grade
    const relatedSubjects = await SubjectModel.find({ iGradeId: subjectGradeId, _id: { $ne: subjectId }, eStatus: 'active' })
      .sort({ iOrder: 1 })
      .select('_id sName sImage sTeacher iOrder')
      .limit(6)
      .lean();
    const relatedIds = relatedSubjects.map(s => s._id);
    let videoCounts = [];
    if (relatedIds.length) {
      videoCounts = await VideoModel.aggregate([
        { $match: { iSubjectId: { $in: relatedIds }, eStatus: 'active', bDelete: { $ne: true } } },
        { $group: { _id: '$iSubjectId', nVideoCount: { $sum: 1 } } }
      ]);
    }
    const relatedCountMap = new Map(videoCounts.map(v => [String(v._id), v.nVideoCount]));
    const related = relatedSubjects.map(s => ({
      _id: s._id,
      name: s.sName,
      image: s.sImage || '',
      teacherName: s.sTeacher || '',
      order: s.iOrder,
      nVideoCount: relatedCountMap.get(String(s._id)) || 0
    }));

    // Add SEO data to entities
    const [gradeWithSeo, subjectWithSeo, termsWithSeo, videosWithSeo, relatedWithSeo] = await Promise.all([
      grade ? getSeoDataForRecord({ _id: grade._id, name: grade.sName, description: grade.sDescription || '', order: grade.iOrder, image: grade.sImage || '' }, data.eSeoType.map.GRADE) : null,
      getSeoDataForRecord({ _id: subject._id, name: subject.sName, description: subject.sDescription || '', teacherName: subject.sTeacher || '', order: subject.iOrder, image: subject.sImage || '' }, data.eSeoType.map.SUBJECT),
      getSeoDataForRecords(terms.map(t => ({ _id: t._id, name: t.sName })), data.eSeoType.map.TERM),
      getSeoDataForRecords(videos.map(v => ({
        _id: v._id,
        videoId: v._id,
        title: v.sTitle,
        iDuration: v.iDuration,
        thumbnailUrl: v.sThumbnailUrl || '',
        description: v.sDescription || '',
        order: v.iOrder,
        termId: v.iTermId,
        isBookmarked: bookmarkedSetForDetail.has(String(v._id)),
        isLiked: likedSetForDetail.has(String(v._id)),
        nLikeCount: v.nLikeCount || 0,
        nViewCount: v.nViewCount || 0,
        libraryId: v.iLibraryId || '',
        externalId: v.iExternalVideoId || ''
      })), data.eSeoType.map.VIDEO),
      getSeoDataForRecords(related, data.eSeoType.map.SUBJECT)
    ]);

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].dashboardRetrieved,
      data: {
        grade: gradeWithSeo,
        subject: subjectWithSeo,
        terms: termsWithSeo,
        counts: { perTerm: perTermCounts, totalVideosForSubject, totalDurationForSubject },
        videos: videosWithSeo,
        upNext,
        related: relatedWithSeo
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'errorGettingDashboard' });
  }
};

const getMyLearnings = async (req, res) => {
  const lang = req.userLanguage;
  try {
    let myLearning = null;
    const isUserLoggedIn = !!req?.user?._id;

    // Get limit from query params, default to 5
    const limit = parseInt(req.query.limit) || 5;

    if (isUserLoggedIn) {
      // Get recent videos watched by user
      const recentWatchHistory = await VideoWatchHistoryModel.find({
        iUserId: ObjectId(req.user._id),
        bDelete: false
      })
        .sort({ dLastWatchedAt: -1 })
        .limit(limit)
        .select('iVideoId nLastPosition nWatchDuration nWatchPercentage bCompleted')
        .lean();

      if (recentWatchHistory.length > 0) {
        const recentVideoIds = recentWatchHistory.map(h => h.iVideoId);
        const recentVideos = await VideoModel.find({
          _id: { $in: recentVideoIds },
          eStatus: 'active',
          bDelete: { $ne: true }
        })
          .select('_id sTitle sThumbnailUrl sDescription iOrder nLikeCount nViewCount iLibraryId iExternalVideoId iTermId iDuration')
          .lean();

        // Get term details for myLearning videos
        const termIds = [...new Set(recentVideos.map(v => v.iTermId).filter(Boolean))];
        const terms = termIds.length > 0 ? await TermModel.find({ _id: { $in: termIds } }).select('_id sName').lean() : [];
        const termMap = new Map(terms.map(t => [String(t._id), t]));

        // Sort videos in the order they were watched
        const videoMap = new Map(recentVideos.map(v => [String(v._id), v]));
        const watchMetaMap = new Map(recentWatchHistory.map(h => [String(h.iVideoId), h.nLastPosition || '00:00:00']));
        const sortedVideos = recentWatchHistory
          .map(h => videoMap.get(String(h.iVideoId)))
          .filter(v => v); // Remove any null/undefined values

        // Get bookmarks and likes for these videos
        const myLearningVideoIds = sortedVideos.map(v => ObjectId(v._id));
        const [bookmarks, likes] = await Promise.all([
          BookmarkModel.find({
            iUserId: ObjectId(req.user._id),
            iVideoId: { $in: myLearningVideoIds },
            bDelete: false
          }, { iVideoId: 1 }).lean(),
          VideoLikeModel.find({
            iUserId: ObjectId(req.user._id),
            iVideoId: { $in: myLearningVideoIds },
            bDelete: false
          }, { iVideoId: 1 }, { readPreference: 'primary' }).lean()
        ]);
        const bookmarkedSet = new Set(bookmarks.map(b => String(b.iVideoId)));
        const likedSet = new Set(likes.map(l => String(l.iVideoId)));

        // Prepare videos with all required fields for SEO
        const videosForSeo = sortedVideos.map(v => {
          const term = termMap.get(String(v.iTermId));
          const payload = {
            _id: v._id,
            videoId: v._id,
            title: v.sTitle,
            iDuration: v.iDuration,
            thumbnailUrl: v.sThumbnailUrl || '',
            description: v.sDescription || '',
            order: v.iOrder,
            termId: v.iTermId,
            isBookmarked: bookmarkedSet.has(String(v._id)),
            isLiked: likedSet.has(String(v._id)),
            views: v.nViewCount || 0,
            likes: v.nLikeCount || 0,
            libraryId: v.iLibraryId || '',
            externalId: v.iExternalVideoId || '',
            termName: term?.sName || '',
            lastPosition: watchMetaMap.get(String(v._id)) || '00:00:00'
          };
          return payload;
        });

        // Add SEO data to videos
        myLearning = await getSeoDataForRecords(videosForSeo, data.eSeoType.map.VIDEO);
      }
    }

    return res.status(status.OK).json({
      success: true,
      message: messages[lang].learningsRetrieved,
      data: {
        myLearning
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'errorGettingLearnings' });
  }
};

// GET popular videos in user's grade with SEO data
const getPopularGrade = async (req, res) => {
  const lang = req.userLanguage;
  try {
    let popularInGrade = [];

    // Get limit from query params, default to 5
    const limit = parseInt(req.query.limit) || 5;

    // Fetch user's grade from database
    const user = await UserModel.findById(req.user._id).select('iGradeId').lean();
    const userGrade = user?.iGradeId;

    if (!userGrade) {
      return res.status(status.BadRequest).json({
        success: false,
        message: messages[lang]?.gradeNotFound || 'User grade not found',
        data: {},
        error: {}
      });
    }

    // Get popular videos from user's grade based on likes and views
    const popularVideos = await VideoModel.find({
      iGradeId: ObjectId(userGrade),
      eStatus: 'active',
      bDelete: { $ne: true }
    })
      .sort({ nLikeCount: -1, nViewCount: -1 })
      .limit(limit)
      .select('_id sTitle sThumbnailUrl sDescription iOrder iGradeId iSubjectId iTermId nLikeCount nViewCount iLibraryId iExternalVideoId iDuration')
      .lean();

    if (popularVideos.length > 0) {
      // Get grade, subject and term details for these videos
      const subjectIds = [...new Set(popularVideos.map(v => v.iSubjectId))];
      const termIds = [...new Set(popularVideos.map(v => v.iTermId))];

      const [gradeInfo, subjects, terms] = await Promise.all([
        GradeModel.findById(userGrade).select('_id sName sDescription sImage').lean(),
        SubjectModel.find({ _id: { $in: subjectIds } }).select('_id sName sDescription sImage sTeacher').lean(),
        TermModel.find({ _id: { $in: termIds } }).select('_id sName').lean()
      ]);

      const subjectMap = new Map(subjects.map(s => [String(s._id), s]));
      const termMap = new Map(terms.map(t => [String(t._id), t]));

      // Get bookmarks and likes for these videos
      const popularVideoIds = popularVideos.map(v => ObjectId(v._id));
      const [bookmarks, likes] = await Promise.all([
        BookmarkModel.find({
          iUserId: ObjectId(req.user._id),
          iVideoId: { $in: popularVideoIds },
          bDelete: false
        }, { iVideoId: 1 }).lean(),
        VideoLikeModel.find({
          iUserId: ObjectId(req.user._id),
          iVideoId: { $in: popularVideoIds },
          bDelete: false
        }, { iVideoId: 1 }, { readPreference: 'primary' }).lean()
      ]);
      const bookmarkedSet = new Set(bookmarks.map(b => String(b.iVideoId)));
      const likedSet = new Set(likes.map(l => String(l.iVideoId)));

      // Prepare videos with all required fields for SEO
      const videosForSeo = popularVideos.map(v => {
        const subject = subjectMap.get(String(v.iSubjectId));
        const term = termMap.get(String(v.iTermId));
        const payload = {
          _id: v._id,
          videoId: v._id,
          title: v.sTitle,
          iDuration: v.iDuration,
          thumbnailUrl: v.sThumbnailUrl || '',
          description: v.sDescription || '',
          order: v.iOrder,
          termId: v.iTermId,
          isBookmarked: bookmarkedSet.has(String(v._id)),
          isLiked: likedSet.has(String(v._id)),
          views: v.nViewCount || 0,
          likes: v.nLikeCount || 0,
          libraryId: v.iLibraryId || '',
          externalId: v.iExternalVideoId || '',
          gradeName: gradeInfo?.sName || '',
          subjectName: subject?.sName || '',
          termName: term?.sName || ''
        };
        return payload;
      });

      // Add SEO data to videos and related entities
      const [videosWithSeo, gradeWithSeo, subjectsWithSeo] = await Promise.all([
        getSeoDataForRecords(videosForSeo, data.eSeoType.map.VIDEO),
        gradeInfo ? getSeoDataForRecord({
          _id: gradeInfo._id,
          name: gradeInfo.sName,
          description: gradeInfo.sDescription || '',
          image: gradeInfo.sImage || ''
        }, data.eSeoType.map.GRADE) : null,
        getSeoDataForRecords(subjects.map(s => ({
          _id: s._id,
          name: s.sName,
          description: s.sDescription || '',
          image: s.sImage || '',
          teacherName: s.sTeacher || ''
        })), data.eSeoType.map.SUBJECT)
      ]);

      popularInGrade = videosWithSeo;

      return res.status(status.OK).json({
        success: true,
        message: messages[lang].dashboardRetrieved,
        data: {
          grade: gradeWithSeo,
          subjects: subjectsWithSeo,
          popularInGrade
        },
        error: {}
      });
    }

    // If no popular videos found
    return res.status(status.OK).json({
      success: true,
      message: messages[lang].dashboardRetrieved,
      data: {
        grade: null,
        subjects: [],
        popularInGrade: []
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'errorGettingDashboard' });
  }
};

// GET popular videos for guest users with SEO data
const getPopularVideosGuest = async (req, res) => {
  const lang = req.userLanguage;
  try {
    // Get limit from query params, default to 5
    const limit = parseInt(req.query.limit) || 5;

    // Get popular videos based on likes and views across all grades
    const popularVideos = await VideoModel.find({
      eStatus: 'active',
      bDelete: { $ne: true }
    })
      .sort({ nLikeCount: -1, nViewCount: -1 })
      .limit(limit)
      .select('_id sTitle sThumbnailUrl sDescription iOrder iGradeId iSubjectId iTermId nLikeCount nViewCount iLibraryId iExternalVideoId iDuration')
      .lean();

    if (popularVideos.length > 0) {
      // Get grade, subject and term details for these videos
      const gradeIds = [...new Set(popularVideos.map(v => v.iGradeId))];
      const subjectIds = [...new Set(popularVideos.map(v => v.iSubjectId))];
      const termIds = [...new Set(popularVideos.map(v => v.iTermId))];

      const [grades, subjects, terms] = await Promise.all([
        GradeModel.find({ _id: { $in: gradeIds } }).select('_id sName sDescription sImage').lean(),
        SubjectModel.find({ _id: { $in: subjectIds } }).select('_id sName sDescription sImage sTeacher').lean(),
        TermModel.find({ _id: { $in: termIds } }).select('_id sName').lean()
      ]);

      const gradeMap = new Map(grades.map(g => [String(g._id), g]));
      const subjectMap = new Map(subjects.map(s => [String(s._id), s]));
      const termMap = new Map(terms.map(t => [String(t._id), t]));

      // Get bookmarks and likes for these videos if user is logged in
      let bookmarkedSet = new Set();
      let likedSet = new Set();
      if (req?.user?._id) {
        const popularVideoIds = popularVideos.map(v => ObjectId(v._id));
        const [bookmarks, likes] = await Promise.all([
          BookmarkModel.find({
            iUserId: ObjectId(req.user._id),
            iVideoId: { $in: popularVideoIds },
            bDelete: false
          }, { iVideoId: 1 }).lean(),
          VideoLikeModel.find({
            iUserId: ObjectId(req.user._id),
            iVideoId: { $in: popularVideoIds },
            bDelete: false
          }, { iVideoId: 1 }, { readPreference: 'primary' }).lean()
        ]);
        bookmarkedSet = new Set(bookmarks.map(b => String(b.iVideoId)));
        likedSet = new Set(likes.map(l => String(l.iVideoId)));
      }

      // Prepare videos with all required fields for SEO
      const videosForSeo = popularVideos.map(v => {
        const grade = gradeMap.get(String(v.iGradeId));
        const subject = subjectMap.get(String(v.iSubjectId));
        const term = termMap.get(String(v.iTermId));
        const payload = {
          _id: v._id,
          videoId: v._id,
          title: v.sTitle,
          iDuration: v.iDuration,
          thumbnailUrl: v.sThumbnailUrl || '',
          description: v.sDescription || '',
          order: v.iOrder,
          termId: v.iTermId,
          isBookmarked: bookmarkedSet.has(String(v._id)),
          isLiked: likedSet.has(String(v._id)),
          views: v.nViewCount || 0,
          likes: v.nLikeCount || 0,
          libraryId: v.iLibraryId || '',
          externalId: v.iExternalVideoId || '',
          gradeName: grade?.sName || '',
          subjectName: subject?.sName || '',
          termName: term?.sName || ''
        };
        return payload;
      });

      // Add SEO data to videos and related entities
      const [videosWithSeo, gradesWithSeo, subjectsWithSeo] = await Promise.all([
        getSeoDataForRecords(videosForSeo, data.eSeoType.map.VIDEO),
        getSeoDataForRecords(grades.map(g => ({
          _id: g._id,
          name: g.sName,
          description: g.sDescription || '',
          image: g.sImage || ''
        })), data.eSeoType.map.GRADE),
        getSeoDataForRecords(subjects.map(s => ({
          _id: s._id,
          name: s.sName,
          description: s.sDescription || '',
          image: s.sImage || '',
          teacherName: s.sTeacher || ''
        })), data.eSeoType.map.SUBJECT)
      ]);

      return res.status(status.OK).json({
        success: true,
        message: messages[lang].dashboardRetrieved,
        data: {
          grades: gradesWithSeo,
          subjects: subjectsWithSeo,
          popularVideos: videosWithSeo
        },
        error: {}
      });
    }

    // If no popular videos found
    return res.status(status.OK).json({
      success: true,
      message: messages[lang].dashboardRetrieved,
      data: {
        grades: [],
        subjects: [],
        popularVideos: []
      },
      error: {}
    });
  } catch (error) {
    return handleServiceError(error, req, res, { messageKey: 'errorGettingDashboard' });
  }
};

module.exports = {
  getHomePage,
  exploreStudent,
  // New export added below
  getCourseDetail,
  getMyLearnings,
  getPopularGrade,
  getPopularVideosGuest
};
