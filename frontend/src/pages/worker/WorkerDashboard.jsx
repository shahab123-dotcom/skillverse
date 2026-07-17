import './WorkerDashboard.css';
import './worker.css';
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
import { WORKER_SERVICE_OPTIONS } from '../../constants/workerServices';
import WorkerOverview from './WorkerOverview';
import ActiveJob from './ActiveJob';
import ConstructionProjects from './ConstructionProjects';
import ContractorOffers from './ContractorOffers';
import WorkerHistory from './WorkerHistory';

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

    socket.on('job_taken', ({ jobId, reason }) => {
      const matchesIncoming = incomingJobRef.current && String(incomingJobRef.current.jobId) === String(jobId);
      if (matchesIncoming) {
        toast.info('This request was already accepted by another worker.');
        setIncomingJob(null);
        setAlertCountdown(0);
      }
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
          <div className="loading-spinner" style={{ width: '40px', height: '40px', border: '3px solid var(--primary-orange)', borderRadius: '50%', borderTop: '3px solid transparent', margin: '0 auto 20px' }} />
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
          <div className="card alert-pulse" style={{ width: '100%', maxWidth: '480px', border: '2px solid var(--primary-orange)', margin: '20px auto', maxHeight: 'calc(100% - 80px)', overflowY: 'auto' }}>
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
        <WorkerOverview
          profile={profile}
          earningsSummary={earningsSummary}
          recentReviews={recentReviews}
          isContractorUser={isContractorUser}
          contractorForm={contractorForm}
          contractorError={contractorError}
          contractorSuccess={contractorSuccess}
          contractorLoading={contractorLoading}
          handleContractorSubmit={handleContractorSubmit}
          profileRef={profileRef}
          availabilityRef={availabilityRef}
        />
      )}

      {activeTab === 'active-job' && (
        <ActiveJob
          activeJob={activeJob}
          jobStatus={jobStatus}
          setJobStatus={setJobStatus}
          gpsLocation={gpsLocation}
          messages={messages}
          setMessages={setMessages}
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          socketRef={socketRef}
          clearJobState={clearJobState}
          handleRejectJob={handleRejectJob}
          handleCompleteJob={handleUpdateStatus}
          getAddressText={getAddressText}
          isAvailable={isAvailable}
          handleToggleAvailability={handleToggleAvailability}
        />
      )}

      {activeTab === 'contractor-offers' && (
        <ContractorOffers
          profile={profile}
          filteredContractorOffers={filteredContractorOffers}
          contractorCityFilter={contractorCityFilter}
          setContractorCityFilter={setContractorCityFilter}
          constructionPage={constructionPage}
          setConstructionPage={setConstructionPage}
          itemsPerPage={itemsPerPage}
          selectedBidJob={selectedBidJob}
          setSelectedBidJob={setSelectedBidJob}
          bidForm={bidForm}
          setBidForm={setBidForm}
          handleBidSubmit={handleBidSubmit}
          handleConstructionResponse={handleConstructionResponse}
        />
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
        <ConstructionProjects
          filteredConstructionProjects={filteredConstructionProjects}
          constructionPage={constructionPage}
          setConstructionPage={setConstructionPage}
          itemsPerPage={itemsPerPage}
          contractorCityFilter={contractorCityFilter}
          setContractorCityFilter={setContractorCityFilter}
          selectedProjectLocation={selectedProjectLocation}
          setSelectedProjectLocation={setSelectedProjectLocation}
          selectedBidJob={selectedBidJob}
          setSelectedBidJob={setSelectedBidJob}
          bidForm={bidForm}
          setBidForm={setBidForm}
          handleConstructionResponse={handleConstructionResponse}
          handleBidSubmit={handleBidSubmit}
          getAddressText={getAddressText}
          getDistanceKm={getDistanceKm}
          gpsLocation={gpsLocation}
        />
      )}

      {activeTab === 'history' && (
        <WorkerHistory
          jobsHistory={jobsHistory}
          historyLoading={historyLoading}
          historyPage={historyPage}
          setHistoryPage={setHistoryPage}
          itemsPerPage={itemsPerPage}
        />
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
