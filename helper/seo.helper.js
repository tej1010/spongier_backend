const data = require('../data');
const SeoModel = require('../models-routes-services/seo/model');

function slugify (name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

async function buildSlug ({ eType, gradeName, subjectName, termName, leafName }) {
  const parts = [];
  if (eType === data.eSeoType.map.GRADE) {
    parts.push(slugify(leafName));
  } else if (eType === data.eSeoType.map.SUBJECT) {
    parts.push(slugify(gradeName), slugify(leafName));
  } else if (eType === data.eSeoType.map.TERM) {
    parts.push(slugify(gradeName), slugify(subjectName), slugify(leafName));
  } else if (eType === data.eSeoType.map.VIDEO) {
    parts.push(slugify(gradeName), slugify(subjectName), slugify(termName), slugify(leafName));
  }
  const base = '/' + parts.filter(Boolean).join('/');

  // ensure uniqueness by appending -n if needed
  let unique = base;
  let n = 1;
  while (await SeoModel.exists({ sSlug: unique })) {
    n += 1;
    unique = `${base}-${n}`;
  }
  return unique;
}

async function createSeoMeta ({ eType, iId, sTitle, sDescription, contextNames, extra = {} }) {
  try {
    const sSlug = await buildSlug({ eType, ...contextNames, leafName: sTitle });
    const doc = {
      eType,
      iId,
      sTitle,
      sDescription,
      sSlug,
      eStatus: 'active',
      ...extra
    };
    return await SeoModel.create(doc);
  } catch (err) {
    // do not block primary operation
    return null;
  }
}

// Helper function to get SEO data for records
async function getSeoDataForRecords (records, eType) {
  if (!Array.isArray(records) || records.length === 0) {
    return records;
  }

  try {
    const recordIds = records.map(record => record._id);
    const seoData = await SeoModel.find({
      eType,
      iId: { $in: recordIds },
      eStatus: 'active'
    }, { iId: 1, sSlug: 1 }).lean();

    // Create a map for quick lookup
    const seoMap = new Map();
    seoData.forEach(seo => {
      seoMap.set(String(seo.iId), {
        seoId: seo._id,
        slug: seo.sSlug
      });
    });

    // Add SEO data to each record
    return records.map(record => {
      const seo = seoMap.get(String(record._id));
      return {
        ...record,
        seo: seo || null
      };
    });
  } catch (error) {
    console.error('Error fetching SEO data:', error);
    // Return original records if SEO fetch fails
    return records.map(record => ({ ...record, seo: null }));
  }
}

// Helper function to get SEO data for a single record
async function getSeoDataForRecord (record, eType) {
  if (!record) {
    return record;
  }

  try {
    const seoData = await SeoModel.findOne({
      eType,
      iId: record._id,
      eStatus: 'active'
    }, { _id: 1, sSlug: 1 }).lean();

    return {
      ...record,
      seo: seoData ? {
        seoId: seoData._id,
        slug: seoData.sSlug
      } : null
    };
  } catch (error) {
    console.error('Error fetching SEO data for single record:', error);
    return { ...record, seo: null };
  }
}

module.exports = { createSeoMeta, slugify, getSeoDataForRecords, getSeoDataForRecord };
