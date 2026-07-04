const { Worker, Job, Message } = require('./models');
const { dispatchDailyJob, dispatchPendingJobsForWorker } = require('./dispatch');

module.exports = (io) => {
  const userSockets = new Map();

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('register', (userId) => {
      const normalizedId = String(userId);
      userSockets.set(normalizedId, socket.id);
      console.log(`Socket register: User ${normalizedId} associated with socket ${socket.id}. Total sockets: ${userSockets.size}`);
    });

    socket.on('join_job', (jobId) => {
      socket.join(String(jobId));
      console.log(`Socket ${socket.id} joined room ${jobId}`);
    });

    socket.on('request_job_dispatch', async ({ jobId }) => {
      try {
        console.log(`[DISPATCH] request_job_dispatch received for jobId: ${jobId}. Registered sockets: ${userSockets.size}`);

        const result = await dispatchDailyJob({ io, userSockets, Job, Worker, jobId });

        if (!result.ok) {
          if (result.code === 'not_found') {
            console.log('[DISPATCH] Job not found during dispatch');
            return socket.emit('dispatch_error', { error: result.message });
          }
          if (result.code === 'invalid_coords') {
            console.log('[DISPATCH] Invalid customer coordinates for dispatch');
            return socket.emit('dispatch_error', { error: result.message });
          }
          console.log('[DISPATCH] Dispatch failed:', result.message);
          return socket.emit('dispatch_failed', { message: result.message });
        }

        console.log(`[DISPATCH] incoming_job_request broadcast to ${result.assignedWorkers?.length || 0} workers for job ${jobId}`);
      } catch (error) {
        console.error('[DISPATCH] Error:', error);
        socket.emit('dispatch_error', { error: 'Internal server error during dispatch' });
      }
    });

    socket.on('worker_available', async ({ workerId }) => {
      try {
        const normalizedWorkerId = String(workerId);
        if (!userSockets.has(normalizedWorkerId)) {
          console.log(`[DISPATCH] worker_available ignored — worker ${normalizedWorkerId} not registered`);
          return;
        }

        const { dispatched } = await dispatchPendingJobsForWorker({
          io,
          userSockets,
          Job,
          Worker,
          workerId: normalizedWorkerId
        });

        if (dispatched > 0) {
          console.log(`[DISPATCH] Matched ${dispatched} pending job(s) to worker ${normalizedWorkerId}`);
        }
      } catch (error) {
        console.error('[DISPATCH] worker_available error:', error);
      }
    });

    socket.on('accept_job', async ({ jobId, workerId }) => {
      try {
        const normalizedWorkerId = String(workerId);
        const job = await Job.findById(jobId).populate('customer');
        const worker = await Worker.findById(normalizedWorkerId);

        if (!job || !worker) return;

        job.worker = normalizedWorkerId;
        job.status = 'assigned';
        await job.save();

        worker.totalRequests += 1;
        worker.isAvailable = false;
        await worker.save();

        const customerSocketId = userSockets.get(String(job.customer._id));
        if (customerSocketId) {
          io.sockets.sockets.get(customerSocketId)?.emit('job_accepted', {
            jobId: job._id,
            worker: {
              id: worker._id,
              name: worker.name,
              phone: worker.phone,
              latitude: worker.latitude,
              longitude: worker.longitude,
              averageRating: worker.averageRating,
              totalReviews: worker.totalReviews
            }
          });
        }

        const workerSocketId = userSockets.get(normalizedWorkerId);
        if (workerSocketId) io.sockets.sockets.get(workerSocketId)?.join(String(jobId));
        if (customerSocketId) io.sockets.sockets.get(customerSocketId)?.join(String(jobId));

        console.log(`Job ${jobId} accepted by worker ${worker.name}`);
      } catch (error) {
        console.error('Accept Job Error:', error);
      }
    });

    socket.on('decline_job', async ({ jobId, workerId }) => {
      try {
        if (!jobId || !workerId) {
          console.log('[DISPATCH] decline_job missing jobId or workerId');
          return;
        }
        await Job.findByIdAndUpdate(jobId, { $addToSet: { declinedBy: workerId } });
        console.log(`Job ${jobId} declined by worker ${workerId}`);
        io.to(String(jobId)).emit('job_declined', { jobId, workerId });
      } catch (error) {
        console.error('Decline Job Error:', error);
      }
    });

    socket.on('update_worker_location', async ({ jobId, workerId, latitude, longitude, distanceKm, etaMinutes }) => {
      try {
        const parsedLatitude = Number(latitude);
        const parsedLongitude = Number(longitude);

        if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
          return;
        }

        await Promise.all([
          Worker.findByIdAndUpdate(workerId, { latitude: parsedLatitude, longitude: parsedLongitude }),
          Job.findByIdAndUpdate(jobId, {
            $set: {
              'tracking.active': true,
              'tracking.lastUpdatedAt': new Date(),
              'tracking.distanceKm': Number(distanceKm) || 0,
              'tracking.etaMinutes': Number(etaMinutes) || 0
            }
          })
        ]);

        io.to(String(jobId)).emit('worker_location_updated', {
          latitude: parsedLatitude,
          longitude: parsedLongitude,
          distanceKm: Number(distanceKm) || 0,
          etaMinutes: Number(etaMinutes) || 0
        });
      } catch (error) {
        console.error('Location Update Socket Error:', error);
      }
    });

    socket.on('update_job_status', async ({ jobId, status }) => {
      try {
        if (status !== 'en_route') return;
        const job = await Job.findByIdAndUpdate(jobId, { status }, { new: true });
        if (!job) return;
        io.to(String(jobId)).emit('job_status_updated', { status });
        console.log(`Job ${jobId} status updated to ${status}`);
      } catch (error) {
        console.error('Status Socket Error:', error);
      }
    });

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

        io.to(String(jobId)).emit('receive_message', message);
        console.log(`Message in room ${jobId} from ${sender}: ${text || voiceUrl}`);
      } catch (error) {
        console.error('Chat Error:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
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
