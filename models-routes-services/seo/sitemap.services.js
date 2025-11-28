// const Content = require('../../models/lib/Content');
// const Person = require('../../models/lib/Person');
// const Category = require('../../models/lib/Category');
// const Tag = require('../../models/lib/Tag');
// const { catchError } = require('../../helper/utilities.services');
// const config = require('../../config/config');

// const sitemapService = {};

// // Helper function to format date for sitemap
// const formatDate = (date) => {
//   return date.toISOString().split('T')[0];
// };

// // Generate sitemap XML
// sitemapService.generateSitemap = async (req, res) => {
//   try {
//     const baseUrl = config.FRONTEND_URL; // Add this in your config file (e.g., https://yourwebsite.com)
//     let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
//     sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

//     // Add static pages
//     const staticPages = ['', 'about', 'contact', 'browse', 'categories'];
//     staticPages.forEach(page => {
//       sitemap += `  <url>
//     <loc>${baseUrl}/${page}</loc>
//     <changefreq>weekly</changefreq>
//     <priority>${page === '' ? '1.0' : '0.8'}</priority>
//   </url>\n`;
//     });

//     // Add dynamic content pages
//     const [contents, persons, categories, tags] = await Promise.all([
//       Content.find({ eStatus: 'active' }).select('sSlug dUpdatedAt').lean(),
//       Person.find({ eStatus: 'active' }).select('sSlug dUpdatedAt').lean(),
//       Category.find({ eStatus: 'active' }).select('sSlug dUpdatedAt').lean(),
//       Tag.find({ eStatus: 'active' }).select('sSlug dUpdatedAt').lean()
//     ]);

//     // Add content pages (movies/shows)
//     contents.forEach(content => {
//       sitemap += `  <url>
//     <loc>${baseUrl}/watch/${content.sSlug}</loc>
//     <lastmod>${formatDate(content.dUpdatedAt)}</lastmod>
//     <changefreq>weekly</changefreq>
//     <priority>0.9</priority>
//   </url>\n`;
//     });

//     // Add artist pages
//     persons.forEach(person => {
//       sitemap += `  <url>
//     <loc>${baseUrl}/artist/${person.sSlug}</loc>
//     <lastmod>${formatDate(person.dUpdatedAt)}</lastmod>
//     <changefreq>monthly</changefreq>
//     <priority>0.7</priority>
//   </url>\n`;
//     });

//     // Add category pages
//     categories.forEach(category => {
//       sitemap += `  <url>
//     <loc>${baseUrl}/category/${category.sSlug}</loc>
//     <lastmod>${formatDate(category.dUpdatedAt)}</lastmod>
//     <changefreq>weekly</changefreq>
//     <priority>0.8</priority>
//   </url>\n`;
//     });

//     // Add tag pages
//     tags.forEach(tag => {
//       sitemap += `  <url>
//     <loc>${baseUrl}/tag/${tag.sSlug}</loc>
//     <lastmod>${formatDate(tag.dUpdatedAt)}</lastmod>
//     <changefreq>weekly</changefreq>
//     <priority>0.6</priority>
//   </url>\n`;
//     });

//     sitemap += '</urlset>';

//     res.header('Content-Type', 'application/xml');
//     return res.send(sitemap);
//   } catch (err) {
//     return catchError('generateSitemap', err, req, res);
//   }
// };

// // Generate robots.txt
// sitemapService.generateRobots = async (req, res) => {
//   try {
//     const baseUrl = config.FRONTEND_URL;
//     const robotsTxt = `# www.robotstxt.org/

// User-agent: *
// Allow: /
// Allow: /about
// Allow: /contact
// Allow: /browse
// Allow: /categories
// Allow: /category/
// Allow: /artist/
// Allow: /tag/
// Allow: /watch/

// # Disallow admin and API routes
// Disallow: /admin/
// Disallow: /api/
// Disallow: /backend/

// # Disallow specific content types if needed
// # Disallow: /private/
// # Disallow: /premium/

// # Add sitemap location
// Sitemap: ${baseUrl}/sitemap.xml`;

//     res.header('Content-Type', 'text/plain');
//     return res.send(robotsTxt);
//   } catch (err) {
//     return catchError('generateRobots', err, req, res);
//   }
// };

// module.exports = sitemapService;
