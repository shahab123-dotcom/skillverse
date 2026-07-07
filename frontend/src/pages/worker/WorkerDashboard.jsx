import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { MapPin, Phone, CheckCircle, Navigation, Send, AlertTriangle, MessageSquare, Mic, ListChecks, CreditCard, Briefcase, User, Map, Check, X, Hammer, X as XIcon, Building2 } from 'lucide-react';
import { API_URL } from '../../App';
import { useToast } from '../../context/ToastContext';
import DashboardLayout from '../../components/shared/DashboardLayout';
import WorkerSidebar from '../../components/worker/WorkerSidebar';
import StatusBadge from '../../components/shared/StatusBadge';
import EmptyState from '../../components/shared/EmptyState';
import Pagination from '../../components/shared/Pagination';
import { TableSkeleton } from '../../components/shared/LoadingSkeleton';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

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
  const isContractorUser = Boolean(
    (Array.isArray(profile?.skills) && profile.skills.includes('Contractor')) ||
    profile?.isContractor ||
    profile?.contractorProfile?.status === 'pending' ||
    profile?.contractorProfile?.status === 'approved' ||
    profile?.contractorProfile?.status === 'rejected'
  );
  const [contractorForm, setContractorForm] = useState({
    companyName: user.contractorProfile?.companyName || '',
    experienceYears: user.contractorProfile?.experienceYears || '',
    specialization: user.contractorProfile?.specialization || '',
    serviceArea: user.contractorProfile?.serviceArea || '',
    city: user.contractorProfile?.city || '',
    residenceArea: user.contractorProfile?.residenceArea || '',
    exactLocation: user.contractorProfile?.exactLocation || ''
  });
  const [contractorLoading, setContractorLoading] = useState(false);
  const [contractorError, setContractorError] = useState('');
  const [contractorSuccess, setContractorSuccess] = useState('');

  useEffect(() => {
    if (profile?.contractorProfile) {
      setContractorForm({
        companyName: profile.contractorProfile.companyName || '',
        experienceYears: profile.contractorProfile.experienceYears || '',
        specialization: profile.contractorProfile.specialization || '',
        serviceArea: profile.contractorProfile.serviceArea || '',
        city: profile.contractorProfile.city || '',
        residenceArea: profile.contractorProfile.residenceArea || '',
        exactLocation: profile.contractorProfile.exactLocation || ''
      });
    }
  }, [profile]);

  const [constructionProjects, setConstructionProjects] = useState([]);
  const [contractorCityFilter, setContractorCityFilter] = useState('');
  const [selectedProjectLocation, setSelectedProjectLocation] = useState(null);
  const [selectedBidJob, setSelectedBidJob] = useState(null);
  const [bidForm, setBidForm] = useState({ bidAmount: '', completionDays: '', notes: '' });
  const itemsPerPage = 10;
  const [historyPage, setHistoryPage] = useState(1);
  const [constructionPage, setConstructionPage] = useState(1);
  const [earningsSummary, setEarningsSummary] = useState({ totalEarned: 0, pendingAmount: 0, completedJobs: 0 });
  const [recentReviews, setRecentReviews] = useState([]);

  // Active Job State
  const [activeJob, setActiveJob] = useState(null);
  const [jobStatus, setJobStatus] = useState(''); // 'assigned', 'en_route', 'completed'
  const [highlightRect, setHighlightRect] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [historyLoading, setHistoryLoading] = useState(true);

  // Job Alert offer modal
  const [incomingJob, setIncomingJob] = useState(null);
  const [alertCountdown, setAlertCountdown] = useState(30);

  // GPS state
  const [gpsLocation, setGpsLocation] = useState({ latitude: 24.8607, longitude: 67.0011 });
  const [isSimulatingGps, setIsSimulatingGps] = useState(false);
  const [socketConnectionStatus, setSocketConnectionStatus] = useState('connected');

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
  const latestProfileRef = useRef(user);
  const isAvailableRef = useRef(user.isAvailable);

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
    latestProfileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    isAvailableRef.current = isAvailable;
  }, [isAvailable]);

  const notifyWorkerAvailable = () => {
    const workerId = String(latestProfileRef.current?._id || latestProfileRef.current?.id || user.id || user._id || '');
    if (!workerId || !socketRef.current?.connected || !isAvailableRef.current) return;
    socketRef.current.emit('worker_available', { workerId });
  };

  useEffect(() => {
    loadProfile();
    loadActiveJob();
    loadWorkerHistory();
    loadConstructionProjects();
    loadReviews();
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

  const loadConstructionProjects = async () => {
    try {
      const response = await fetch(`${API_URL}/api/jobs/worker/construction`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (response.ok) {
        setConstructionProjects(data);
        setConstructionPage(1);
      }
    } catch (error) {
      console.error('Failed to load construction projects:', error);
    }
  };

  const loadReviews = async () => {
    try {
      const response = await fetch(`${API_URL}/api/workers/me/reviews`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (response.ok) {
        setRecentReviews(data);
      }
    } catch (error) {
      console.error('Failed to load reviews:', error);
    }
  };

  const getPaginatedItems = (items, page) => items.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const getTotalPages = (items) => Math.max(1, Math.ceil(items.length / itemsPerPage));

  const filteredConstructionProjects = constructionProjects.filter((job) => {
    const normalizedFilter = contractorCityFilter.trim().toLowerCase();
    if (!normalizedFilter) return true;

    const addressText = [
      job.location?.manualAddress,
      job.location?.address,
      job.customer?.name,
      job.category
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return addressText.includes(normalizedFilter);
  });

  const filteredContractorOffers = filteredConstructionProjects.filter(job => job.status === 'contractor_offers_sent');

  const visibleHistory = getPaginatedItems(jobsHistory, historyPage);
  const historyTotalPages = getTotalPages(jobsHistory);
  const visibleConstruction = getPaginatedItems(filteredConstructionProjects, constructionPage);
  const constructionTotalPages = getTotalPages(filteredConstructionProjects);

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
    const stepRefs = [profileRef, availabilityRef, requestRef];
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

  const getAddressText = (location) => {
    const rawAddress = location?.manualAddress?.trim?.() || location?.address?.trim?.() || '';
    if (rawAddress) return rawAddress;

    if (location?.latitude != null && location?.longitude != null) {
      return `${Number(location.latitude).toFixed(4)}, ${Number(location.longitude).toFixed(4)}`;
    }

    return 'Address not provided';
  };

  const getDistanceKm = (fromLat, fromLon, toLat, toLon) => {
    if ([fromLat, fromLon, toLat, toLon].some((value) => value === undefined || value === null || Number.isNaN(Number(value)))) {
      return 0;
    }

    const toRad = (value) => (Number(value) * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(toLat - fromLat);
    const dLon = toRad(toLon - fromLon);
    const lat1 = toRad(fromLat);
    const lat2 = toRad(toLat);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const syncWorkerLocation = (lat, lon) => {
    const nextCoords = { latitude: lat, longitude: lon };
    setGpsLocation(nextCoords);
    updateBackendLocation(lat, lon);

    const currentJob = activeJobRef.current;
    const workerId = latestProfileRef.current?._id || profile?._id;
    if (currentJob && socketRef.current && workerId) {
      socketRef.current.emit('update_worker_location', {
        jobId: currentJob._id,
        workerId,
        latitude: lat,
        longitude: lon
      });
    }
  };

  // Continuous GPS updates
  const startWatchingLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported in this browser.');
      return;
    }

    if (locationWatchRef.current) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
      locationWatchRef.current = null;
    }

    const handleLocationSuccess = (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      syncWorkerLocation(lat, lon);
    };

    const handleLocationError = (error) => {
      console.warn('Geolocation watch failed:', error);
      toast.error('Location access is blocked. Please allow browser GPS access and refresh the page.');
    };

    navigator.geolocation.getCurrentPosition(handleLocationSuccess, handleLocationError, {
      enableHighAccuracy: true,
      timeout: 10000
    });

    locationWatchRef.current = navigator.geolocation.watchPosition(
      handleLocationSuccess,
      handleLocationError,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  };

  const stopWatchingLocation = () => {
    if (locationWatchRef.current) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
      locationWatchRef.current = null;
    }
  };

  useEffect(() => {
    if (!profile?.status || profile.status !== 'approved') return;
    if (isAvailable || activeJob) {
      startWatchingLocation();
      return () => stopWatchingLocation();
    }
    stopWatchingLocation();
  }, [profile?.status, isAvailable, activeJob?._id]);

  // Ensure worker notifies availability when socket connects
  useEffect(() => {
    if (socketConnectionStatus === 'connected' && isAvailable && socketRef.current?.connected) {
      notifyWorkerAvailable();
    }
  }, [socketConnectionStatus, isAvailable]);

  // Load Profile from DB
  const loadProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/profile`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (response.ok && data.user) {
        setProfile(data.user);
        setIsAvailable(data.user.isAvailable);

        // Initialize Sockets if Worker is approved
        if (data.user.status === 'approved') {
          setupSockets(data.user);
          if (data.user.isAvailable) {
            isAvailableRef.current = true;
            startWatchingLocation();
          } else {
            fetchWorkerLocation();
          }
        }
      } else {
        console.error('Failed to load profile:', data.error);
        toast.error('Failed to load profile');
      }
    } catch (error) {
      console.error('Profile loading error:', error);
      toast.error('Failed to load profile');
    }
  };

  const handleContractorSubmit = async (e) => {
    e.preventDefault();
    setContractorLoading(true);
    setContractorError('');
    setContractorSuccess('');

    try {
      const response = await fetch(`${API_URL}/api/workers/request-contractor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          companyName: contractorForm.companyName,
          experienceYears: Number(contractorForm.experienceYears),
          specialization: contractorForm.specialization,
          serviceArea: contractorForm.serviceArea,
          city: contractorForm.city,
          residenceArea: contractorForm.residenceArea,
          exactLocation: contractorForm.exactLocation,
          latitude: gpsLocation.latitude,
          longitude: gpsLocation.longitude
        })
      });

      const data = await response.json();
      if (response.ok) {
        setContractorSuccess('Contractor profile submitted successfully. Pending admin review.');
        toast.success('Contractor profile submitted!');
        loadProfile(); // Refresh profile state
      } else {
        setContractorError(data.error || 'Failed to submit contractor profile.');
      }
    } catch (err) {
      console.error(err);
      setContractorError('Network error. Failed to submit profile.');
    } finally {
      setContractorLoading(false);
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
          const nextCoords = { latitude: lat, longitude: lon };
          setGpsLocation(nextCoords);
          updateTrackingStats(nextCoords);
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
    setSocketConnectionStatus('connected');
    setActiveTab('overview');
    loadWorkerHistory();
    loadConstructionProjects();
    loadProfile();
  };

  const handleConstructionResponse = async (jobId, action) => {
    try {
      const response = await fetch(`${API_URL}/api/jobs/${jobId}/worker-response`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ action })
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message);
        loadConstructionProjects();
        loadWorkerHistory();
      } else {
        toast.error(data.error || 'Failed to respond to assignment');
      }
    } catch (error) {
      console.error('Failed to respond to construction assignment:', error);
      toast.error('Failed to respond to assignment');
    }
  };

  const handleBidSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/jobs/${selectedBidJob._id}/bid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          bidAmount: Number(bidForm.bidAmount),
          completionDays: Number(bidForm.completionDays),
          notes: bidForm.notes,
          // Send current profile city/area so admin sees correct location even for older profiles
          bidderCity: profile?.contractorProfile?.city || contractorForm.city || '',
          bidderResidenceArea: profile?.contractorProfile?.residenceArea || contractorForm.residenceArea || ''
        })
      });
      const data = await response.json();
      if (response.ok) {
        toast.success('Bid submitted successfully');
        setSelectedBidJob(null);
        setBidForm({ bidAmount: '', completionDays: '', notes: '' });
        loadConstructionProjects();
        loadWorkerHistory();
      } else {
        toast.error(data.error || 'Failed to submit bid');
      }
    } catch (error) {
      console.error('Failed to submit bid:', error);
      toast.error('Failed to submit bid');
    }
  };

  const handleRejectJob = async () => {
    if (!activeJob) return;
    try {
      const response = await fetch(`${API_URL}/api/jobs/${activeJob._id}/reject`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        toast.success('Job rejected successfully');
        clearJobState();
      } else {
        toast.error(data.error || 'Failed to reject job');
      }
    } catch (error) {
      console.error('Failed to reject job:', error);
      toast.error('Failed to reject job');
    }
  };

  // Sockets Setup
  const connectionErrorShownRef = useRef(false);

  const setupSockets = (worker) => {
    if (socketRef.current) socketRef.current.disconnect();

    connectionErrorShownRef.current = false;
    const socket = io(API_URL, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      const workerId = String(worker._id || worker.id);
      socket.emit('register', workerId);
      setSocketConnectionStatus('connected');
      if (isAvailableRef.current) {
        socket.emit('worker_available', { workerId });
      }
      if (connectionErrorShownRef.current) {
        toast.success('Connection restored.');
        connectionErrorShownRef.current = false;
      }
    });

    socket.on('connect_error', () => {
      setSocketConnectionStatus('reconnecting');
      if (!connectionErrorShownRef.current) {
        toast.error('Connection lost. Reconnecting...');
        connectionErrorShownRef.current = true;
      }
    });

    socket.on('disconnect', () => {
      setSocketConnectionStatus('disconnected');
      if (!connectionErrorShownRef.current) {
        toast.info('Connection disconnected. Reconnect when network is available.');
        connectionErrorShownRef.current = true;
      }
    });

    // Listen for incoming match requests
    socket.on('incoming_job_request', (offer) => {
      console.log('[Worker Socket] incoming_job_request received', offer);
      toast.info('New Service Request');
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

    // Job rejected (by customer or worker) — clear active job
    socket.on('job_rejected', ({ jobId }) => {
      const matchesActive = activeJobRef.current && String(activeJobRef.current._id) === String(jobId);
      if (matchesActive) {
        clearJobState();
        toast.info('Job has been rejected and returned to pending');
        loadWorkerHistory();
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

    // Listen for worker rating update
    socket.on('worker_rating_updated', (data) => {
      if (latestProfileRef.current?._id === data.workerId) {
        setProfile(prev => ({ ...prev, averageRating: data.averageRating, totalReviews: data.totalReviews }));
        if (data.latestReview) {
          setRecentReviews(prev => [data.latestReview, ...prev].slice(0, 20));
        }
      }
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
    const previousStatus = isAvailable;

    try {
      const response = await fetch(`${API_URL}/api/workers/availability`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ isAvailable: updatedStatus })
      });

      if (!response.ok) {
        toast.error('Failed to update availability.');
        return;
      }

      setIsAvailable(updatedStatus);
      isAvailableRef.current = updatedStatus;

      if (updatedStatus) {
        startWatchingLocation();
        notifyWorkerAvailable();
        toast.success('You are online and can receive job requests.');
      } else {
        stopWatchingLocation();
        toast.info('You are offline.');
      }
    } catch (error) {
      setIsAvailable(previousStatus);
      isAvailableRef.current = previousStatus;
      toast.error('Failed to update availability.');
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
    socketRef.current.emit('accept_job', { jobId: incomingJob.jobId, workerId: String(profile._id || profile.id) });

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
    const workerId = String(profile._id || profile.id || user.id || '');
    socketRef.current.emit('decline_job', { jobId: incomingJob.jobId, workerId });
    setIncomingJob(null);
  };

  // GPS Coordinate Simulation logic
  const startGpsSimulation = () => {
    if (!activeJob) return;
    if (navigator.geolocation) {
      toast.info('Using your browser GPS location for live tracking.');
      startWatchingLocation();
      return;
    }
    setIsSimulatingGps(true);

    const customerLat = activeJob.location.latitude;
    const customerLon = activeJob.location.longitude;

    // Start with current worker coordinates or Karachi center
    let currLat = Number(gpsLocation.latitude);
    let currLon = Number(gpsLocation.longitude);

    simulationIntervalRef.current = setInterval(() => {
      const currentDistanceKm = getDistanceKm(currLat, currLon, customerLat, customerLon);
      const stepDistanceKm = Math.max(0.08, Math.min(0.4, currentDistanceKm / 6));

      const toRad = (value) => (Number(value) * Math.PI) / 180;
      const fromRad = (value) => (Number(value) * 180) / Math.PI;

      const lat1 = toRad(currLat);
      const lon1 = toRad(currLon);
      const lat2 = toRad(customerLat);
      const lon2 = toRad(customerLon);
      const dLon = lon2 - lon1;
      const y = Math.sin(dLon) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
      const bearing = Math.atan2(y, x);
      const delta = stepDistanceKm / 6371;

      const nextLat = Math.asin(
        Math.sin(lat1) * Math.cos(delta) + Math.cos(lat1) * Math.sin(delta) * Math.cos(bearing)
      );
      const nextLon = lon1 + Math.atan2(
        Math.sin(bearing) * Math.sin(delta) * Math.cos(lat1),
        Math.cos(delta) - Math.sin(lat1) * Math.sin(nextLat)
      );

      currLat = fromRad(nextLat);
      currLon = fromRad(nextLon);

      const nextCoords = { latitude: currLat, longitude: currLon };
      setGpsLocation(nextCoords);
      updateTrackingStats(nextCoords);

      if (socketRef.current) {
        socketRef.current.emit('update_worker_location', {
          jobId: activeJob._id,
          workerId: profile._id,
          latitude: currLat,
          longitude: currLon
        });
      }

      if (getDistanceKm(currLat, currLon, customerLat, customerLon) < 0.08) {
        stopGpsSimulation();
        handleUpdateStatus('en_route');
        toast.info('Simulated tracking: You have arrived at the customer\'s address.');
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
  if (profile?.status === 'pending') {
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
            <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Name: {profile?.name}</p>
            <p style={{ color: 'var(--text-secondary)' }}>Email: {profile?.email}</p>
            <p style={{ color: 'var(--text-secondary)' }}>Registered Skills: {profile?.skills?.join(', ') || 'None'}</p>
          </div>
          <button onClick={loadProfile} className="btn btn-primary" style={{ marginTop: '24px', width: '100%' }}>
            Check Approval Status
          </button>
        </div>
      </div>
    );
  }

  // If worker registration was rejected
  if (profile?.status === 'rejected') {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 20px', minHeight: 'calc(100vh - 72px)' }}>
        <div className="card" style={{ maxWidth: '560px', textAlign: 'center', padding: '40px' }}>
          <AlertTriangle size={48} color="var(--error-color)" style={{ margin: '0 auto 20px' }} />
          <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>Registration Rejected</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
            Unfortunately, your application to join Skillsverse as a service provider has been rejected. Please contact support for more information.
          </p>
          <button onClick={() => window.location.href = '/'} className="btn btn-primary" style={{ marginTop: '24px', width: '100%' }}>
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  // If profile is not loaded yet, show loading state
  if (!profile || !profile._id) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 20px', minHeight: 'calc(100vh - 72px)' }}>
        <div className="card" style={{ maxWidth: '560px', textAlign: 'center', padding: '40px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid var(--primary-orange)', borderRadius: '50%', borderTop: '3px solid transparent', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }} />
          <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>Loading your profile...</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Please wait while we retrieve your profile information.</p>
        </div>
      </div>
    );
  }

  const pageMeta = {
    overview: { title: 'Overview', subtitle: 'Your earnings, profile, and performance at a glance.' },
    'active-job': { title: 'Active Job', subtitle: 'Navigate to the customer, chat, and update job status.' },
    'construction': { title: 'Contractor Projects', subtitle: 'Review assigned contractor projects and locations.' },
    'contractor-offers': { title: 'Contractor Offers', subtitle: 'Review contractor-specific service opportunities and profile status.' },
    history: { title: 'Service History', subtitle: 'Review past jobs and payment records.' },
  }[activeTab] || { title: 'Worker Dashboard', subtitle: 'Manage your jobs and profile.' };

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
      title={pageMeta?.title || 'Worker Dashboard'}
      subtitle={pageMeta?.subtitle || 'Manage your jobs and profile.'}
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
              {/* Customer Name */}
              <div style={{ background: 'var(--bg-input)', padding: '14px', borderRadius: '8px' }}>
                <span className="form-label" style={{ fontSize: '11px' }}>Customer Name</span>
                <h4 style={{ fontSize: '18px', color: '#fff' }}>{incomingJob.customer?.name || 'Unknown Customer'}</h4>
              </div>

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
                  {getAddressText(incomingJob.customer?.location)}
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

            {profile.averageRating !== undefined && profile.totalReviews !== undefined && (
              <div style={{ marginTop: '24px', padding: '16px', borderRadius: '12px', background: 'var(--bg-dashboard)', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                <h4 style={{ fontSize: '15px', color: '#fbbf24', marginBottom: '12px' }}>Worker Rating & Feedback</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#fff', lineHeight: '1' }}>{profile.averageRating.toFixed(1)}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', color: '#fbbf24', fontSize: '18px' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star}>{star <= Math.round(profile.averageRating) ? '★' : '☆'}</span>
                      ))}
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Based on {profile.totalReviews} reviews</span>
                  </div>
                </div>
                {recentReviews.length > 0 && (
                  <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Recent Feedback</span>
                    {recentReviews.slice(0, 3).map(review => (
                      <div key={review._id} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>{review.customer?.name || 'Customer'}</span>
                          <span style={{ color: '#fbbf24', fontSize: '12px' }}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                        </div>
                        {review.feedback && <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>"{review.feedback}"</p>}
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: '20px' }}>
              <span className="form-label">Registered Skills</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {profile.skills.map((s) => (
                  <StatusBadge key={s} status="info" label={s} />
                ))}
              </div>
            </div>

            {isContractorUser && (
              <div style={{ marginTop: '20px' }}>
                <span className="form-label">Contractor Profile</span>
                <div className="worker-profile-grid" style={{ marginTop: '10px' }}>
                  <div>
                    <span className="form-label">Company</span>
                    <p className="worker-profile-value">{profile.contractorProfile?.companyName || 'Not provided'}</p>
                  </div>
                  <div>
                    <span className="form-label">Specialization</span>
                    <p className="worker-profile-value">{profile.contractorProfile?.specialization || 'Not provided'}</p>
                  </div>
                  <div>
                    <span className="form-label">Service Area</span>
                    <p className="worker-profile-value">{profile.contractorProfile?.serviceArea || 'Not provided'}</p>
                  </div>
                  <div>
                    <span className="form-label">Status</span>
                    <p className="worker-profile-value">{profile.contractorProfile?.status === 'approved' ? 'Approved' : profile.contractorProfile?.status === 'pending' ? 'Pending review' : profile.contractorProfile?.status === 'rejected' ? 'Rejected' : 'Not submitted'}</p>
                  </div>
                </div>
              </div>
            )}

            {!isContractorUser && (
              <div style={{ marginTop: '30px', padding: '20px', background: 'var(--bg-card)', border: '1px solid var(--border-grey)', borderRadius: '12px' }}>
                <h4 style={{ color: 'var(--primary-orange)', marginBottom: '16px' }}>Become a Contractor</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Register as a contractor to access large-scale construction projects and submit competitive bids.
                </p>
                {contractorError && <div style={{ color: 'var(--error-color)', fontSize: '13px', marginBottom: '16px' }}>{contractorError}</div>}
                {contractorSuccess && <div style={{ color: 'var(--success-color)', fontSize: '13px', marginBottom: '16px' }}>{contractorSuccess}</div>}
                <form onSubmit={handleContractorSubmit} style={{ display: 'grid', gap: '16px' }}>
                  <div className="worker-mobile-stack">
                    <div className="form-group">
                      <label className="form-label">Company Name</label>
                      <input type="text" className="form-input" value={contractorForm.companyName} onChange={e => setContractorForm({ ...contractorForm, companyName: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Experience (Years)</label>
                      <input type="number" className="form-input" value={contractorForm.experienceYears} onChange={e => setContractorForm({ ...contractorForm, experienceYears: e.target.value })} required />
                    </div>
                  </div>
                  <div className="worker-mobile-stack">
                    <div className="form-group">
                      <label className="form-label">Specialization</label>
                      <input type="text" className="form-input" placeholder="e.g. Structural, Plumbing" value={contractorForm.specialization} onChange={e => setContractorForm({ ...contractorForm, specialization: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">City</label>
                      <select className="form-input" value={contractorForm.city} onChange={e => setContractorForm({ ...contractorForm, city: e.target.value })} required>
                        <option value="">Select City</option>
                        {['Lahore', 'Karachi', 'Islamabad', 'Rahim Yar Khan', 'Multan', 'Faisalabad', 'Rawalpindi', 'Bahawalpur'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="worker-mobile-stack">
                    <div className="form-group">
                      <label className="form-label">Residence Area</label>
                      <input type="text" className="form-input" placeholder="e.g. Clifton Block 5" value={contractorForm.residenceArea} onChange={e => setContractorForm({ ...contractorForm, residenceArea: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Exact Location / Address</label>
                      <input type="text" className="form-input" placeholder="Detailed address" value={contractorForm.exactLocation} onChange={e => setContractorForm({ ...contractorForm, exactLocation: e.target.value })} required />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={contractorLoading} style={{ justifySelf: 'start', padding: '10px 20px' }}>
                    {contractorLoading ? 'Submitting...' : 'Submit Contractor Profile'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'active-job' && (
        <>
          {activeJob ? (
            <>
              <div className="card card--padded">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '20px' }}>Active Job</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Category: <strong>{activeJob.category}</strong></p>
                </div>
                <StatusBadge status={jobStatus === 'assigned' ? 'assigned' : jobStatus === 'en_route' ? 'en_route' : 'completed'} label={jobStatus} />
              </div>

              {/* Location Cards */}
              <div className="worker-mobile-stack" style={{ marginBottom: '20px' }}>
                {/* Worker Location */}
                <div style={{ background: 'var(--bg-input)', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-grey)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,107,0,0.15)', border: '1px solid rgba(255,107,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>👷</div>
                    <span style={{ fontWeight: '700', color: '#fff', fontSize: '14px' }}>Your Location</span>
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    GPS: {gpsLocation.latitude.toFixed(5)}, {gpsLocation.longitude.toFixed(5)}
                  </p>
                </div>

                {/* Customer Location */}
                <div style={{ background: 'var(--bg-input)', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-grey)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🏠</div>
                    <span style={{ fontWeight: '700', color: '#fff', fontSize: '14px' }}>Customer Location</span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#fff', fontWeight: '600', marginBottom: '6px' }}>
                    {getAddressText(activeJob.location)}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    GPS: {activeJob.location.latitude.toFixed(5)}, {activeJob.location.longitude.toFixed(5)}
                  </p>
                </div>
              </div>

              {/* Simple Map */}
              <div style={{ height: '300px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-grey)' }}>
                <MapContainer
                  center={[gpsLocation.latitude, gpsLocation.longitude]}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                  />
                  <Marker position={[gpsLocation.latitude, gpsLocation.longitude]}>
                    <Popup>Your Location</Popup>
                  </Marker>
                  <Marker position={[activeJob.location.latitude, activeJob.location.longitude]}>
                    <Popup>Customer Location</Popup>
                  </Marker>
                </MapContainer>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                {jobStatus === 'assigned' && (
                  <>
                    <button
                      onClick={() => handleUpdateStatus('en_route')}
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '12px' }}
                    >
                      Arrived at customer
                    </button>
                    <button
                      onClick={handleRejectJob}
                      className="btn btn-secondary"
                      style={{ width: '100%', padding: '12px', borderColor: 'var(--error-color)', color: 'var(--error-color)' }}
                    >
                      <XIcon size={16} style={{ marginRight: '6px' }} />
                      Reject Job
                    </button>
                  </>
                )}

                {jobStatus === 'en_route' && (
                  <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(34,197,94,0.07)', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <p style={{ fontSize: '13px', color: '#86efac', marginBottom: '4px' }}>✅ You have arrived at the customer location.</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Work in progress — the customer will confirm completion and make the payment.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Chat Section */}
            <div className="card card--padded" style={{ marginTop: '20px' }}>
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
            </>
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

      {activeTab === 'contractor-offers' && (
        <div className="card card--padded">
          <div className="section-header">
            <Briefcase size={20} color="var(--primary-orange)" />
            <div className="section-header__text">
              <h3>Contractor Offers</h3>
              <p>Contractor opportunities and profile review updates appear here.</p>
            </div>
          </div>
          <div className="worker-profile-grid">
            <div>
              <span className="form-label">Current contractor status</span>
              <p className="worker-profile-value">{profile.contractorProfile?.status === 'approved' ? 'Approved for contractor projects' : profile.contractorProfile?.status === 'pending' ? 'Pending admin review' : profile.contractorProfile?.status === 'rejected' ? 'Rejected by admin' : 'Profile not submitted'}</p>
            </div>
            <div>
              <span className="form-label">Service area</span>
              <p className="worker-profile-value">{profile.contractorProfile?.serviceArea || 'Not provided yet'}</p>
            </div>
            <div>
              <span className="form-label">Available opportunities</span>
              <p className="worker-profile-value">{filteredContractorOffers.length > 0 ? `${filteredContractorOffers.length} offer${filteredContractorOffers.length > 1 ? 's' : ''} available` : 'No contractor offers yet'}</p>
            </div>
          </div>

          <div className="worker-dashboard-filter-row" style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 320px', minWidth: 0 }}>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Search projects by city
              </label>
              <input
                type="text"
                value={contractorCityFilter}
                onChange={(e) => {
                  setContractorCityFilter(e.target.value);
                  setConstructionPage(1);
                }}
                placeholder="Type city or neighborhood"
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-grey)', borderRadius: '8px', padding: '10px 12px', color: '#f5f5f7', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
            <div className="worker-dashboard-filter-hint" style={{ minWidth: '220px', color: 'var(--text-secondary)', fontSize: '13px' }}>
              {contractorCityFilter.trim()
                ? `Filtering offers by city: "${contractorCityFilter.trim()}"`
                : 'Showing all contractor offers.'}
            </div>
          </div>

          {filteredContractorOffers.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <strong style={{ fontSize: '14px', color: '#fff' }}>Pending Contractor Offer(s)</strong>
                <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>Accept any project offer to claim it, or reject if it's not the right fit.</p>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <th style={{ padding: '12px 14px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Project</th>
                      <th style={{ padding: '12px 14px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</th>
                      <th style={{ padding: '12px 14px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Customer</th>
                      <th style={{ padding: '12px 14px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Location</th>
                      <th style={{ padding: '12px 14px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Budget</th>
                      <th style={{ padding: '12px 14px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody style={{ color: '#fff' }}>
                    {filteredContractorOffers.map((job) => (
                      <tr key={job._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <td style={{ padding: '14px' }}>
                          <div style={{ fontWeight: 700 }}>{job.category}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Offer received</div>
                        </td>
                        <td style={{ padding: '14px', maxWidth: '280px' }}>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={job.description}>{job.description || 'No description provided.'}</div>
                        </td>
                        <td style={{ padding: '14px' }}>
                          <div style={{ fontWeight: 600 }}>{job.customer?.name || 'Unknown'}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{job.customer?.phone || 'No phone'}</div>
                        </td>
                        <td style={{ padding: '14px', maxWidth: '220px' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedProjectLocation(job)}
                            style={{ background: 'none', border: 'none', padding: 0, color: '#f59e0b', fontWeight: 600, textAlign: 'left', cursor: 'pointer', fontSize: '13px' }}
                          >
                            {job.location?.manualAddress || job.location?.address || 'Not provided'}
                          </button>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Tap to view map</div>
                        </td>
                        <td style={{ padding: '14px' }}>
                          <div style={{ fontSize: '13px', color: '#fff', fontWeight: 600 }}>PKR {job.payment?.basePrice?.toLocaleString() || job.payment?.amount?.toLocaleString() || 'N/A'}</div>
                        </td>
                        <td style={{ padding: '14px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            <button
                              onClick={() => setSelectedBidJob(job)}
                              className="btn btn-primary"
                              style={{ minWidth: '110px', padding: '8px 12px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                              <Briefcase size={14} /> Submit Bid
                            </button>
                            <button
                              onClick={() => handleConstructionResponse(job._id, 'reject')}
                              className="btn btn-secondary"
                              style={{ minWidth: '110px', padding: '8px 12px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderColor: 'var(--error-color)', color: 'var(--error-color)' }}
                            >
                              <X size={14} /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedProjectLocation && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(7, 12, 24, 0.82)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={() => setSelectedProjectLocation(null)}
        >
          <div
            style={{ width: 'min(760px, 100%)', background: 'var(--bg-card)', border: '1px solid var(--border-grey)', borderRadius: '16px', padding: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
              <div>
                <h4 style={{ margin: 0, color: '#fff' }}>Construction site location</h4>
                <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  {selectedProjectLocation.location?.manualAddress || selectedProjectLocation.location?.address || 'Address not provided'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProjectLocation(null)}
                style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px' }}
                aria-label="Close map"
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ height: '340px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)' }}>
              {selectedProjectLocation.location?.latitude != null && selectedProjectLocation.location?.longitude != null ? (
                <MapContainer
                  center={[Number(selectedProjectLocation.location.latitude), Number(selectedProjectLocation.location.longitude)]}
                  zoom={14}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[Number(selectedProjectLocation.location.latitude), Number(selectedProjectLocation.location.longitude)]}>
                    <Popup>
                      {selectedProjectLocation.location?.manualAddress || selectedProjectLocation.location?.address || 'Construction site'}
                    </Popup>
                  </Marker>
                </MapContainer>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', padding: '20px', textAlign: 'center' }}>
                  Coordinates are not available for this project yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'construction' && (
        <div className="card card--padded">
          <div className="section-header">
            <Hammer size={20} color="var(--primary-orange)" />
            <div className="section-header__text">
              <h3>Contractor Projects</h3>
              <p>Review assigned contractor projects with location maps.</p>
            </div>
          </div>

          {constructionProjects.length === 0 ? (
            <EmptyState
              icon={Hammer}
              title="No contractor projects assigned"
              description="Admin-assigned contractor projects will appear here."
            />
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {visibleConstruction.map((project) => (
                  <div key={project._id} className="card" style={{ border: '1px solid var(--border-grey)', padding: '20px' }}>
                    <div className="worker-project-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '20px' }}>
                      {/* Project Details */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <h4 style={{ fontSize: '16px', color: '#fff' }}>{project.category}</h4>
                          <StatusBadge status={project.status} />
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                          <span className="form-label" style={{ fontSize: '11px' }}>Project Description</span>
                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{project.description}</p>
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                          <span className="form-label" style={{ fontSize: '11px' }}>Customer</span>
                          <p style={{ fontSize: '13px', color: '#fff', marginTop: '4px' }}>
                            {project.customer?.name || 'Customer'}
                            {project.customer?.phone && <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>{project.customer.phone}</span>}
                          </p>
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                          <span className="form-label" style={{ fontSize: '11px' }}>Project Amount</span>
                          <p style={{ fontSize: '16px', color: 'var(--success-color)', fontWeight: '700', marginTop: '4px' }}>
                            PKR {project.payment?.amount?.toLocaleString() || 0}
                          </p>
                        </div>

                        <div style={{ marginBottom: '12px' }}>
                          <span className="form-label" style={{ fontSize: '11px' }}>Location Address</span>
                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{project.location?.address}</p>
                        </div>

                        {project.status === 'pending_acceptance' && (
                          <div className="worker-project-action-row" style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                            <button
                              onClick={() => handleConstructionResponse(project._id, 'accept')}
                              className="btn btn-primary"
                              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                            >
                              <Check size={16} /> Accept Project
                            </button>
                            <button
                              onClick={() => handleConstructionResponse(project._id, 'reject')}
                              className="btn btn-secondary"
                              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderColor: 'var(--error-color)', color: 'var(--error-color)' }}
                            >
                              <X size={16} /> Reject Project
                            </button>
                          </div>
                        )}

                        {project.status === 'assigned' && (
                          <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(34,197,94,0.07)', borderRadius: '8px', border: '1px solid rgba(34,197,94,0.2)' }}>
                            <p style={{ fontSize: '13px', color: '#86efac', margin: 0 }}>✅ Project accepted - Work in progress</p>
                          </div>
                        )}
                      </div>

                      {/* Map Display */}
                      <div>
                        <span className="form-label" style={{ fontSize: '11px', marginBottom: '8px', display: 'block' }}>Project Location</span>
                        <div style={{ height: '250px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-grey)' }}>
                          {project.location?.latitude && project.location?.longitude ? (
                            <MapContainer
                              center={[project.location.latitude, project.location.longitude]}
                              zoom={14}
                              style={{ height: '100%', width: '100%' }}
                            >
                              <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                              />
                              <Marker position={[project.location.latitude, project.location.longitude]}>
                                <Popup>
                                  <div style={{ fontSize: '12px' }}>
                                    <strong>{project.category}</strong><br />
                                    {project.location?.address}
                                  </div>
                                </Popup>
                              </Marker>
                            </MapContainer>
                          ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                              <Map size={32} />
                              <span style={{ marginLeft: '8px' }}>Location not available</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination
                page={constructionPage}
                totalPages={constructionTotalPages}
                totalItems={constructionProjects.length}
                pageSize={itemsPerPage}
                onPageChange={setConstructionPage}
                itemLabel="projects"
              />
            </>
          )}
        </div>
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

      {selectedBidJob && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(7, 12, 24, 0.82)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={() => setSelectedBidJob(null)}
        >
          <div
            style={{ width: 'min(500px, 100%)', background: 'var(--bg-card)', border: '1px solid var(--border-grey)', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#fff' }}>Submit Bid for {selectedBidJob.category}</h3>
              <button
                type="button"
                onClick={() => setSelectedBidJob(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <XIcon size={20} />
              </button>
            </div>

            <form onSubmit={handleBidSubmit}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Bid Amount (PKR)</label>
                <input
                  type="number"
                  className="form-input"
                  value={bidForm.bidAmount}
                  onChange={e => setBidForm({ ...bidForm, bidAmount: e.target.value })}
                  placeholder="Your price for the project"
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Estimated Completion (Days)</label>
                <input
                  type="number"
                  className="form-input"
                  value={bidForm.completionDays}
                  onChange={e => setBidForm({ ...bidForm, completionDays: e.target.value })}
                  placeholder="e.g. 15"
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Additional Notes</label>
                <textarea
                  className="form-input"
                  value={bidForm.notes}
                  onChange={e => setBidForm({ ...bidForm, notes: e.target.value })}
                  placeholder="Any conditions or details about your bid..."
                  style={{ minHeight: '80px', resize: 'vertical' }}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
                Submit Bid
              </button>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
