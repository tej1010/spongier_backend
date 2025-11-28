require('dotenv').config();
const { handleCatchError } = require('./helper/utilities.services');
const data = require('./data');
const AdminsModel = require('./models-routes-services/admin/model');
const PermissionModel = require('./models-routes-services/admin/permissions/model');
const RoleModel = require('./models-routes-services/admin/roles/model');
const SchoolModel = require('./models-routes-services/school/model');
const BadgeModel = require('./models-routes-services/badges/badge.model');

// Super Admin configuration
const oSuperAdmin = {
  sName: 'Super Admin',
  sUsername: 'superadmin',
  sEmail: 'admin@test.com',
  sMobNum: '1234567891',
  sPassword: 'Admin@123',
  eType: 'SUPER'
};

async function executeSeeder () {
  try {
    console.log('🚀 Starting seeder execution...');

    // Import models after database connection

    console.log('📦 Models loaded successfully');

    // First create permissions and roles
    console.log('🔐 Creating permissions and roles...');
    await seedAdminPermissionsAndRole(PermissionModel, RoleModel);
    console.log('✅ Permissions and roles seeded');

    // Then create super admin
    console.log('👑 Creating super admin...');
    await seedSuperAdmin(oSuperAdmin, AdminsModel);
    console.log('✅ Super admin seeded');

    // Create default schools
    console.log('🏫 Creating default schools...');
    await seedDefaultSchools(SchoolModel);
    console.log('✅ Default schools seeded');

    // Seed default badges
    console.log('🏅 Creating default badges...');
    await seedDefaultBadges(BadgeModel);
    console.log('✅ Default badges seeded');

    // Finally create sample sub admin
    console.log('👤 Creating sample sub admin...');
    await seedSampleSubAdmin(AdminsModel, RoleModel);
    console.log('✅ Sample sub admin seeded');

    console.log('🎉 All Seeders Added Successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeder failed:', error.message);
    console.error('Stack trace:', error.stack);
    handleCatchError(error);
    process.exit(1);
  }
}

async function seedSuperAdmin (oSuperAdmin, AdminsModel) {
  try {
    // Check if super admin already exists
    const existingSuperAdmin = await AdminsModel.findOne({ eType: 'SUPER' }).lean();
    if (existingSuperAdmin) {
      console.log('ℹ️  Super admin already exists, skipping...');
      console.log(`   ID: ${existingSuperAdmin._id}`);
      console.log(`   Username: ${existingSuperAdmin.sUsername}`);
      console.log(`   Email: ${existingSuperAdmin.sEmail}`);
      return existingSuperAdmin;
    }

    console.log('📝 Creating new super admin...');

    // Create new super admin (password will be hashed by pre-save hook)
    const oAdmin = new AdminsModel(oSuperAdmin);
    await oAdmin.save();

    console.log('✅ Super admin created successfully!');
    console.log(`   ID: ${oAdmin._id}`);
    console.log(`   Username: ${oSuperAdmin.sUsername}`);
    console.log(`   Email: ${oSuperAdmin.sEmail}`);
    console.log(`   Password: ${oSuperAdmin.sPassword}`);
    console.log(`   Type: ${oAdmin.eType}`);
    console.log(`   Status: ${oAdmin.eStatus}`);

    return oAdmin;
  } catch (error) {
    console.error('❌ Error creating super admin:', error.message);
    if (error.code === 11000) {
      console.error('   Duplicate key error - admin might already exist');
    }
    throw new Error(`Failed to create super admin: ${error.message}`);
  }
}

async function seedAdminPermissionsAndRole (PermissionModel, RoleModel) {
  try {
    console.log('🔑 Creating permissions from enums...');

    // Collect unique module keys from enums
    const enumAdminModules = Array.isArray(data.adminPermission) ? data.adminPermission : [];
    const enumModuleNames = Array.isArray(data.moduleName) ? data.moduleName : [];
    const moduleKeys = Array.from(new Set([...enumAdminModules, ...enumModuleNames]));

    if (!moduleKeys.length) {
      console.log('⚠️  No module keys found in data.js; skipping permission seeding');
    }

    // Upsert a permission per module key (lowercased sKey)
    const upserts = [];
    for (const key of moduleKeys) {
      const sKey = String(key || '').toLowerCase();
      if (!sKey) continue;
      upserts.push(
        PermissionModel.findOneAndUpdate(
          { sKey },
          { $set: { sName: key, sKey, eType: data.eAdminPermission.map.WRITE, eStatus: 'Y' } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      );
    }
    const createdOrUpdated = await Promise.all(upserts);
    const createdPermissions = createdOrUpdated.filter(Boolean);
    console.log(`   ✅ Ensured ${createdPermissions.length} permissions`);

    console.log('👥 Creating admin role...');

    // Create/replace admin role with all permissions
    await RoleModel.deleteMany({ sKey: 'admin' });
    const adminRole = await RoleModel.create({
      sName: 'Admin',
      sKey: 'admin',
      aPermissions: createdPermissions.map(p => p._id),
      eStatus: 'Y'
    });
    console.log(`   ✅ Created admin role: ${adminRole.sName}`);
    console.log(`   ✅ Role ID: ${adminRole._id}`);
    console.log(`   ✅ Permissions: ${adminRole.aPermissions.length}`);

    return { permissions: createdPermissions, role: adminRole };
  } catch (error) {
    console.error('❌ Error creating permissions and roles:', error.message);
    throw new Error(`Failed to create permissions and roles: ${error.message}`);
  }
}

async function seedDefaultSchools (SchoolModel) {
  try {
    console.log('🔍 Checking for "Other" school...');

    // Check if "Other" school already exists
    const existingOtherSchool = await SchoolModel.findOne({ sName: 'Other' }).lean();
    if (existingOtherSchool) {
      console.log('ℹ️  "Other" school already exists, skipping...');
      console.log(`   ID: ${existingOtherSchool._id}`);
      console.log(`   Name: ${existingOtherSchool.sName}`);
      return existingOtherSchool;
    }

    console.log('📝 Creating "Other" school...');

    const otherSchool = new SchoolModel({
      sName: 'Other',
      sAddress: '',
      sCity: '',
      sState: '',
      sCountry: '',
      sPhone: '',
      sEmail: '',
      eStatus: 'active',
      bDelete: false
    });

    await otherSchool.save();
    console.log('✅ "Other" school created successfully!');
    console.log(`   ID: ${otherSchool._id}`);
    console.log(`   Name: ${otherSchool.sName}`);

    return otherSchool;
  } catch (error) {
    console.error('❌ Error creating default schools:', error.message);
    throw new Error(`Failed to create default schools: ${error.message}`);
  }
}

function scrubId (value) {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('<') && value.endsWith('>')) return null;
  return value;
}

async function seedDefaultBadges (BadgeModel) {
  const defaults = [
    {
      sName: 'Perfectionist - 50% Perfect in Term',
      sDescription: 'Score 100% in at least half of the quizzes for this term',
      sIcon: '🏆',
      eTier: 'silver',
      eType: 'perfectionist',
      oRule: { nMinimumPercentage: 50 },
      eStatus: 'active'
    },
    {
      sName: 'Perfectionist - 4 Perfect Videos',
      sDescription: 'Get perfect scores in 4 videos',
      sIcon: '🏆',
      eTier: 'gold',
      eType: 'perfectionist',
      nMinimumVideos: 4,
      oRule: { nMinimumVideos: 4 },
      eStatus: 'active'
    },
    {
      sName: 'Perfect Quiz Starter',
      sDescription: 'Get a perfect score in your first quiz',
      sIcon: '🏅',
      eTier: 'bronze',
      eType: 'quiz_performance',
      nMinimumVideos: 1,
      oRule: { nMinimumVideos: 1 },
      eStatus: 'active'
    },
    {
      sName: 'Term Explorer - 10 Completions',
      sDescription: 'Complete 10 videos in this term',
      sIcon: '📚',
      eTier: 'bronze',
      eType: 'term_explorer',
      nMinimumVideos: 10,
      oRule: { nMinimumVideos: 10 },
      eStatus: 'active'
    },
    {
      sName: 'Master Scholar - Subject Complete',
      sDescription: 'Finish all videos in a subject',
      sIcon: '🎓',
      eTier: 'gold',
      eType: 'master_scholar',
      oRule: { nMinimumSubjects: 1 },
      eStatus: 'active'
    },
    {
      sName: 'Streak Master - 7 Days',
      sDescription: 'Maintain a 7-day learning streak',
      sIcon: '🔥',
      eTier: 'silver',
      eType: 'streak_master',
      oRule: { nMinimumStreakDays: 7 },
      eStatus: 'active'
    },
    {
      sName: 'Streak Master - 30 Days',
      sDescription: 'Maintain a 30-day learning streak',
      sIcon: '🔥',
      eTier: 'gold',
      eType: 'streak_master',
      oRule: { nMinimumStreakDays: 30 },
      eStatus: 'active'
    }
  ];

  const results = [];
  for (const badge of defaults) {
    const query = { sName: badge.sName, eType: badge.eType, bDelete: false };
    const payload = { ...badge };
    if (!payload.iTermId) delete payload.iTermId;
    if (!payload.iSubjectId) delete payload.iSubjectId;
    if (!payload.iGradeId) delete payload.iGradeId;

    const updated = await BadgeModel.findOneAndUpdate(
      query,
      { $setOnInsert: payload },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    results.push(updated);
  }

  console.log(`   ✅ Ensured ${results.length} badges`);
  return results;
}

async function seedSampleSubAdmin (AdminsModel, RoleModel) {
  try {
    console.log('🔍 Finding admin role...');
    const role = await RoleModel.findOne({ sKey: 'admin' }).lean();
    if (!role) {
      console.log('⚠️  Admin role not found, skipping sub admin creation');
      return;
    }

    console.log(`   ✅ Found admin role: ${role.sName}`);

    const exists = await AdminsModel.findOne({ sUsername: 'subadmin' }).lean();
    if (exists) {
      console.log('ℹ️  Sample sub admin already exists, skipping...');
      console.log(`   ID: ${exists._id}`);
      console.log(`   Username: ${exists.sUsername}`);
      return exists;
    }

    console.log('📝 Creating sample sub admin...');

    const subAdmin = new AdminsModel({
      sName: 'Sub Admin',
      sUsername: 'subadmin',
      sEmail: 'subadmin@example.com',
      sMobNum: '1234567890',
      sPassword: 'Admin@123',
      eType: 'SUB',
      aRole: [role._id]
    });

    await subAdmin.save();
    console.log('✅ Sample sub admin created successfully!');
    console.log(`   ID: ${subAdmin._id}`);
    console.log(`   Username: ${subAdmin.sUsername}`);
    console.log(`   Email: ${subAdmin.sEmail}`);
    console.log(`   Password: ${subAdmin.sPassword}`);
    console.log(`   Type: ${subAdmin.eType}`);
    console.log(`   Role: ${subAdmin.aRole[0]}`);

    return subAdmin;
  } catch (error) {
    console.error('❌ Error creating sample sub admin:', error.message);
    throw new Error(`Failed to create sample sub admin: ${error.message}`);
  }
}

// Main execution
console.log('🌱 Admin Module Seeder Starting...');
console.log('⏳ Waiting for database connection...');

// Wait a bit for database connection to establish
setTimeout(async () => {
  try {
    await executeSeeder();
  } catch (error) {
    console.error('💥 Seeder execution failed:', error.message);
    process.exit(1);
  }
}, 2000);
