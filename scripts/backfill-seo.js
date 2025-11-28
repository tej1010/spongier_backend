#!/usr/bin/env node
/*
 One-time backfill script to create missing SEO records for existing
 grades, subjects, terms, and videos.
 Usage: node scripts/backfill-seo.js
*/

const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const mongoose = require('mongoose');
const data = require('../data');
const { CourseDBConnect } = require('../database/mongoose');

const GradeModel = require('../models-routes-services/course/grades/model');
const SubjectModel = require('../models-routes-services/course/subjects/model');
const TermModel = require('../models-routes-services/course/terms/model');
const VideoModel = require('../models-routes-services/course/videos/model');
const SeoModel = require('../models-routes-services/seo/model');
const { createSeoMeta } = require('../helper/seo.helper');

async function ensureConnection () {
  // Touch the connection to ensure it's alive
  await CourseDBConnect.asPromise?.();
}

function isActive (doc) {
  return doc && doc.eStatus !== data.eStatus.map.INACTIVE && doc.bDelete !== true;
}

async function backfillGrades () {
  const type = data.eSeoType.map.GRADE;
  const grades = await GradeModel.find({}).lean();
  let created = 0; let skipped = 0;
  for (const grade of grades) {
    if (!isActive(grade)) { skipped++; continue; }
    const exists = await SeoModel.exists({ eType: type, iId: grade._id });
    if (exists) { skipped++; continue; }
    await createSeoMeta({
      eType: type,
      iId: grade._id,
      sTitle: grade.sName,
      sDescription: grade.sDescription || '',
      contextNames: { eType: type }
    });
    created++;
  }
  return { created, skipped, count: grades.length };
}

async function backfillSubjects () {
  const type = data.eSeoType.map.SUBJECT;
  const subjects = await SubjectModel.find({}).lean();
  let created = 0; let skipped = 0;
  // Preload grades map for names
  const gradeIds = [...new Set(subjects.map(s => String(s.iGradeId)))];
  const grades = await GradeModel.find({ _id: { $in: gradeIds } }, { sName: 1 }).lean();
  const gradeIdToName = new Map(grades.map(g => [String(g._id), g.sName]));
  for (const subject of subjects) {
    if (!isActive(subject)) { skipped++; continue; }
    const exists = await SeoModel.exists({ eType: type, iId: subject._id });
    if (exists) { skipped++; continue; }
    const gradeName = gradeIdToName.get(String(subject.iGradeId)) || '';
    await createSeoMeta({
      eType: type,
      iId: subject._id,
      sTitle: subject.sName,
      sDescription: subject.sDescription || '',
      contextNames: { eType: type, gradeName }
    });
    created++;
  }
  return { created, skipped, count: subjects.length };
}

async function backfillTerms () {
  const type = data.eSeoType.map.TERM;
  const terms = await TermModel.find({}).lean();
  let created = 0; let skipped = 0;
  // Preload grade/subject names
  const gradeIds = [...new Set(terms.map(t => String(t.iGradeId)))];
  const subjectIds = [...new Set(terms.map(t => String(t.iSubjectId)))];
  const [grades, subjects] = await Promise.all([
    GradeModel.find({ _id: { $in: gradeIds } }, { sName: 1 }).lean(),
    SubjectModel.find({ _id: { $in: subjectIds } }, { sName: 1 }).lean()
  ]);
  const gradeIdToName = new Map(grades.map(g => [String(g._id), g.sName]));
  const subjectIdToName = new Map(subjects.map(s => [String(s._id), s.sName]));

  for (const term of terms) {
    if (!isActive(term)) { skipped++; continue; }
    const exists = await SeoModel.exists({ eType: type, iId: term._id });
    if (exists) { skipped++; continue; }
    const gradeName = gradeIdToName.get(String(term.iGradeId)) || '';
    const subjectName = subjectIdToName.get(String(term.iSubjectId)) || '';
    await createSeoMeta({
      eType: type,
      iId: term._id,
      sTitle: term.sName,
      sDescription: term.sDescription || '',
      contextNames: { eType: type, gradeName, subjectName }
    });
    created++;
  }
  return { created, skipped, count: terms.length };
}

async function backfillVideos () {
  const type = data.eSeoType.map.VIDEO;
  const videos = await VideoModel.find({ bDelete: { $ne: true } }).lean();
  let created = 0; let skipped = 0;
  const gradeIds = [...new Set(videos.map(v => String(v.iGradeId)))];
  const subjectIds = [...new Set(videos.map(v => String(v.iSubjectId)))];
  const termIds = [...new Set(videos.map(v => String(v.iTermId)))];
  const [grades, subjects, terms] = await Promise.all([
    GradeModel.find({ _id: { $in: gradeIds } }, { sName: 1 }).lean(),
    SubjectModel.find({ _id: { $in: subjectIds } }, { sName: 1 }).lean(),
    TermModel.find({ _id: { $in: termIds } }, { sName: 1 }).lean()
  ]);
  const gradeIdToName = new Map(grades.map(g => [String(g._id), g.sName]));
  const subjectIdToName = new Map(subjects.map(s => [String(s._id), s.sName]));
  const termIdToName = new Map(terms.map(t => [String(t._id), t.sName]));

  for (const video of videos) {
    if (!isActive(video)) { skipped++; continue; }
    const exists = await SeoModel.exists({ eType: type, iId: video._id });
    if (exists) { skipped++; continue; }
    const gradeName = gradeIdToName.get(String(video.iGradeId)) || '';
    const subjectName = subjectIdToName.get(String(video.iSubjectId)) || '';
    const termName = termIdToName.get(String(video.iTermId)) || '';
    await createSeoMeta({
      eType: type,
      iId: video._id,
      sTitle: video.sTitle,
      sDescription: video.sDescription || '',
      contextNames: { eType: type, gradeName, subjectName, termName }
    });
    created++;
  }
  return { created, skipped, count: videos.length };
}

async function main () {
  await ensureConnection();
  const results = {};
  results.grades = await backfillGrades();
  console.log('Grades:', results.grades);
  results.subjects = await backfillSubjects();
  console.log('Subjects:', results.subjects);
  results.terms = await backfillTerms();
  console.log('Terms:', results.terms);
  results.videos = await backfillVideos();
  console.log('Videos:', results.videos);

  // Close all connections
  await Promise.all(
    mongoose.connections.map(async (conn) => conn.close().catch(() => {}))
  );
  console.log('Backfill complete');
}

main().catch(async (err) => {
  console.error('Backfill failed', err);
  await Promise.all(
    mongoose.connections.map(async (conn) => conn.close().catch(() => {}))
  );
  process.exit(1);
});
