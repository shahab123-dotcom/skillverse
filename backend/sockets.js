const { Worker, Job, Message } = require('./models');

// Helper to calculate distance in km using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

module.exports = (io) => {
  // Store connected user sockets: key = userId/workerId, value = socketId
  const userSockets = new Map();

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Register user session
    socket.on('register', (userId) => {
      userSockets.set(userId, socket.id);
      console.log(`User ${userId} registered with socket ${socket.id}`);
    });

    // Join Job Room for real-time tracking and chat
    socket.on('join_job', (jobId) => {
      socket.join(jobId);
      console.log(`Socket ${socket.id} joined room ${jobId}`);
    });

    // Search and Dispatch Daily Routine Job
    socket.on('request_job_dispatch', async ({ jobId }) => {
      try {
        const job = await Job.findById(jobId).populate('customer');
        if (!job) return socket.emit('dispatch_error', { error: 'Job not found' });

        const customerLat = job.location ? Number(job.location.latitude) : NaN;
        const customerLon = job.location ? Number(job.location.longitude) : NaN;

        // Edge case: Invalid customer coordinates
        if (isNaN(customerLat) || isNaN(customerLon) || customerLat === 0 || customerLon === 0) {
          job.status = 'cancelled';
          await job.save();
          return socket.emit('dispatch_error', { error: 'Invalid customer coordinates. Geolocation is required to dispatch.' });
        }

        // Find all approved, available workers that have the matching skill category
        const approvedAvailableWorkers = await Worker.find({
          status: 'approved',
          isAvailable: true,
          isBlocked: { $ne: true },
          skills: job.category
        });

        // Filter workers by online status (active socket connection in userSockets)
        const onlineWorkers = approvedAvailableWorkers.filter(worker => userSockets.has(String(worker._id)));

        if (onlineWorkers.length === 0) {
          job.status = 'cancelled';
          await job.save();
          return socket.emit('dispatch_failed', { message: 'No available matching workers are online at this moment.' });
        }

        // Calculate distance and sort nearest
        const workerDistances = [];
        for (const worker of onlineWorkers) {
          const wLat = Number(worker.latitude);
          const wLon = Number(worker.longitude);

          // Edge case: Worker coordinates unavailable or invalid
          if (isNaN(wLat) || isNaN(wLon) || wLat === 0 || wLon === 0) {
            console.warn(`Skipping worker ${worker.name} due to invalid GPS coordinates.`);
            continue;
          }

          const dist = calculateDistance(customerLat, customerLon, wLat, wLon);
          workerDistances.push({ worker, dist });
        }

        // Edge case: None of the online workers have valid coordinates
        if (workerDistances.length === 0) {
          job.status = 'cancelled';
          await job.save();
          return socket.emit('dispatch_failed', { message: 'No online workers with valid location coordinates are available.' });
        }

        // Sort nearest workers (ascending distance)
        workerDistances.sort((a, b) => a.dist - b.dist);

        const nearest = workerDistances[0];
        const nearestWorker = nearest.worker;
        const minDistance = nearest.dist;

        if (nearestWorker) {
          // Send job alert to nearest worker
          const workerSocketId = userSockets.get(String(nearestWorker._id));
          
          if (workerSocketId) {
            io.to(workerSocketId).emit('incoming_job_request', {
              jobId: job._id,
              category: job.category,
              description: job.description,
              voiceTranscript: job.voiceTranscript,
              voiceUrl: job.voiceUrl,
              distance: minDistance.toFixed(2),
              createdAt: job.createdAt,
              customer: {
                name: job.customer.name,
                phone: job.customer.phone,
                location: job.location
              }
            });
            console.log(`Dispatched job ${jobId} to worker ${nearestWorker.name} at distance ${minDistance.toFixed(2)} km`);
          } else {
            // Worker is marked available in DB but socket is disconnected
            nearestWorker.isAvailable = false;
            await nearestWorker.save();
            socket.emit('dispatch_failed', { message: 'Failed to connect to the nearest worker. Please try again.' });
          }
        }
      } catch (error) {
        console.error('Dispatch Error:', error);
        socket.emit('dispatch_error', { error: 'Internal server error during dispatch' });
      }
    });

    // Worker Accepts Job
    socket.on('accept_job', async ({ jobId, workerId }) => {
      try {
        const job = await Job.findById(jobId).populate('customer');
        const worker = await Worker.findById(workerId);

        if (!job || !worker) return;

        // Associate worker, update status
        job.worker = workerId;
        job.status = 'assigned';
        await job.save();

        // Increment worker requests
        worker.totalRequests += 1;
        worker.isAvailable = false; // Busy now
        await worker.save();

        // Notify customer
        const customerSocketId = userSockets.get(String(job.customer._id));
        if (customerSocketId) {
          io.to(customerSocketId).emit('job_accepted', {
            jobId: job._id,
            worker: {
              id: worker._id,
              name: worker.name,
              phone: worker.phone,
              latitude: worker.latitude,
              longitude: worker.longitude
            }
          });
        }

        // Add both to the job room
        const workerSocketId = userSockets.get(workerId);
        if (workerSocketId) io.sockets.sockets.get(workerSocketId)?.join(jobId);
        if (customerSocketId) io.sockets.sockets.get(customerSocketId)?.join(jobId);

        console.log(`Job ${jobId} accepted by worker ${worker.name}`);
      } catch (error) {
        console.error('Accept Job Error:', error);
      }
    });

    // Worker Declines Job
    socket.on('decline_job', ({ jobId }) => {
      console.log(`Job ${jobId} declined by worker`);
      // Notify customer that request was declined (in real app, we would search next nearest)
      // For this implementation, we can notify the customer to retry
      io.to(jobId).emit('job_declined', { jobId });
    });

    // Worker coordinates tracking update (live GPS)
    socket.on('update_worker_location', async ({ jobId, workerId, latitude, longitude }) => {
      try {
        // Save to DB
        await Worker.findByIdAndUpdate(workerId, { latitude, longitude });

        // Broadcast updated coordinates to the room (customer)
        io.to(jobId).emit('worker_location_updated', { latitude, longitude });
      } catch (error) {
        console.error('Location Update Socket Error:', error);
      }
    });

    // Worker updates job status (assigned -> en_route only)
    socket.on('update_job_status', async ({ jobId, status }) => {
      try {
        if (status !== 'en_route') return;
        const job = await Job.findByIdAndUpdate(jobId, { status }, { new: true });
        if (!job) return;
        io.to(jobId).emit('job_status_updated', { status });
        console.log(`Job ${jobId} status updated to ${status}`);
      } catch (error) {
        console.error('Status Socket Error:', error);
      }
    });

    // Chat Messaging between Customer and Worker
    socket.on('send_message', async ({ jobId, sender, text, voiceUrl, voiceDuration }) => {
      try {
        const message = new Message({
          jobId,
          sender,
          text: text || '',
          voiceUrl: voiceUrl || '',
          voiceDuration: voiceDuration || 0
        });
        await message.save();

        // Broadcast message to everyone in the job room
        io.to(jobId).emit('receive_message', message);
        console.log(`Message in room ${jobId} from ${sender}: ${text || voiceUrl}`);
      } catch (error) {
        console.error('Chat Error:', error);
      }
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      // Clean up socket mapping
      for (const [userId, socketId] of userSockets.entries()) {
        if (socketId === socket.id) {
          userSockets.delete(userId);
          console.log(`Cleaned up user ${userId} registration`);
          break;
        }
      }
    });
  });
};
