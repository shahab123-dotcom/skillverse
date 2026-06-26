const bcrypt = require('bcryptjs');
const { User } = require('./models');

async function seedAdmin() {
  try {
    const adminEmail = 'admin@skillsverse.com';
    const adminExists = await User.findOne({ email: adminEmail });
    
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const adminUser = new User({
        name: 'Skillsverse Admin',
        email: adminEmail,
        password: hashedPassword,
        phone: '03001112223',
        role: 'admin'
      });
      await adminUser.save();
      console.log('----------------------------------------------------');
      console.log('ADMIN SEEDED: email = admin@skillsverse.com, password = admin123');
      console.log('----------------------------------------------------');
    } else {
      console.log('Admin account already seeded.');
    }
  } catch (error) {
    console.error('Error seeding admin user:', error);
  }
}

module.exports = seedAdmin;
