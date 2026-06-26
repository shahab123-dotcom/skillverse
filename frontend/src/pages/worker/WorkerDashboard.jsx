import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { MapPin, Phone, CheckCircle, Navigation, Send, AlertTriangle, MessageSquare, Mic, ListChecks, CreditCard, Briefcase, User } from 'lucide-react';
import { API_URL } from '../../App';
import { useToast } from '../../context/ToastContext';
import DashboardLayout from '../../components/shared/DashboardLayout';
import WorkerSidebar from '../../components/worker/WorkerSidebar';
import StatusBadge from '../../components/shared/StatusBadge';
import EmptyState from '../../components/shared/EmptyState';
import Pagination from '../../components/shared/Pagination';
import { TableSkeleton } from '../../components/shared/LoadingSkeleton';

export default function WorkerDashboard({ user }) {
  const socketRef = useRef(null);
  const simulationIntervalRef = useRef(null);
  const activeJobRef = useRef(null);
  const incomingJobRef = useRef(null);
  const toast = useToast();

  // Worker account status
  const [profile, setProfile] = useState(user);
  const [isAvailable, setIsAvailable] = useState(user.isAvailable);
  const [jobsHistory, setJobsHistory] = useState([]);
  const itemsPerPage = 10;
  const [historyPage, setHistoryPage] = useState(1);
  const [earningsSummary, setEarningsSummary] = useState({ totalEarned: 0, pendingAmount: 0, completedJobs: 0 });

  // Active Job State
  const [activeJob, setActiveJob] = useState(null);
  const [jobStatus, setJobStatus] = useState(''); // 'assigned', 'en_route', 'completed'
  const [highlightRect, setHighlightRect] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [historyLoading, setHistoryLoading] = useState(true);

  // Job Alert offer modal
  const [incomingJob, setIncomingJob] = useState(null);
  const [alertCountdown, setAlertCountdown] = useState(30);

  // Simulated GPS state
  const [gpsLocation, setGpsLocation] = useState({ latitude: 24.8607, longitude: 67.0011 });
  const [isSimulatingGps, setIsSimulatingGps] = useState(false);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef(null);

  // Chat voice recording state
  const [isChatRecording, setIsChatRecording] = useState(false);
  const [chatMediaRecorder, setChatMediaRecorder] = useState(null);
  const [chatRecordingDuration, setChatRecordingDuration] = useState(0);
  const chatRecordingIntervalRef = useRef(null);
  const chatChunksRef = useRef([]);
  const profileRef = useRef(null);
  const availabilityRef = useRef(null);
  const requestRef = useRef(null);
  const trackingRef = useRef(null);

  // Walkthrough Onboarding Tutorial State
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(1);

  // Continuous location updates watch ref
  const locationWatchRef = useRef(null);

  useEffect(() => {
    activeJobRef.current = activeJob;
  }, [activeJob]);

  useEffect(() => {
    incomingJobRef.current = incomingJob;
  }, [incomingJob]);

  useEffect(() => {
    loadProfile();
    loadActiveJob();
    loadWorkerHistory();
    return () => {
      stopGpsSimulation();
      stopWatchingLocation();
      if (chatRecordingIntervalRef.current) clearInterval(chatRecordingIntervalRef.current);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const loadWorkerHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/jobs/worker`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (response.ok) {
        const activeJobs = data.filter(job => job.status !== 'cancelled');
        setJobsHistory(activeJobs);
        setHistoryPage(1);
        const completedJobs = activeJobs.filter(job => job.status === 'completed');
        const totalEarned = completedJobs.reduce((sum, job) => sum + (Number(job.payment.workerAmount || job.payment.amount || 0)), 0);
        const pendingAmount = activeJobs.reduce((sum, job) => sum + ((job.payment.status !== 'paid' && job.payment.amount) ? Number(job.payment.amount) : 0), 0);
        setEarningsSummary({
          totalEarned,
          pendingAmount,
          completedJobs: completedJobs.length
        });
      }
    } catch (error) {
      console.error('Failed to load worker history:', error);
      toast.error('Failed to load service history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const getPaginatedItems = (items, page) => items.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const getTotalPages = (items) => Math.max(1, Math.ceil(items.length / itemsPerPage));

  const visibleHistory = getPaginatedItems(jobsHistory, historyPage);
  const historyTotalPages = getTotalPages(jobsHistory);

  // Trigger onboarding walkthrough if first time login
  useEffect(() => {
    if (profile && profile._id) {
      const isCompleted = localStorage.getItem(`skillsverse_tutorial_completed_${profile._id}`);
      if (!isCompleted) {
        setShowTutorial(true);
      }
    }
  }, [profile]);

  useEffect(() => {
    if (!showTutorial) return;
    const stepRefs = [profileRef, availabilityRef, requestRef, trackingRef];
    const current = stepRefs[tutorialStep - 1]?.current;
    if (current) {
      const rect = current.getBoundingClientRect();
      setHighlightRect({
        top: rect.top + window.scrollY - 14,
        left: rect.left + window.scrollX - 14,
        width: rect.width + 28,
        height: rect.height + 28
      });
      window.scrollTo({ top: Math.max(rect.top + window.scrollY - 120, 0), behavior: 'smooth' });
    }
  }, [showTutorial, tutorialStep]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Continuous GPS updates
  const startWatchingLocation = () => {
    if (locationWatchRef.current) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
    }
    if (navigator.geolocation) {
      locationWatchRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          setGpsLocation({ latitude: lat, longitude: lon });
          updateBackendLocation(lat, lon);

          // Emit coordinate update over socket if there's an active job
          if (activeJob && socketRef.current) {
            socketRef.current.emit('update_worker_location', {
              jobId: activeJob._id,
              workerId: profile._id,
              latitude: lat,
              longitude: lon
            });
          }
        },
        (error) => {
          console.warn('Continuous geolocation watch failed:', error);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    }
  };

  const stopWatchingLocation = () => {
    if (locationWatchRef.current) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
      locationWatchRef.current = null;
    }
  };

  // Load Profile from DB
  const loadProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/profile`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (response.ok) {
        setProfile(data.user);
        setIsAvailable(data.user.isAvailable);
        
        // Initialize Sockets if Worker is approved
        if (data.user.status === 'approved') {
          setupSockets(data.user);
          if (data.user.isAvailable) {
            startWatchingLocation();
          } else {
            fetchWorkerLocation(); // Fetch & update real GPS coordinates
          }
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Chat recording functions
  const startChatRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chatChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chatChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chatChunksRef.current, { type: 'audio/webm' });
        await uploadAndSendChatVoice(blob, chatRecordingDuration);
      };

      setChatRecordingDuration(0);
      chatRecordingIntervalRef.current = setInterval(() => {
        setChatRecordingDuration(prev => prev + 1);
      }, 1000);

      recorder.start();
      setChatMediaRecorder(recorder);
      setIsChatRecording(true);
    } catch (err) {
      toast.error('Mic permission denied. Please allow microphone access.');
    }
  };

  const stopChatRecording = (shouldSend = true) => {
    if (chatRecordingIntervalRef.current) {
      clearInterval(chatRecordingIntervalRef.current);
      chatRecordingIntervalRef.current = null;
    }
    if (chatMediaRecorder && isChatRecording) {
      if (!shouldSend) {
        chatMediaRecorder.onstop = null;
      }
      chatMediaRecorder.stop();
      setIsChatRecording(false);
      setChatMediaRecorder(null);
    }
  };

  const uploadAndSendChatVoice = async (blob, duration) => {
    const formData = new FormData();
    formData.append('voice', blob, 'chat-voice.webm');
    try {
      const response = await fetch(`${API_URL}/api/chat/voice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      const data = await response.json();
      if (response.ok) {
        socketRef.current.emit('send_message', {
          jobId: activeJob._id,
          sender: 'worker',
          text: '',
          voiceUrl: data.voiceUrl,
          voiceDuration: duration
        });
      } else {
        toast.error('Failed to upload voice message.');
      }
    } catch (err) {
      console.error("Error sending voice message:", err);
    }
  };

  // Update worker coordinates on backend database
  const updateBackendLocation = async (latitude, longitude) => {
    try {
      await fetch(`${API_URL}/api/workers/location`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ latitude, longitude })
      });
    } catch (err) {
      console.error('Failed to sync coordinates with server:', err);
    }
  };

  // Fetch real browser GPS geolocation coordinates
  const fetchWorkerLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          setGpsLocation({ latitude: lat, longitude: lon });
          updateBackendLocation(lat, lon);
        },
        (error) => {
          console.warn('Geolocation permission not granted or unavailable:', error);
        },
        { enableHighAccuracy: true }
      );
    }
  };

  // Load any existing active job
  const loadActiveJob = async () => {
    try {
      const response = await fetch(`${API_URL}/api/jobs/worker`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (response.ok) {
        // Find assigned or en-route jobs
        const currentActive = data.find(job => ['assigned', 'en_route'].includes(job.status));
        if (currentActive) {
          setActiveJob(currentActive);
          setJobStatus(currentActive.status);
          setActiveTab('active-job');
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const clearJobState = () => {
    stopGpsSimulation();
    setIncomingJob(null);
    setActiveJob(null);
    setJobStatus('');
    setMessages([]);
    setActiveTab('overview');
    loadWorkerHistory();
    loadProfile();
  };

  // Sockets Setup
  const setupSockets = (worker) => {
    if (socketRef.current) socketRef.current.disconnect();

    const socket = io(API_URL);
    socketRef.current = socket;

    socket.emit('register', worker._id);

    // Listen for incoming match requests
    socket.on('incoming_job_request', (offer) => {
      setIncomingJob(offer);
      setAlertCountdown(30);
    });

    // Customer cancelled — clear incoming or active job
    socket.on('job_cancelled', ({ jobId }) => {
      const matchesIncoming = incomingJobRef.current && String(incomingJobRef.current.jobId) === String(jobId);
      const matchesActive = activeJobRef.current && String(activeJobRef.current._id) === String(jobId);
      if (matchesIncoming || matchesActive) {
        toast.info('Customer cancelled this request.');
        clearJobState();
      }
    });

    // Job completed by customer
    socket.on('job_status_updated', ({ status }) => {
      if (status === 'completed' && activeJobRef.current) {
        toast.success('Customer confirmed work completed.');
        clearJobState();
      } else if (status === 'en_route' && activeJobRef.current) {
        setJobStatus('en_route');
        setActiveJob(prev => prev ? { ...prev, status: 'en_route' } : prev);
      }
    });

    // Listen for incoming messages
    socket.on('receive_message', (message) => {
      setMessages(prev => [...prev, message]);
    });
  };

  // Job alert modal countdown timer
  useEffect(() => {
    let timer;
    if (incomingJob && alertCountdown > 0) {
      timer = setTimeout(() => setAlertCountdown(alertCountdown - 1), 1000);
    } else if (incomingJob && alertCountdown === 0) {
      handleDeclineOffer();
    }
    return () => clearTimeout(timer);
  }, [incomingJob, alertCountdown]);

  // Handle active job setup (Socket join + Message history fetch)
  useEffect(() => {
    if (activeJob && socketRef.current) {
      // Emit socket room join
      socketRef.current.emit('join_job', activeJob._id);

      // Fetch existing message history
      fetch(`${API_URL}/api/jobs/${activeJob._id}/messages`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      })
        .then(res => res.json())
        .then(history => setMessages(history))
        .catch(err => console.error("Error fetching worker message history:", err));
    }
  }, [activeJob, socketRef.current]);

  // Toggle Availability
  const handleToggleAvailability = async () => {
    const updatedStatus = !isAvailable;
    setIsAvailable(updatedStatus);

    try {
      // If turning availability on, start watching GPS
      if (updatedStatus) {
        startWatchingLocation();
      } else {
        stopWatchingLocation();
      }

      const response = await fetch(`${API_URL}/api/workers/availability`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ isAvailable: updatedStatus })
      });
      if (!response.ok) {
        setIsAvailable(!updatedStatus);
        if (!updatedStatus) {
          startWatchingLocation();
        } else {
          stopWatchingLocation();
        }
      }
    } catch (error) {
      setIsAvailable(!updatedStatus);
      if (!updatedStatus) {
        startWatchingLocation();
      } else {
        stopWatchingLocation();
      }
    }
  };

  // Walkthrough Onboarding Tutorial steps for Worker
  const workerSteps = [
    {
      title: "Complete profile",
      description: "Review your profile and skills so customers match with your expertise quickly."
    },
    {
      title: "Turn availability ON",
      description: "Enable availability so the system can send you nearby customer requests in real-time."
    },
    {
      title: "Review incoming requests",
      description: "Incoming jobs appear as alert cards with customer issue details, location, and voice notes."
    },
    {
      title: "Track the job",
      description: "Use the active job tracker to navigate to the customer and mark your arrival. The customer confirms when work is done."
    }
  ];

  const handleTutorialNext = () => {
    if (tutorialStep < workerSteps.length) {
      setTutorialStep(tutorialStep + 1);
    } else {
      handleTutorialFinish();
    }
  };

  const handleTutorialFinish = () => {
    if (profile && profile._id) {
      localStorage.setItem(`skillsverse_tutorial_completed_${profile._id}`, 'true');
    }
    setShowTutorial(false);
  };

  const serviceSummary = [
    { label: 'Completed Services', value: earningsSummary.completedJobs, icon: CheckCircle },
    { label: 'Total Earned', value: `PKR ${earningsSummary.totalEarned.toLocaleString()}`, icon: CreditCard },
    { label: 'Pending Payment', value: `PKR ${earningsSummary.pendingAmount.toLocaleString()}`, icon: ListChecks }
  ];

  // Accept Job Offer
  const handleAcceptOffer = () => {
    if (!incomingJob) return;

    // Join room & emit accept
    socketRef.current.emit('join_job', incomingJob.jobId);
    socketRef.current.emit('accept_job', { jobId: incomingJob.jobId, workerId: profile._id });

    // Load active job details
    setTimeout(() => {
      loadActiveJob();
      setIsAvailable(false);
      setIncomingJob(null);
      setActiveTab('active-job');
    }, 500);
  };

  // Decline Job Offer
  const handleDeclineOffer = () => {
    if (!incomingJob) return;
    socketRef.current.emit('decline_job', { jobId: incomingJob.jobId });
    setIncomingJob(null);
  };

  // GPS Coordinate Simulation logic
  const startGpsSimulation = () => {
    if (!activeJob) return;
    setIsSimulatingGps(true);

    const customerLat = activeJob.location.latitude;
    const customerLon = activeJob.location.longitude;

    // Start with current worker coordinates or Karachi center
    let currLat = gpsLocation.latitude;
    let currLon = gpsLocation.longitude;

    simulationIntervalRef.current = setInterval(() => {
      // Step delta coordinates: move 10% closer to customer coordinates every second
      const stepLat = (customerLat - currLat) * 0.12;
      const stepLon = (customerLon - currLon) * 0.12;

      currLat += stepLat;
      currLon += stepLon;

      setGpsLocation({ latitude: currLat, longitude: currLon });

      // Emit coordinates over socket
      if (socketRef.current) {
        socketRef.current.emit('update_worker_location', {
          jobId: activeJob._id,
          workerId: profile._id,
          latitude: currLat,
          longitude: currLon
        });
      }

      // Check distance. If close enough, stop simulation and update status
      const dist = Math.abs(customerLat - currLat) + Math.abs(customerLon - currLon);
      if (dist < 0.0002) {
        stopGpsSimulation();
        handleUpdateStatus('en_route'); // "Arrived" state
        toast.info("Simulated tracking: You have arrived at the customer's address.");
      }
    }, 1000);
  };

  const stopGpsSimulation = () => {
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
    }
    setIsSimulatingGps(false);
  };

  // Update Status in database & notify customer
  const handleUpdateStatus = async (status) => {
    try {
      const response = await fetch(`${API_URL}/api/jobs/${activeJob._id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        setJobStatus(status);
        if (socketRef.current) {
          socketRef.current.emit('update_job_status', { jobId: activeJob._id, status });
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Send chat message
  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeJob) return;

    socketRef.current.emit('send_message', {
      jobId: activeJob._id,
      sender: 'worker',
      text: newMessage
    });
    setNewMessage('');
  };

  // If worker is still pending verification from Admin
  if (profile.status === 'pending') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 20px', minHeight: 'calc(100vh - 72px)' }}>
        <div className="card" style={{ maxWidth: '560px', textAlign: 'center', padding: '40px' }}>
          <AlertTriangle size={48} color="var(--warning-color)" style={{ margin: '0 auto 20px' }} />
          <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>Registration Pending Approval</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
            Thank you for registering with Skillsverse! Your profile credentials and skills are currently being evaluated by the Administration team. 
          </p>
          <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-grey)', borderRadius: '10px', padding: '16px', fontSize: '13px', textAlign: 'left' }}>
            <strong>Your Profile details:</strong>
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Name: {profile.name}</p>
            <p style={{ color: 'var(--text-secondary)' }}>Email: {profile.email}</p>
            <p style={{ color: 'var(--text-secondary)' }}>Registered Skills: {profile.skills.join(', ')}</p>
          </div>
          <button onClick={loadProfile} className="btn btn-primary" style={{ marginTop: '24px', width: '100%' }}>
            Check Approval Status
          </button>
        </div>
      </div>
    );
  }

  const pageMeta = {
    overview: { title: 'Overview', subtitle: 'Your earnings, profile, and performance at a glance.' },
    'active-job': { title: 'Active Job', subtitle: 'Navigate to the customer, chat, and update job status.' },
    history: { title: 'Service History', subtitle: 'Review past jobs and payment records.' },
  }[activeTab];

  return (
    <DashboardLayout
      sidebar={
        <WorkerSidebar
          activeTab={activeTab}
          onChange={setActiveTab}
          profile={profile}
          isAvailable={isAvailable}
          onToggleAvailability={handleToggleAvailability}
          hasActiveJob={Boolean(activeJob)}
          profileRef={profileRef}
          availabilityRef={availabilityRef}
        />
      }
      title={pageMeta.title}
      subtitle={pageMeta.subtitle}
      userName={profile?.name}
    >
      
      {/* Real-time job request notification alert modal */}
      {incomingJob && (
        <div ref={requestRef}
          style={{
            position: 'fixed',
            top: 'var(--header-height)',
            left: 0,
            width: '100%',
            height: 'calc(100% - var(--header-height))',
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '20px',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            backdropFilter: 'blur(8px)'
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '480px', border: '2px solid var(--primary-orange)', animation: 'pulseMic 2s infinite', margin: '20px auto', maxHeight: 'calc(100% - 80px)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ color: 'var(--primary-orange)', fontSize: '20px' }}>Incoming Daily Service Request!</h3>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--primary-orange)' }}>{alertCountdown}s</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              {/* Category */}
              <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: '8px' }}>
                <span className="form-label" style={{ fontSize: '11px' }}>Category Requested</span>
                <h4 style={{ fontSize: '18px', color: '#fff' }}>{incomingJob.category}</h4>
              </div>

              {/* Description */}
              <div>
                <span className="form-label" style={{ fontSize: '11px' }}>Description</span>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{incomingJob.description || 'No written details provided.'}</p>
              </div>

              {/* Customer Location */}
              <div>
                <span className="form-label" style={{ fontSize: '11px' }}>Customer Location</span>
                <p style={{ fontSize: '13px', color: '#fff', fontWeight: '600' }}>
                  {incomingJob.customer.location.address || `${incomingJob.customer.location.latitude.toFixed(4)}, ${incomingJob.customer.location.longitude.toFixed(4)}`}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>({incomingJob.distance} km away)</p>
              </div>

              {/* Customer Voice Issue */}
              {(incomingJob.voiceUrl || incomingJob.voiceTranscript) && (
                <div style={{ background: 'rgba(255, 107, 0, 0.05)', border: '1px dashed var(--primary-orange)', padding: '12px', borderRadius: '8px' }}>
                  <span className="form-label" style={{ fontSize: '11px', color: 'var(--primary-orange)', display: 'block', marginBottom: '4px' }}>Customer Voice Issue</span>
                  {incomingJob.voiceTranscript && (
                    <p style={{ fontSize: '13px', fontStyle: 'italic', marginBottom: '8px', color: '#fff' }}>"{incomingJob.voiceTranscript}"</p>
                  )}
                  {incomingJob.voiceUrl && (
                    <audio 
                      src={incomingJob.voiceUrl.startsWith('http') ? incomingJob.voiceUrl : `${API_URL}${incomingJob.voiceUrl}`} 
                      controls 
                      style={{ width: '100%', height: '36px' }} 
                    />
                  )}
                </div>
              )}

              {/* Request Time */}
              <div>
                <span className="form-label" style={{ fontSize: '11px' }}>Request Time</span>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {incomingJob.createdAt ? new Date(incomingJob.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : new Date().toLocaleTimeString()}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleDeclineOffer} className="btn btn-secondary" style={{ flex: 1 }}>
                Decline
              </button>
              <button onClick={handleAcceptOffer} className="btn btn-primary" style={{ flex: 2 }}>
                Accept Request
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'overview' && (
        <>
          <div className="stat-grid stat-grid--3">
            {serviceSummary.map((item) => (
              <div key={item.label} className="stat-card">
                <span className="stat-card__label">{item.label}</span>
                <h3 className="stat-card__value stat-card__value--accent">{item.value}</h3>
              </div>
            ))}
          </div>

          <div className="card card--padded">
            <div className="section-header">
              <User size={20} color="var(--primary-orange)" />
              <div className="section-header__text">
                <h3>Worker Profile</h3>
                <p>Your registered details and skill categories.</p>
              </div>
            </div>
            <div className="worker-profile-grid">
              <div>
                <span className="form-label">Full Name</span>
                <p className="worker-profile-value">{profile.name}</p>
              </div>
              <div>
                <span className="form-label">Email</span>
                <p className="worker-profile-value">{profile.email}</p>
              </div>
              <div>
                <span className="form-label">Total Jobs</span>
                <p className="worker-profile-value">{profile.totalRequests}</p>
              </div>
              <div>
                <span className="form-label">Completed</span>
                <p className="worker-profile-value worker-profile-value--success">{profile.completedRequests}</p>
              </div>
            </div>
            <div style={{ marginTop: '20px' }}>
              <span className="form-label">Registered Skills</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {profile.skills.map((s) => (
                  <StatusBadge key={s} status="info" label={s} />
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'active-job' && (
        <>
          {activeJob ? (
            <div ref={trackingRef} className="card job-tracking-grid job-tracking-grid--equal card--padded">
                {/* Tracker Panel */}
                <div>
                  <h3 style={{ fontSize: '18px', color: 'var(--primary-orange)', marginBottom: '16px' }}>Active Job Navigation</h3>

                  <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-grey)', marginBottom: '20px' }}>
                    <span className="form-label" style={{ fontSize: '10px' }}>Customer Address</span>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: '#fff', marginBottom: '10px' }}>{activeJob.location.address}</p>

                    <span className="form-label" style={{ fontSize: '10px' }}>Service Category</span>
                    <p style={{ fontSize: '13px', fontWeight: '600' }}>{activeJob.category}</p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {jobStatus === 'assigned' && (
                      <>
                        <button 
                          onClick={isSimulatingGps ? stopGpsSimulation : startGpsSimulation} 
                          className="btn btn-primary"
                          style={{ width: '100%', padding: '12px' }}
                        >
                          <Navigation size={16} />
                          {isSimulatingGps ? 'Stop GPS Simulation' : 'Start Live GPS Simulation'}
                        </button>
                        <button 
                          onClick={() => handleUpdateStatus('en_route')} 
                          className="btn btn-secondary"
                          style={{ width: '100%', padding: '12px' }}
                        >
                          Arrived at customer
                        </button>
                      </>
                    )}

                    {jobStatus === 'en_route' && (
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', padding: '8px 0' }}>
                        Waiting for the customer to confirm work completion.
                      </p>
                    )}

                    {isSimulatingGps && (
                      <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--primary-orange)' }}>
                        Simulating GPS vehicle coordinates movement towards destination...
                        <p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Lat: {gpsLocation.latitude.toFixed(4)} | Lon: {gpsLocation.longitude.toFixed(4)}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Chat Column */}
                <div className="worker-job-chat">
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                    <MessageSquare size={16} color="var(--primary-orange)" />
                    <h4 style={{ fontSize: '14px' }}>Chat with Customer</h4>
                  </div>

                  <div className="chat-window" style={{ height: '340px' }}>
                    <div className="chat-messages">
                      {messages.length === 0 ? (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}>
                          Start typing to speak with customer.
                        </div>
                      ) : (
                        messages.map((msg, i) => (
                          <div key={i} className={`chat-bubble ${msg.sender}`} style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
                            {msg.text && <div>{msg.text}</div>}
                            {msg.voiceUrl && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <audio 
                                  src={msg.voiceUrl.startsWith('http') ? msg.voiceUrl : `${API_URL}${msg.voiceUrl}`} 
                                  controls 
                                  style={{ width: '100%', height: '32px', minWidth: '150px' }} 
                                />
                                {msg.voiceDuration > 0 && (
                                  <span style={{ fontSize: '10px', color: '#fff', opacity: 0.8 }}>
                                    {Math.floor(msg.voiceDuration / 60)}:{(msg.voiceDuration % 60).toString().padStart(2, '0')}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={sendMessage} className="chat-input-area" style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', background: 'var(--bg-input)' }}>
                      {isChatRecording ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span 
                              style={{ 
                                width: '10px', 
                                height: '10px', 
                                borderRadius: '50%', 
                                background: 'var(--error-color)', 
                                animation: 'pulseMic 1s infinite' 
                              }} 
                            />
                            <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                              Recording ({chatRecordingDuration}s)...
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button 
                              type="button" 
                              className="btn btn-secondary" 
                              onClick={() => stopChatRecording(false)}
                              style={{ padding: '4px 8px', fontSize: '12px', borderColor: 'var(--error-color)', color: 'var(--error-color)' }}
                            >
                              Cancel
                            </button>
                            <button 
                              type="button" 
                              className="btn btn-primary" 
                              onClick={() => stopChatRecording(true)}
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            >
                              Send
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <input 
                            type="text"
                            placeholder="Type message..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            className="chat-input"
                            style={{ flex: 1, border: 'none', background: 'transparent', color: '#fff', padding: '12px' }}
                          />
                          <button 
                            type="button" 
                            onClick={startChatRecording}
                            style={{ background: 'none', border: 'none', padding: '0 8px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                            title="Record Voice Message"
                          >
                            <Mic size={18} />
                          </button>
                          <button type="submit" style={{ background: 'none', border: 'none', padding: '0 16px', color: 'var(--primary-orange)', cursor: 'pointer' }}>
                            <Send size={16} />
                          </button>
                        </>
                      )}
                    </form>
                  </div>
                </div>
              </div>
          ) : (
            <EmptyState
              icon={Briefcase}
              title="No active service requests"
              description="Turn availability ON in the sidebar to start receiving real-time matching jobs."
              action={
                !isAvailable ? (
                  <button type="button" className="btn btn-primary" onClick={handleToggleAvailability}>
                    Go Online
                  </button>
                ) : null
              }
            />
          )}
        </>
      )}

      {activeTab === 'history' && (
        <div className="card card--padded">
            <div className="section-header">
              <ListChecks size={20} color="var(--primary-orange)" />
              <div className="section-header__text">
                <h3>Service History</h3>
                <p>Your recent jobs, payments, and completed service log.</p>
              </div>
            </div>
            {historyLoading ? (
              <TableSkeleton rows={4} cols={5} />
            ) : jobsHistory.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="No service history yet"
                description="Completed and assigned jobs will appear here."
              />
            ) : (
              <>
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-grey)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '12px' }}>Service</th>
                        <th style={{ padding: '12px' }}>Customer</th>
                        <th style={{ padding: '12px' }}>Date</th>
                        <th style={{ padding: '12px' }}>Status</th>
                        <th style={{ padding: '12px' }}>Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleHistory.map((job) => (
                        <tr key={job._id} style={{ borderBottom: '1px solid var(--border-grey)' }}>
                          <td style={{ padding: '12px' }}>{job.category}</td>
                          <td style={{ padding: '12px' }}>{job.customer?.name || 'Customer'}</td>
                          <td style={{ padding: '12px' }}>{new Date(job.createdAt).toLocaleDateString()}</td>
                          <td><StatusBadge status={job.status} /></td>
                          <td style={{ padding: '12px' }}>
                            {job.payment.status === 'paid' ? `Paid PKR ${job.payment.amount}` : `Held PKR ${job.payment.amount}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={historyPage}
                  totalPages={historyTotalPages}
                  totalItems={jobsHistory.length}
                  pageSize={itemsPerPage}
                  onPageChange={setHistoryPage}
                  itemLabel="records"
                />
              </>
            )}
        </div>
      )}

      {showTutorial && highlightRect && (
        <>
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.8)',
            pointerEvents: 'none',
            zIndex: 998
          }} />
          <div style={{
            position: 'absolute',
            top: highlightRect.top,
            left: highlightRect.left,
            width: highlightRect.width,
            height: highlightRect.height,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.85)',
            borderRadius: '18px',
            border: '2px solid var(--primary-orange)',
            transition: 'all 0.3s ease',
            zIndex: 999,
            pointerEvents: 'none'
          }} />
        </>
      )}
      {/* Onboarding walkthrough Modal */}
      {showTutorial && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(12, 12, 14, 0.9)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)'
        }}>
          <div className="card" style={{
            maxWidth: '500px',
            width: '90%',
            padding: '40px',
            border: '2px solid var(--primary-orange)',
            boxShadow: 'var(--shadow-glow)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{
                color: 'var(--primary-orange)',
                fontWeight: '800',
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.1em'
              }}>
                Step {tutorialStep} of {workerSteps.length}
              </span>
              <h3 style={{ fontSize: '24px' }}>{workerSteps[tutorialStep - 1].title}</h3>
            </div>

            <p style={{
              color: 'var(--text-secondary)',
              lineHeight: '1.6',
              fontSize: '15px'
            }}>
              {workerSteps[tutorialStep - 1].description}
            </p>

            {/* Progress indicators */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', margin: '10px 0' }}>
              {workerSteps.map((_, index) => (
                <div 
                  key={index}
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: (index + 1) === tutorialStep ? 'var(--primary-orange)' : 'var(--border-grey)',
                    transition: 'var(--transition)'
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={handleTutorialFinish}
                style={{ flex: 1 }}
              >
                Skip
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleTutorialNext}
                style={{ flex: 2 }}
              >
                {tutorialStep === workerSteps.length ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}
