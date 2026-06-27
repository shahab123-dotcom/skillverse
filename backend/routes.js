const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { User, Worker, Job, Message, Complaint } = require('./models');
const { releaseDuePayments, releaseJobPayment, computePaymentBreakdown, refundJobPayment } = require('./escrow');

async function checkAndReleasePayments() {
  return releaseDuePayments();
}

const JWT_SECRET = process.env.JWT_SECRET || 'skillsverse_secret_key_12345';

// Configure Multer for Audio Uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `voice-${Date.now()}${path.extname(file.originalname || '.webm')}`);
  }
});
const upload = multer({ storage });

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = decoded;
    next();
  });
};

// --- AUTHENTICATION ROUTES ---

// Register User (Customer / Admin) or Worker
router.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, phone, role, skills } = req.body;

    console.log('Registration request - Role:', role, 'Skills:', skills, 'Email:', email);

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    if (role === 'worker') {
      const existingWorker = await Worker.findOne({ email });
      if (existingWorker) return res.status(400).json({ error: 'Email already registered as Worker' });

      const newWorker = new Worker({
        name,
        email,
        password: hashedPassword,
        phone,
        skills: skills || [],
        status: 'pending' // Admin approval required
      });

      await newWorker.save();
      return res.status(201).json({ message: 'Worker registered successfully. Pending Admin approval.' });
    } else {
      if (role === 'admin') {
        return res.status(400).json({ error: 'Administrator accounts cannot be registered directly. Please use seeded credentials.' });
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) return res.status(400).json({ error: 'Email already registered' });

      const newUser = new User({
        name,
        email,
        password: hashedPassword,
        phone,
        role: 'customer'
      });

      await newUser.save();
      return res.status(201).json({ message: 'User registered successfully.' });
    }
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login User or Worker
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    console.log('Login request - Role:', role, 'Email:', email);
    console.log('Full login request body:', req.body);

    if (!email || !password || !role) {
      console.log('Missing login fields:', { email: !!email, password: !!password, role: !!role });
      return res.status(400).json({ error: 'Email, password and role are required' });
    }

    if (role === 'worker') {
      console.log('Looking for worker with email:', email);
      const worker = await Worker.findOne({ email });
      if (!worker) {
        console.log('Worker not found for email:', email);
        return res.status(400).json({ error: 'Invalid worker credentials' });
      }

      console.log('Worker found:', worker.name, 'isConstructor:', worker.isConstructor, 'status:', worker.status);

      const isMatch = await bcrypt.compare(password, worker.password);
      if (!isMatch) {
        console.log('Password mismatch for worker:', email);
        return res.status(400).json({ error: 'Invalid worker credentials' });
      }

      // Workers need to know their approval status
      if (worker.status === 'rejected') {
        return res.status(403).json({ error: 'Your account registration has been rejected by Admin.' });
      }

      if (worker.isBlocked) {
        return res.status(403).json({ error: 'Your account has been blocked by Admin. Contact support for assistance.' });
      }

      const token = jwt.sign({ id: worker._id, role: 'worker', status: worker.status }, JWT_SECRET, { expiresIn: '24h' });
      console.log('Login successful for:', worker.name, 'isConstructor:', worker.isConstructor);
      return res.json({
        token,
        user: {
          id: worker._id,
          name: worker.name,
          email: worker.email,
          phone: worker.phone,
          role: 'worker',
          status: worker.status,
          isAvailable: worker.isAvailable,
          isConstructor: worker.isConstructor || false,
          skills: worker.skills
        }
      });
    } else {
      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ error: 'Invalid credentials' });

      // Prevent loging in with wrong role selection
      if (user.role !== role) {
        return res.status(400).json({ error: `User is not registered as an ${role}` });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

      if (user.isBlocked) {
        return res.status(403).json({ error: 'Your account has been blocked by Admin. Contact support for assistance.' });
      }

      const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
      return res.json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role
        }
      });
    }
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get profile details (for loading session)
router.get('/auth/profile', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'worker') {
      const worker = await Worker.findById(req.user.id).select('-password');
      if (!worker) return res.status(404).json({ error: 'Worker not found' });
      return res.json({ user: { ...worker.toObject(), role: 'worker' } });
    } else {
      const user = await User.findById(req.user.id).select('-password');
      if (!user) return res.status(444).json({ error: 'User not found' });
      return res.json({ user });
    }
  } catch (error) {
    res.status(500).json({ error: 'Profile load failed' });
  }
});


// --- WORKER FLOWS ---

// Toggle availability
router.put('/workers/availability', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'worker') return res.status(403).json({ error: 'Unauthorized' });
    const { isAvailable } = req.body;

    const worker = await Worker.findByIdAndUpdate(
      req.user.id,
      { isAvailable },
      { new: true }
    ).select('-password');

    res.json({ message: 'Availability updated', worker });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update availability' });
  }
});

// Request constructor status
router.post('/workers/request-constructor', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'worker') return res.status(403).json({ error: 'Unauthorized' });
    
    const { constructionDetails, experienceYears, portfolioUrl } = req.body;
    
    const worker = await Worker.findById(req.user.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    
    if (worker.constructorDetails?.status === 'pending') {
      return res.status(400).json({ error: 'Constructor verification request is already pending review' });
    }
    
    worker.constructorDetails = {
      constructionDetails,
      experienceYears,
      portfolioUrl,
      requestedAt: new Date(),
      status: 'pending' // Requires admin approval
    };
    
    await worker.save();
    
    return res.json({ 
      message: 'Constructor request submitted. Pending admin approval.',
      worker: { ...worker.toObject(), role: 'worker' }
    });
  } catch (error) {
    console.error('Constructor request error:', error);
    res.status(500).json({ error: 'Failed to submit constructor request' });
  }
});

// Update location GPS coordinates
router.put('/workers/location', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'worker') return res.status(403).json({ error: 'Unauthorized' });
    const { latitude, longitude } = req.body;

    const worker = await Worker.findByIdAndUpdate(
      req.user.id,
      { latitude, longitude },
      { new: true }
    ).select('-password');

    res.json({ message: 'Location updated', worker });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update location' });
  }
});


// --- ADMIN MANAGEMENT ROUTES ---

// List all workers for Admin
router.get('/admin/workers', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const workers = await Worker.find().select('-password');
    res.json(workers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve workers' });
  }
});

// Approve/Reject Worker Account
router.put('/admin/workers/:id/approve', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { status } = req.body; // 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const worker = await Worker.findByIdAndUpdate(req.params.id, { status }, { new: true }).select('-password');
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    res.json({ message: `Worker ${status} successfully`, worker });
  } catch (error) {
    res.status(500).json({ error: 'Operation failed' });
  }
});

// Approve or reject constructor verification request
router.put('/admin/workers/:id/constructor-approval', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { constructorStatus } = req.body; // 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(constructorStatus)) {
      return res.status(400).json({ error: 'Invalid constructorStatus value' });
    }

    const worker = await Worker.findById(req.params.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    if (!worker.constructorDetails || worker.constructorDetails.status !== 'pending') {
      return res.status(400).json({ error: 'No pending constructor verification request found' });
    }

    worker.constructorDetails.status = constructorStatus;
    worker.isConstructor = constructorStatus === 'approved';
    await worker.save();

    res.json({ message: `Constructor verification ${constructorStatus} successfully`, worker: worker.toObject() });
  } catch (error) {
    console.error('Constructor approval error:', error);
    res.status(500).json({ error: 'Operation failed' });
  }
});

// Remove worker from team
router.delete('/admin/workers/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const worker = await Worker.findByIdAndDelete(req.params.id);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    res.json({ message: 'Worker removed from team' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove worker' });
  }
});

// Block / unblock worker
router.put('/admin/workers/:id/block', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { blocked } = req.body;
    if (typeof blocked !== 'boolean') {
      return res.status(400).json({ error: 'blocked must be a boolean' });
    }

    const worker = await Worker.findByIdAndUpdate(
      req.params.id,
      { isBlocked: blocked, ...(blocked ? { isAvailable: false } : {}) },
      { new: true }
    ).select('-password');

    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    res.json({
      message: blocked ? 'Worker blocked successfully' : 'Worker unblocked successfully',
      worker
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update worker block status' });
  }
});

// List all customers for Admin
router.get('/admin/customers', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

    const customers = await User.find({ role: 'customer' }).select('-password').sort({ name: 1 });
    const customerIds = customers.map(c => c._id);
    const jobs = await Job.find({ customer: { $in: customerIds } });

    const statsMap = {};
    jobs.forEach(job => {
      const id = String(job.customer);
      if (!statsMap[id]) statsMap[id] = { totalJobs: 0, completedJobs: 0 };
      statsMap[id].totalJobs += 1;
      if (job.status === 'completed') statsMap[id].completedJobs += 1;
    });

    const result = customers.map(c => ({
      ...c.toObject(),
      totalJobs: statsMap[String(c._id)]?.totalJobs || 0,
      completedJobs: statsMap[String(c._id)]?.completedJobs || 0
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve customers' });
  }
});

// Block / unblock customer
router.put('/admin/customers/:id/block', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { blocked } = req.body;
    if (typeof blocked !== 'boolean') {
      return res.status(400).json({ error: 'blocked must be a boolean' });
    }

    const customer = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'customer' },
      { isBlocked: blocked },
      { new: true }
    ).select('-password');

    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    res.json({
      message: blocked ? 'Customer blocked successfully' : 'Customer unblocked successfully',
      customer
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update customer block status' });
  }
});


// --- JOB FLOWS ---

// Voice Recording Upload Endpoint
router.post('/jobs/voice', authenticateToken, upload.single('voice'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }
  const relativePath = `/uploads/${req.file.filename}`;
  // Simple simulated transcript for UX polish
  const mockTranscripts = [
    "Need urgent help with a leaking bathroom pipe, water is flowing.",
    "The electrical switchboard is sparkling and kitchen lights are out.",
    "AC is not cooling, need routine washing and filter clean-up.",
    "Bathroom toilet flush is broken, please send someone immediately.",
    "Pest control needed for bugs in bedroom cupboard."
  ];
  const randomTranscript = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
  
  res.json({ 
    voiceUrl: relativePath,
    voiceTranscript: randomTranscript
  });
});

// Chat Voice Recording Upload Endpoint
router.post('/chat/voice', authenticateToken, upload.single('voice'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }
  const relativePath = `/uploads/${req.file.filename}`;
  res.json({ 
    voiceUrl: relativePath 
  });
});

// Create Job
router.post('/jobs', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ error: 'Customer access required' });
    }

    const customer = await User.findById(req.user.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    if (customer.isBlocked) {
      return res.status(403).json({ error: 'Your account is blocked. Contact admin for assistance.' });
    }

    const { type, category, description, voiceUrl, voiceTranscript, location, paymentAmount } = req.body;
    
    if (!type || !category || !location) {
      return res.status(400).json({ error: 'Type, category and location details are required' });
    }

    const newJob = new Job({
      type,
      category,
      customer: req.user.id,
      description: description || '',
      voiceUrl: voiceUrl || '',
      voiceTranscript: voiceTranscript || '',
      location: {
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        address: location.address
      },
      payment: {
        amount: paymentAmount || (type === 'daily' ? 1500 : 0), // Mock amount in PKR
        status: 'pending'
      },
      status: 'pending'
    });

    await newJob.save();
    
    // Note: If type is 'daily', server.js sockets will detect this and dispatch to the nearest worker.
    res.status(201).json({ message: 'Job request submitted successfully', job: newJob });
  } catch (error) {
    console.error('Job Creation Error:', error);
    res.status(500).json({ error: 'Failed to submit job request' });
  }
});

// List Customer Jobs
router.get('/jobs/customer', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'customer') return res.status(403).json({ error: 'Customer access required' });
    await checkAndReleasePayments();
    const jobs = await Job.find({ customer: req.user.id }).populate('worker', 'name phone latitude longitude').sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve jobs' });
  }
});

// List Worker Jobs
router.get('/jobs/worker', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'worker') return res.status(403).json({ error: 'Worker access required' });
    await checkAndReleasePayments();
    const jobs = await Job.find({ worker: req.user.id }).populate('customer', 'name phone').sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve jobs' });
  }
});

// List Admin Jobs
router.get('/jobs/admin', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    await checkAndReleasePayments();
    const jobs = await Job.find()
      .populate('customer', 'name phone email')
      .populate('worker', 'name phone')
      .sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve jobs' });
  }
});

// Assign worker to Newly Construction job (Admin process)
router.put('/jobs/:id/assign', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { workerId, amount } = req.body;

    const worker = await Worker.findById(workerId);
    if (!worker) return res.status(404).json({ error: 'Worker not found' });
    if (worker.isBlocked) return res.status(400).json({ error: 'Cannot assign a blocked worker' });

    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    job.worker = workerId;
    job.status = 'pending_acceptance'; // New status for construction projects awaiting worker acceptance
    if (amount) {
      job.payment.amount = amount;
    }
    await job.save();

    // Increment worker total requests
    worker.totalRequests += 1;
    await worker.save();

    res.json({ message: 'Worker assigned successfully', job });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign worker' });
  }
});

// Get construction projects assigned to worker
router.get('/jobs/worker/construction', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'worker') return res.status(403).json({ error: 'Worker access required' });
    
    const jobs = await Job.find({ 
      worker: req.user.id, 
      type: 'construction',
      status: { $in: ['pending_acceptance', 'assigned', 'en_route', 'completed'] }
    }).populate('customer', 'name email phone').sort({ createdAt: -1 });
    
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load construction projects' });
  }
});

// Worker responds to construction project assignment
router.put('/jobs/:id/worker-response', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'worker') return res.status(403).json({ error: 'Worker access required' });
    const { action } = req.body; // 'accept' or 'reject'

    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    
    if (String(job.worker) !== req.user.id) {
      return res.status(403).json({ error: 'This job is not assigned to you' });
    }
    
    if (job.status !== 'pending_acceptance') {
      return res.status(400).json({ error: 'This job is not pending acceptance' });
    }

    if (action === 'accept') {
      job.status = 'assigned';
      await job.save();
      res.json({ message: 'Construction project accepted', job });
    } else if (action === 'reject') {
      job.worker = null;
      job.status = 'pending';
      await job.save();
      
      // Decrement worker total requests
      const worker = await Worker.findById(req.user.id);
      if (worker) {
        worker.totalRequests = Math.max(0, worker.totalRequests - 1);
        await worker.save();
      }
      
      res.json({ message: 'Construction project rejected', job });
    } else {
      res.status(400).json({ error: 'Invalid action. Use: accept or reject' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to respond to assignment' });
  }
});

// Update Job Status — worker: en_route only; customer: completed only
router.put('/jobs/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    if (req.user.role === 'worker') {
      if (status !== 'en_route') {
        return res.status(403).json({ error: 'Workers can only mark arrival (en_route)' });
      }
      if (String(job.worker) !== req.user.id) {
        return res.status(403).json({ error: 'You are not assigned to this job' });
      }
      if (job.status !== 'assigned') {
        return res.status(400).json({ error: 'Job must be assigned before marking arrival' });
      }
    } else if (req.user.role === 'customer') {
      if (status !== 'completed') {
        return res.status(403).json({ error: 'Customers can only confirm work completion' });
      }
      if (String(job.customer) !== req.user.id) {
        return res.status(403).json({ error: 'This is not your job' });
      }
      if (!['assigned', 'en_route'].includes(job.status)) {
        return res.status(400).json({ error: 'Job cannot be marked completed in its current state' });
      }
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    job.status = status;
    await job.save();

    if (status === 'completed' && job.worker) {
      await Worker.findByIdAndUpdate(job.worker, {
        $inc: { completedRequests: 1 },
        isAvailable: true
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(String(job._id)).emit('job_status_updated', { status });
    }

    res.json({ message: `Job status updated to ${status}`, job });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update job status' });
  }
});

// Reject Job — both customer and worker can reject, resets job to pending
router.put('/jobs/:id/reject', authenticateToken, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    if (req.user.role === 'worker') {
      if (String(job.worker) !== req.user.id) {
        return res.status(403).json({ error: 'You are not assigned to this job' });
      }
    } else if (req.user.role === 'customer') {
      if (String(job.customer) !== req.user.id) {
        return res.status(403).json({ error: 'This is not your job' });
      }
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Reset job to pending state
    const previousWorker = job.worker;
    job.worker = null;
    job.status = 'pending';
    await job.save();

    // Decrement worker's total requests if they had the job
    if (previousWorker) {
      await Worker.findByIdAndUpdate(previousWorker, {
        $inc: { totalRequests: -1 },
        isAvailable: true
      });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(String(job._id)).emit('job_rejected', { jobId: job._id });
    }

    res.json({ message: 'Job rejected and reset to pending', job });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject job' });
  }
});

// Cancel Job (Customer)
router.put('/jobs/:id/cancel', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ error: 'Customer access required' });
    }

    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    if (String(job.customer) !== req.user.id) {
      return res.status(403).json({ error: 'This is not your job' });
    }

    if (['completed', 'cancelled'].includes(job.status)) {
      return res.status(400).json({ error: 'Job cannot be cancelled' });
    }

    job.status = 'cancelled';
    await job.save();

    if (job.worker) {
      await Worker.findByIdAndUpdate(job.worker, { isAvailable: true });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('job_cancelled', { jobId: String(job._id) });
    }

    res.json({ message: 'Job cancelled successfully', job });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

// Pay for job (Customer payments)
router.put('/jobs/:id/pay', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'customer') return res.status(403).json({ error: 'Customer access required' });
    
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const breakdown = computePaymentBreakdown(job.payment.amount || 1500);
    job.payment.status = 'paid';
    job.payment.holdStatus = 'held';
    job.payment.paidAt = breakdown.paidAt;
    job.payment.releaseAt = breakdown.releaseAt;
    job.payment.platformFee = breakdown.platformFee;
    job.payment.workerAmount = breakdown.workerAmount;
    await job.save();

    res.json({
      message: `Payment completed. Held for ${breakdown.holdDays} day(s), then 90% releases to worker.`,
      job
    });
  } catch (error) {
    res.status(500).json({ error: 'Payment failed' });
  }
});

// Admin Payment Stats (extended with escrow breakdown)
router.get('/admin/payments', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    await checkAndReleasePayments();
    
    const paidJobs = await Job.find({ 'payment.status': 'paid' });
    const heldJobs = paidJobs.filter(j => j.payment.holdStatus === 'held');
    const releasedJobs = paidJobs.filter(j => j.payment.holdStatus === 'released');
    const underReviewJobs = paidJobs.filter(j => j.payment.holdStatus === 'under_review');

    const heldPayments = heldJobs.reduce((acc, j) => acc + (j.payment.amount || 0), 0);
    const releasedPayments = releasedJobs.reduce((acc, j) => acc + (j.payment.amount || 0), 0);
    const platformEarnings = releasedJobs.reduce((acc, j) => acc + (j.payment.platformFee || 0), 0);
    const underReviewPayments = underReviewJobs.reduce((acc, j) => acc + (j.payment.amount || 0), 0);

    res.json({
      totalEarnings: releasedPayments,
      pendingEarnings: heldPayments,
      completedJobsCount: paidJobs.length,
      heldPayments,
      releasedPayments,
      platformEarnings,
      underReviewPayments
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// --- CHAT MESSAGES ENDPOINT ---
router.get('/jobs/:jobId/messages', authenticateToken, async (req, res) => {
  try {
    const messages = await Message.find({ jobId: req.params.jobId }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load chat history' });
  }
});

// ─── MANUAL PAYMENT ROUTE ────────────────────────────────────────────────────
// Customer submits payment via Stripe
router.post('/payment/pay', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'customer') return res.status(403).json({ error: 'Customer access required' });
    const { jobId, amount, method, reference } = req.body;

    if (!jobId || !amount || !method) {
      return res.status(400).json({ error: 'jobId, amount, and method are required' });
    }
    if (!['stripe'].includes(method)) {
      return res.status(400).json({ error: 'Invalid payment method. Use: stripe' });
    }

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (String(job.customer) !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
    if (job.payment.status === 'paid') return res.status(400).json({ error: 'Payment already received' });

    const breakdown = computePaymentBreakdown(amount);

    job.payment.status = 'paid';
    job.payment.amount = Number(amount);
    job.payment.method = method;
    job.payment.holdStatus = 'held';
    job.payment.paidAt = breakdown.paidAt;
    job.payment.releaseAt = breakdown.releaseAt;
    job.payment.platformFee = breakdown.platformFee;
    job.payment.workerAmount = breakdown.workerAmount;
    await job.save();

    res.json({
      message: `Payment of PKR ${amount} received. Held ${breakdown.holdDays} day(s). Worker receives PKR ${breakdown.workerAmount} (90%) after hold.`,
      job,
      breakdown: {
        total: Number(amount),
        platformFee: breakdown.platformFee,
        workerAmount: breakdown.workerAmount,
        releaseAt: breakdown.releaseAt,
        holdDays: breakdown.holdDays
      }
    });
  } catch (error) {
    console.error('Manual Payment Error:', error);
    res.status(500).json({ error: 'Payment processing failed' });
  }
});

// ─── WORKER EARNINGS STATS ───────────────────────────────────────────────────
router.get('/workers/earnings-stats', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'worker') return res.status(403).json({ error: 'Worker access required' });
    await checkAndReleasePayments();

    const workerJobs = await Job.find({ worker: req.user.id, 'payment.status': 'paid' });
    const pendingAmount = workerJobs
      .filter(j => j.payment.holdStatus === 'held')
      .reduce((acc, j) => acc + (j.payment.workerAmount || 0), 0);
    const releasedAmount = workerJobs
      .filter(j => j.payment.holdStatus === 'released')
      .reduce((acc, j) => acc + (j.payment.workerAmount || 0), 0);
    const platformDeduction = workerJobs
      .filter(j => j.payment.holdStatus === 'released')
      .reduce((acc, j) => acc + (j.payment.platformFee || 0), 0);
    const totalEarnings = pendingAmount + releasedAmount;

    res.json({ totalEarnings, pendingAmount, releasedAmount, platformDeduction });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load earnings stats' });
  }
});

// ─── COMPLAINT / DISPUTE ROUTES ───────────────────────────────────────────────
// Customer submits a complaint
router.post('/complaints', authenticateToken, upload.single('evidence'), async (req, res) => {
  try {
    if (req.user.role !== 'customer') return res.status(403).json({ error: 'Customer access required' });
    const { jobId, workerName, category, title, details } = req.body;

    if (!jobId || !title || !details) {
      return res.status(400).json({ error: 'jobId, title, and details are required' });
    }

    const job = await Job.findById(jobId).populate('customer', 'name').populate('worker', 'name');
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (String(job.customer._id) !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

    // Enforce: job must be paid before filing a complaint
    if (job.payment.status !== 'paid') {
      return res.status(400).json({ error: 'You can only file a complaint after the job payment has been made.' });
    }

    // Enforce: complaint must be filed within 24 hours of payment
    const COMPLAINT_WINDOW_MS = 24 * 60 * 60 * 1000;
    const paidAt = job.payment.paidAt ? new Date(job.payment.paidAt) : null;
    if (paidAt && Date.now() - paidAt.getTime() > COMPLAINT_WINDOW_MS) {
      return res.status(400).json({ error: 'Complaint window has expired. You can only file a complaint within 24 hours of payment.' });
    }

    // Prevent duplicate complaints for the same job
    const existing = await Complaint.findOne({ jobId, customer: req.user.id });
    if (existing) {
      return res.status(400).json({ error: 'A complaint for this job has already been submitted.' });
    }

    const evidenceUrl = req.file ? `/uploads/${req.file.filename}` : '';

    const complaint = new Complaint({
      jobId,
      customer: req.user.id,
      worker: job.worker._id,
      customerName: job.customer.name,
      workerName: job.worker.name,
      category: category || job.category,
      title,
      details,
      evidenceUrl
    });
    await complaint.save();

    // Mark payment as under review to pause automatic release
    job.payment.holdStatus = 'under_review';
    await job.save();

    res.status(201).json({ message: 'Complaint submitted. Payment placed under review.', complaint });
  } catch (error) {
    console.error('Complaint Error:', error);
    res.status(500).json({ error: 'Failed to submit complaint' });
  }
});

// Customer gets their complaints
router.get('/complaints/customer', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'customer') return res.status(403).json({ error: 'Customer access required' });
    const complaints = await Complaint.find({ customer: req.user.id }).sort({ createdAt: -1 });
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load complaints' });
  }
});

// Worker gets complaints against them
router.get('/complaints/worker', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'worker') return res.status(403).json({ error: 'Worker access required' });
    const complaints = await Complaint.find({ worker: req.user.id }).sort({ createdAt: -1 });
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load complaints' });
  }
});

// Admin lists all complaints
router.get('/admin/complaints', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const complaints = await Complaint.find().sort({ createdAt: -1 });
    res.json(complaints);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load complaints' });
  }
});

// Admin resolves a complaint
router.put('/admin/complaints/:id/resolve', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { action, refundAmount, adminNote } = req.body; // action: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Use: approve or reject' });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

    const job = await Job.findById(complaint.jobId);
    if (!job) return res.status(404).json({ error: 'Associated job not found' });

    complaint.adminNote = adminNote || '';

    if (action === 'approve') {
      const refundAmt = Number(refundAmount) || job.payment.amount;
      complaint.status = 'approved';
      complaint.refundAmount = refundAmt;
      complaint.resolvedAt = new Date();
      await complaint.save();
      // Execute Stripe refund and update the job document
      const updatedJob = await refundJobPayment(job, { refundAmount: refundAmt });
      return res.json({
        message: `Complaint approved. Refund of PKR ${refundAmt} issued to customer.`,
        complaint,
        job: updatedJob
      });
    } else {
      complaint.status = 'rejected';
      complaint.resolvedAt = new Date();
      await complaint.save();
      await releaseJobPayment(job, { force: true });
      return res.json({
        message: 'Complaint rejected. Payment released to worker.',
        complaint,
        job: await Job.findById(job._id)
      });
    }
  } catch (error) {
    console.error('Resolve Complaint Error:', error);
    res.status(500).json({ error: 'Failed to resolve complaint' });
  }
});

module.exports = router;
