function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function emitToSocket(io, socketId, event, payload) {
  if (!socketId) return false;
  const target = io.sockets.sockets.get(socketId);
  if (!target) return false;
  target.emit(event, payload);
  return true;
}

async function dispatchDailyJob({ io, userSockets, Job, Worker, jobId }) {
  const job = await Job.findById(jobId).populate('customer');
  if (!job) {
    console.log(`[DISPATCH] Job ${jobId} not found`);
    return { ok: false, code: 'not_found', message: 'Job not found' };
  }

  if (job.type !== 'daily' || job.status !== 'pending' || job.worker) {
    console.log(`[DISPATCH] Job ${jobId} is not available for dispatch (type=${job.type}, status=${job.status}, worker=${job.worker})`);
    return { ok: false, code: 'invalid_state', message: 'Job is not available for dispatch' };
  }

  const customerLat = job.location ? Number(job.location.latitude) : NaN;
  const customerLon = job.location ? Number(job.location.longitude) : NaN;

  if (Number.isNaN(customerLat) || Number.isNaN(customerLon)) {
    console.log(`[DISPATCH] Invalid customer coordinates for job ${jobId}: lat=${job.location?.latitude}, lon=${job.location?.longitude}`);
    return { ok: false, code: 'invalid_coords', message: 'Invalid customer coordinates. Geolocation is required to dispatch.' };
  }

  const normalizedJobCategory = String(job.category || '').trim().toLowerCase();
  console.log(`[DISPATCH] Job ${jobId} category='${job.category}' normalized='${normalizedJobCategory}'`);

  const approvedAvailableWorkers = await Worker.find({
    status: 'approved',
    isAvailable: true,
    isBlocked: { $ne: true }
  });

  approvedAvailableWorkers.forEach((worker) => {
    console.log(`[DISPATCH] Worker ${worker._id} status=${worker.status} isAvailable=${worker.isAvailable} skills=${JSON.stringify(worker.skills)} coords=(${worker.latitude},${worker.longitude})`);
  });

  const declinedWorkerIds = Array.isArray(job.declinedBy) ? job.declinedBy.map((id) => String(id)) : [];
  const matchingWorkers = approvedAvailableWorkers.filter((worker) => {
    const workerIdString = String(worker._id);
    const skills = Array.isArray(worker.skills) ? worker.skills.map((s) => String(s || '').trim().toLowerCase()) : [];
    if (declinedWorkerIds.includes(workerIdString)) {
      console.log(`[DISPATCH] Worker ${workerIdString} already declined job ${jobId}, skipping`);
      return false;
    }
    return skills.includes(normalizedJobCategory);
  });

  console.log(`[DISPATCH] Matching workers for category '${job.category}': ${matchingWorkers.length}`);

  const onlineWorkers = matchingWorkers.filter((worker) => userSockets.has(String(worker._id)));

  console.log(`[DISPATCH] Online workers available: ${onlineWorkers.length}`);
  if (onlineWorkers.length === 0) {
    return { ok: false, code: 'no_workers', message: 'No available workers are online for this category. Please try again in a moment.' };
  }

  const workerDistances = [];
  for (const worker of onlineWorkers) {
    const wLat = Number(worker.latitude);
    const wLon = Number(worker.longitude);
    if (Number.isNaN(wLat) || Number.isNaN(wLon)) {
      console.log(`[DISPATCH] Worker ${worker._id} ignored due invalid coordinates lat=${worker.latitude} lon=${worker.longitude}`);
      continue;
    }
    workerDistances.push({ worker, dist: calculateDistance(customerLat, customerLon, wLat, wLon) });
  }

  if (workerDistances.length === 0) {
    console.log('[DISPATCH] No online workers have valid location coordinates');
    return { ok: false, code: 'no_coords', message: 'No workers with valid location data are available right now.' };
  }

  workerDistances.sort((a, b) => a.dist - b.dist);

  const requestPayload = {
    requestId: job._id,
    jobId: job._id,
    customerId: String(job.customer._id || job.customer),
    customerName: job.customer.name,
    serviceCategory: job.category,
    issueDescription: job.description,
    voiceIssue: {
      voiceUrl: job.voiceUrl,
      voiceTranscript: job.voiceTranscript
    },
    customerCity: job.location?.city || '',
    customerAddress: job.location?.address || job.location?.manualAddress || '',
    customerCoordinates: {
      latitude: job.location?.latitude,
      longitude: job.location?.longitude
    },
    requestDate: job.createdAt,
    requestStatus: job.status,
    category: job.category,
    description: job.description,
    voiceTranscript: job.voiceTranscript,
    voiceUrl: job.voiceUrl,
    createdAt: job.createdAt,
    customer: {
      name: job.customer.name,
      phone: job.customer.phone,
      location: job.location
    }
  };

  const assignedWorkers = [];
  for (const entry of workerDistances) {
    const worker = entry.worker;
    const distance = entry.dist.toFixed(2);
    const workerSocketId = userSockets.get(String(worker._id));
    if (!workerSocketId) {
      console.log(`[DISPATCH] Worker ${worker._id} missing socket ID despite being listed online`);
      continue;
    }

    const offerPayload = {
      ...requestPayload,
      distance,
      customer: {
        name: job.customer.name,
        phone: job.customer.phone,
        location: job.location
      }
    };

    if (emitToSocket(io, workerSocketId, 'incoming_job_request', offerPayload)) {
      assignedWorkers.push({ workerId: String(worker._id), name: worker.name, distance });
      console.log(`[DISPATCH] Socket event sent to worker ${worker._id} for job ${jobId} (distance ${distance} km)`);
    } else {
      console.log(`[DISPATCH] Failed to send incoming_job_request to worker ${worker._id}`);
    }
  }

  if (assignedWorkers.length === 0) {
    console.log('[DISPATCH] No matching workers could be notified for job', jobId);
    return { ok: false, code: 'no_notification', message: 'Could not notify any matching workers at this time.' };
  }

  console.log(`[DISPATCH] Assigned job ${jobId} to matching workers: ${assignedWorkers.map(w => w.workerId).join(', ')}`);
  return {
    ok: true,
    assignedWorkers,
    nearestDistanceKm: workerDistances[0].dist
  };
}


async function dispatchPendingJobsForWorker({ io, userSockets, Job, Worker, workerId }) {
  const worker = await Worker.findById(workerId);
  if (!worker || worker.status !== 'approved' || !worker.isAvailable || worker.isBlocked) {
    console.log(`[DISPATCH] Worker ${workerId} cannot receive pending jobs (approved=${worker?.status === 'approved'}, available=${worker?.isAvailable}, blocked=${worker?.isBlocked})`);
    return { dispatched: 0 };
  }

  if (!userSockets.has(String(worker._id))) {
    console.log(`[DISPATCH] Worker ${workerId} is not currently registered on sockets`);
    return { dispatched: 0 };
  }

  const workerSkills = Array.isArray(worker.skills) ? worker.skills.map((s) => String(s || '').trim().toLowerCase()) : [];
  const pendingJobs = await Job.find({
    type: 'daily',
    status: 'pending',
    worker: null
  }).sort({ createdAt: 1 }).limit(20);

  const matchingJobs = pendingJobs.filter((job) => {
    const normalizedJobCategory = String(job.category || '').trim().toLowerCase();
    const declinedBy = Array.isArray(job.declinedBy) ? job.declinedBy.map((id) => String(id)) : [];
    if (declinedBy.includes(String(workerId))) {
      return false;
    }
    return workerSkills.includes(normalizedJobCategory);
  });

  console.log(`[DISPATCH] Found ${pendingJobs.length} pending jobs, ${matchingJobs.length} matching category jobs for worker ${workerId}`);

  let dispatched = 0;
  for (const job of matchingJobs) {
    const result = await dispatchDailyJob({ io, userSockets, Job, Worker, jobId: job._id });
    if (result.ok) {
      dispatched += 1;
      break;
    }
  }

  return { dispatched };
}

module.exports = {
  dispatchDailyJob,
  dispatchPendingJobsForWorker
};
