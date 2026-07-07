import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { Mic, MicOff, Send, Phone, MapPin, CheckCircle, CreditCard, Play, MessageSquare, ShieldAlert, Clock, X } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { API_URL } from '../../App';
import { useToast } from '../../context/ToastContext';
import DashboardLayout from '../../components/shared/DashboardLayout';
import CandidateSidebar from '../../components/candidate/CandidateSidebar';
import CustomerComplaintsPanel from '../../components/candidate/CustomerComplaintsPanel';
import StatusBadge from '../../components/shared/StatusBadge';
import EmptyState from '../../components/shared/EmptyState';
import Pagination from '../../components/shared/Pagination';
import { TableSkeleton } from '../../components/shared/LoadingSkeleton';
import StripePaymentModal from '../../components/candidate/StripePaymentModal';
import ComplaintModal from '../../components/candidate/ComplaintModal';

export default function CustomerDashboard({ user }) {
  const routerLocation = useLocation();
  const socketRef = useRef(null);
  const toast = useToast();

  // Tab State
  const [activeTab, setActiveTab] = useState('daily'); // daily, construction, history

  // Daily Booking State
  const [selectedCategory, setSelectedCategory] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [latitude, setLatitude] = useState(24.8607);
  const [longitude, setLongitude] = useState(67.0011);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [audioBlob, setAudioBlob] = useState(null);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');

  // Active Job Match & Location Tracking
  const [activeJob, setActiveJob] = useState(null);
  const [dispatchStatus, setDispatchStatus] = useState(''); // 'searching', 'accepted', 'declined', 'failed', 'completed'
  const [workerDetails, setWorkerDetails] = useState(null);
  const [workerCoords, setWorkerCoords] = useState(null);
  const [distanceToWorker, setDistanceToWorker] = useState(null);
  const [etaMinutes, setEtaMinutes] = useState(null);
  const [socketConnectionStatus, setSocketConnectionStatus] = useState('connected');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [complaintMap, setComplaintMap] = useState({});
  const [complaintModalJob, setComplaintModalJob] = useState(null);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [highlightRect, setHighlightRect] = useState(null);

  // Feedback State
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackJob, setFeedbackJob] = useState(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackHover, setFeedbackHover] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  // Completion modal state
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionJob, setCompletionJob] = useState(null);

  const categoryRef = useRef(null);
  const requestRef = useRef(null);
  const paymentRef = useRef(null);
  const chatRef = useRef(null);
  const connectionIssueRef = useRef(false);
  
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

  // Walkthrough Onboarding Tutorial State
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(1);

  // History State
  const [jobsHistory, setJobsHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const itemsPerPage = 10;
  const [historyPage, setHistoryPage] = useState(1);

  const [conCategory, setConCategory] = useState('');
  const [conTitle, setConTitle] = useState('');
  const [conBudget, setConBudget] = useState('');
  const [conDescription, setConDescription] = useState('');
  const [conCity, setConCity] = useState('');
  const [conResidenceArea, setConResidenceArea] = useState('');
  const [conExactLocation, setConExactLocation] = useState('');
  const [conLocationHint, setConLocationHint] = useState('');

  const pakCities = ['Lahore', 'Karachi', 'Islamabad', 'Rahim Yar Khan', 'Multan', 'Faisalabad', 'Rawalpindi', 'Bahawalpur'];

  // Fetch real GPS coordinates from browser
  const fetchLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setLatitude(lat);
        setLongitude(lon);
        setAddress((currentAddress) => currentAddress.trim() ? currentAddress : `${lat.toFixed(5)}, ${lon.toFixed(5)} (GPS)`);
        setGpsLoading(false);
      },
      (error) => {
        console.warn('Geolocation error:', error);
        setAddress((currentAddress) => currentAddress.trim() ? currentAddress : 'Location access denied. Please type your address manually.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const getDisplayAddress = (location) => {
    const rawAddress = location?.manualAddress?.trim?.() || location?.address?.trim?.() || '';
    if (rawAddress) return rawAddress;

    if (location?.latitude != null && location?.longitude != null) {
      return `${Number(location.latitude).toFixed(4)}, ${Number(location.longitude).toFixed(4)}`;
    }

    return 'Address not provided';
  };

  const resolveConstructionLocation = () => {
    return new Promise((resolve) => {
      const fallbackAddress = conExactLocation.trim() || 'Location not provided';
      const fallbackLocation = {
        latitude: latitude || 24.8607,
        longitude: longitude || 67.0011,
        address: fallbackAddress
      };

      if (!navigator.geolocation) {
        setConLocationHint('Geolocation is unavailable, so the saved location will be used.');
        resolve(fallbackLocation);
        return;
      }

      setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const gpsAddress = `${lat.toFixed(5)}, ${lon.toFixed(5)} (GPS)`;
          setLatitude(lat);
          setLongitude(lon);
          setConExactLocation((current) => current.trim() ? current : gpsAddress);
          setConLocationHint('Using your current location for this construction request.');
          setGpsLoading(false);
          resolve({
            latitude: lat,
            longitude: lon,
            address: conExactLocation.trim() || gpsAddress
          });
        },
        () => {
          setConLocationHint('Using the saved location because current location access was denied.');
          setGpsLoading(false);
          resolve(fallbackLocation);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  // Fetch GPS on component mount
  useEffect(() => {
    fetchLocation();
  }, []);

  // Trigger onboarding walkthrough if first time login
  useEffect(() => {
    if (user && user.id) {
      const isCompleted = localStorage.getItem(`skillsverse_tutorial_completed_${user.id}`);
      if (!isCompleted) {
        setShowTutorial(true);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!showTutorial) return;
    const stepRefs = [categoryRef, requestRef, paymentRef, chatRef];
    const current = stepRefs[tutorialStep - 1]?.current;
    if (!current) return;
    const rect = current.getBoundingClientRect();
    setHighlightRect({
      top: rect.top + window.scrollY - 14,
      left: rect.left + window.scrollX - 14,
      width: rect.width + 28,
      height: rect.height + 28
    });
    window.scrollTo({ top: Math.max(rect.top + window.scrollY - 120, 0), behavior: 'smooth' });
  }, [showTutorial, tutorialStep]);

  // Triggered by route redirect state
  useEffect(() => {
    if (routerLocation.state?.activeTab) {
      setActiveTab(routerLocation.state.activeTab);
    }
    loadHistory();
  }, [routerLocation.state?.activeTab]);

  // Handle message auto scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load Job History
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/jobs/customer`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setJobsHistory(data);
        setHistoryPage(1);
        loadComplaints();
        // Check if there is an active job currently pending, assigned, or en-route
        const currentActive = data.find(job => ['pending', 'assigned', 'en_route'].includes(job.status));
        if (currentActive) {
          setActiveJob(currentActive);
          if (currentActive.status === 'pending') {
            setDispatchStatus('searching');
          } else if (currentActive.status === 'completed') {
            setDispatchStatus('completed');
          } else {
            setDispatchStatus('accepted');
          }
          if (currentActive.worker && currentActive.worker.latitude !== undefined && currentActive.worker.longitude !== undefined) {
            setWorkerDetails(currentActive.worker);
            setWorkerCoords({
              latitude: currentActive.worker.latitude,
              longitude: currentActive.worker.longitude
            });
          }
          // Set up socket connection for active jobs that still need worker match or tracking
          if (['pending', 'assigned', 'en_route'].includes(currentActive.status)) {
            setupSocket(currentActive._id, currentActive.status === 'pending');
          }
        }
      }
    } catch (error) {
      console.error("Error loading history:", error);
      toast.error('Failed to load job history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const getPaginatedItems = (items, page) => items.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const getTotalPages = (items) => Math.max(1, Math.ceil(items.length / itemsPerPage));

  const visibleHistory = getPaginatedItems(jobsHistory, historyPage);
  const historyTotalPages = getTotalPages(jobsHistory);

  const loadComplaints = async () => {
    try {
      const response = await fetch(`${API_URL}/api/complaints/customer`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (response.ok) {
        setComplaints(data);
        setComplaintMap(data.reduce((acc, complaint) => {
          acc[complaint.jobId] = complaint;
          return acc;
        }, {}));
      }
    } catch (error) {
      console.error('Failed to load customer complaints:', error);
    }
  };

  const handlePaymentSuccess = (data) => {
    setShowPaymentModal(false);
    loadHistory();
    const completedJob = data?.job || activeJob;
    if (completedJob) {
      setActiveJob(completedJob);
      setFeedbackJob(completedJob);
      setFeedbackRating(5);
      setFeedbackText('');
      setShowFeedbackModal(true);
    }
    setActiveTab('history');
  };

  const openComplaintModal = (job) => {
    setComplaintModalJob(job);
    setShowComplaintModal(true);
  };

  const handleComplaintSuccess = () => {
    setShowComplaintModal(false);
    loadComplaints();
    loadHistory();
  };

  // Setup sockets. If shouldDispatch=true, sends request_job_dispatch once the socket connects
  const setupSocket = (jobId, shouldDispatch = false) => {
    if (socketRef.current) socketRef.current.disconnect();

    connectionIssueRef.current = false;
    let dispatched = false; // Guard: only dispatch once per connection setup
    const socket = io(API_URL, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      // Re-register and re-join on every connect/reconnect
      socket.emit('register', String(user.id));
      socket.emit('join_job', jobId);
      // Only dispatch once on the initial connection (not on reconnects)
      if (shouldDispatch && !dispatched) {
        dispatched = true;
        console.log('[Customer Socket] Dispatching service request job', jobId);
        socket.emit('request_job_dispatch', { jobId });
      }
      setSocketConnectionStatus('connected');
      if (connectionIssueRef.current) {
        toast.success('Connection restored.');
        connectionIssueRef.current = false;
      }
    });

    socket.on('connect_error', () => {
      setSocketConnectionStatus('reconnecting');
      if (!connectionIssueRef.current) {
        toast.error('Connection lost. Updates may pause until the network reconnects.');
        connectionIssueRef.current = true;
      }
    });

    socket.on('disconnect', () => {
      setSocketConnectionStatus('disconnected');
      if (!connectionIssueRef.current) {
        toast.info('Connection temporarily disconnected.');
        connectionIssueRef.current = true;
      }
    });

    // Listen for worker accepted
    socket.on('job_accepted', (data) => {
      setDispatchStatus('accepted');
      setWorkerDetails(data.worker);
      setWorkerCoords({
        latitude: data.worker.latitude,
        longitude: data.worker.longitude
      });
      loadHistory();
    });

    // Listen for real time worker location updates
    socket.on('worker_location_updated', (coords) => {
      setWorkerCoords(coords);
    });

    // Listen for job status change
    socket.on('job_status_updated', ({ status }) => {
      // When job completes, snapshot the job then fully clear active state and show completion UI
      if (status === 'completed') {
        try {
          const snapshot = activeJob ? { ...activeJob, status: 'completed' } : null;
          if (snapshot) setCompletionJob(snapshot);
          setDispatchStatus('completed');
          // Show completion modal
          setShowCompletionModal(true);
          // Clear active job and related tracking immediately
          clearActiveJobCompletely(snapshot);
          return;
        } catch (err) {
          console.error('Error handling completed status:', err);
        }
      }

      // For other status updates keep updating the active job state
      setDispatchStatus('accepted');
      setActiveJob(prev => prev ? { ...prev, status } : prev);
    });

    // Listen for worker rating update
    socket.on('worker_rating_updated', (data) => {
      setWorkerDetails(prev => {
        if (prev && prev._id === data.workerId) {
          return { ...prev, averageRating: data.averageRating, totalReviews: data.totalReviews };
        }
        return prev;
      });
      setJobsHistory(prev => prev.map(job => {
        if (job.worker && job.worker._id === data.workerId) {
          return { ...job, worker: { ...job.worker, averageRating: data.averageRating, totalReviews: data.totalReviews } };
        }
        return job;
      }));
    });

    // Listen for incoming messages
    socket.on('receive_message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    // Listen for failed matches
    socket.on('dispatch_failed', (data) => {
      setDispatchStatus('failed');
      toast.error(data.message || 'No workers available. You can retry.');
    });

    // Listen for job rejection (by worker or customer)
    socket.on('job_rejected', (data) => {
      // Clear active job and return customer to the booking screen
      const snapshot = activeJob ? { ...activeJob } : null;
      clearActiveJobCompletely(snapshot);
      toast.info('Job has been rejected and cleared');
      loadHistory();
    });

    // Listen for job cancellation (by customer)
    socket.on('job_cancelled', (data) => {
      const snapshot = activeJob ? { ...activeJob } : null;
      clearActiveJobCompletely(snapshot);
      toast.info('Job has been cancelled');
      loadHistory();
    });

    // Fetch message history for the room
    fetch(`${API_URL}/api/jobs/${jobId}/messages`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => res.json())
      .then(history => setMessages(history))
      .catch(err => console.error("Error fetching message history:", err));
  };

  // Clean socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  // Helper: fully clear active job state, stop sockets and any geolocation watchers
  const clearActiveJobCompletely = (keepJobSnapshot = null) => {
    try {
      // store snapshot for UI (feedback/completion modal) if provided
      if (keepJobSnapshot) setCompletionJob(keepJobSnapshot);

      // Disconnect and remove socket listeners
      if (socketRef.current) {
        try { socketRef.current.removeAllListeners(); } catch (e) { /* ignore */ }
        try { socketRef.current.disconnect(); } catch (e) { /* ignore */ }
        socketRef.current = null;
      }

      // Clear all active-job related state
      setActiveJob(null);
      setDispatchStatus('');
      setWorkerDetails(null);
      setWorkerCoords(null);
      setDistanceToWorker(null);
      setEtaMinutes(null);
      setMessages([]);
      setShowPaymentModal(false);
      setShowFeedbackModal(false);
      setFeedbackJob(null);

      // Stop any geolocation watch if set on window (defensive)
      try {
        const watchId = window.__skillsverse_location_watch_id;
        if (watchId && navigator.geolocation && navigator.geolocation.clearWatch) {
          navigator.geolocation.clearWatch(watchId);
        }
        delete window.__skillsverse_location_watch_id;
      } catch (e) {
        // ignore
      }

      // Clear commonly-used active job keys from storage (if used)
      try {
        localStorage.removeItem('activeJob');
        localStorage.removeItem('skillsverse_active_job');
        localStorage.removeItem('currentActiveJobId');
        localStorage.removeItem('active_job');
        sessionStorage.removeItem('activeJob');
      } catch (e) {
        // ignore
      }

      // Reset UI to main booking view
      setActiveTab('daily');
    } catch (err) {
      console.error('Error clearing active job state:', err);
    }
  };

  // Calculate distance and ETA when worker coordinates update
  useEffect(() => {
    if (workerCoords && workerCoords.latitude && workerCoords.longitude) {
      // Calculate distance using Haversine formula
      const R = 6371; // Earth's radius in km
      const dLat = (workerCoords.latitude - latitude) * (Math.PI / 180);
      const dLon = (workerCoords.longitude - longitude) * (Math.PI / 180);
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(latitude * (Math.PI / 180)) * Math.cos(workerCoords.latitude * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c; // Distance in km
      
      setDistanceToWorker(distance);
      
      // Estimate ETA (assuming average speed of 30 km/h in urban areas)
      const avgSpeedKmh = 30;
      const eta = distance / avgSpeedKmh * 60; // ETA in minutes
      setEtaMinutes(Math.round(eta));
    }
  }, [workerCoords, latitude, longitude]);

  // Mic/Voice Recorder Logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      let chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      toast.error('Mic permission denied. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const uploadVoice = async () => {
    if (!audioBlob) return;
    setUploadingVoice(true);
    const formData = new FormData();
    formData.append('voice', audioBlob, 'voice.webm');

    try {
      const response = await fetch(`${API_URL}/api/jobs/voice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      const data = await response.json();
      if (response.ok) {
        setAudioUrl(`${API_URL}${data.voiceUrl}`);
        setVoiceTranscript(data.voiceTranscript);
      } else {
        toast.error('Audio upload failed.');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setUploadingVoice(false);
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
          sender: 'customer',
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

  // Daily Services Submission
  const handleSendJob = async () => {
    if (!selectedCategory) return toast.warning('Please select a service category');

    const trimmedAddress = address.trim();
    const trimmedManualAddress = manualAddress.trim();
    const hasAddressDetails = trimmedAddress || trimmedManualAddress;
    if (!hasAddressDetails) {
      return toast.warning('Please enter a service location or manual address before submitting.');
    }

    let finalAudioUrl = audioUrl;
    let finalVoiceTranscript = voiceTranscript;

    // Check if we need to auto-upload the voice recording first
    if (audioBlob && (!audioUrl || audioUrl.startsWith('blob:'))) {
      setUploadingVoice(true);
      const formData = new FormData();
      formData.append('voice', audioBlob, 'voice.webm');
      try {
        const uploadRes = await fetch(`${API_URL}/api/jobs/voice`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (uploadRes.ok) {
          finalAudioUrl = `${API_URL}${uploadData.voiceUrl}`;
          finalVoiceTranscript = uploadData.voiceTranscript;
          setAudioUrl(finalAudioUrl);
          setVoiceTranscript(finalVoiceTranscript);
        } else {
          console.warn("Auto voice upload failed, proceeding without voice.");
        }
      } catch (err) {
        console.error("Auto voice upload failed:", err);
      } finally {
        setUploadingVoice(false);
      }
    }

    try {
      const token = localStorage.getItem('token');
      if (!token || token === 'undefined' || token === 'null') {
        toast.error('Authentication token missing. Please sign in again.');
        window.location.href = '/auth';
        return;
      }

      const response = await fetch(`${API_URL}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'daily',
          category: selectedCategory,
          description,
          voiceUrl: finalAudioUrl,
          voiceTranscript: finalVoiceTranscript,
          location: {
            latitude,
            longitude,
            address: trimmedAddress || trimmedManualAddress || 'Location not provided',
            manualAddress: trimmedManualAddress
          },
          paymentAmount: 1500 // PKR flat rate
        })
      });

      const data = await response.json();
      if (response.ok) {
        console.log('[Customer] Service request created', data.job);
        setActiveJob(data.job);
        setDispatchStatus('searching');
        // Pass shouldDispatch=true: request_job_dispatch fires once socket connects
        setupSocket(data.job._id, true);
      } else {
        if (response.status === 401 || response.status === 403) {
          toast.error('Session invalid. Please sign in again.');
          window.location.href = '/auth';
          return;
        }
        toast.error(data.error || 'Booking failed.');
      }
    } catch (error) {
      console.error("Booking Error:", error);
      toast.error('Booking failed due to a network error. Please try again.');
    }
  };

  // Chat message send
  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeJob) return;

    socketRef.current.emit('send_message', {
      jobId: activeJob._id,
      sender: 'customer',
      text: newMessage
    });
    setNewMessage('');
  };

  // Walkthrough Onboarding Tutorial steps
  const customerSteps = [
    {
      title: "Welcome to Skillsverse",
      description: "Skillsverse connects you with certified service experts instantly. Let's walk you through the key features to get you started!"
    },
    {
      title: "Select Service Category",
      description: "Choose the service category you need, such as Plumbing, Electrical, Cleaning, Appliance Repair, or Pest Control, or request Newly Construction projects."
    },
    {
      title: "Submit Request",
      description: "Provide details about your request, center your address using the 'Use My Location' button or record a voice note, and submit to ping nearby workers."
    },
    {
      title: "Track Worker Location",
      description: "Once a worker accepts your request, track their location in real-time on our interactive map as they make their way to your address."
    },
    {
      title: "Chat & Release Funds",
      description: "Communicate directly with your worker using real-time text and voice chat. Release the escrowed payment only when you are satisfied with the service."
    }
  ];

  const handleTutorialNext = () => {
    if (tutorialStep < customerSteps.length) {
      setTutorialStep(tutorialStep + 1);
    } else {
      handleTutorialFinish();
    }
  };

  const handleTutorialFinish = () => {
    if (user && user.id) {
      localStorage.setItem(`skillsverse_tutorial_completed_${user.id}`, 'true');
    }
    setShowTutorial(false);
  };


  // Construction Submission
  const handleConstructionSubmit = async (e) => {
    e.preventDefault();
    if (!conCategory || !conTitle || !conDescription || !conCity || !conResidenceArea) {
      return toast.warning('Please fill all required fields');
    }

    try {
      const constructionLocation = await resolveConstructionLocation();

      const response = await fetch(`${API_URL}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
            type: 'construction',
            title: conTitle,
            category: conCategory,
            description: conDescription,
            location: {
              latitude: constructionLocation.latitude,
              longitude: constructionLocation.longitude,
              address: constructionLocation.address,
              city: conCity,
              residenceArea: conResidenceArea,
              manualAddress: conExactLocation
            },
            paymentAmount: Number(conBudget)
          })
      });

      if (response.ok) {
        toast.success('Construction request submitted! Admin will assign a contractor shortly.');
        // Clear fields
        setConTitle('');
        setConDescription('');
        setConBudget('');
        setConCity('');
        setConResidenceArea('');
        setConExactLocation('');
        setActiveTab('history');
        loadHistory();
      } else {
        const d = await response.json();
        toast.error(d.error || 'Failed to submit construction request.');
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Cancel Job (For retry or cancel match)
  const resetActiveJobState = (nextTab = 'history') => {
    setActiveJob(null);
    setDispatchStatus('');
    setWorkerDetails(null);
    setWorkerCoords(null);
    setMessages([]);
    setSocketConnectionStatus('connected');
    setActiveTab(nextTab);
    if (socketRef.current) socketRef.current.disconnect();
  };

  const handleCancelJob = async () => {
    if (!activeJob?._id) {
      resetActiveJobState();
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/jobs/${activeJob._id}/cancel`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (response.ok) {
        toast.info('Booking cancelled.');
        resetActiveJobState();
        loadHistory();
      } else {
        toast.error(data.error || 'Failed to cancel booking.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to cancel booking.');
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
        resetActiveJobState('history');
        setActiveTab('history');
        loadHistory();
      } else {
        toast.error(data.error || 'Failed to reject job');
      }
    } catch (error) {
      console.error('Failed to reject job:', error);
      toast.error('Failed to reject job');
    }
  };

  const handleCompleteJob = async () => {
    if (!activeJob) return;
    try {
      const response = await fetch(`${API_URL}/api/jobs/${activeJob._id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: 'completed' })
      });
      const data = await response.json();
      if (response.ok) {
        toast.success('Job marked as completed');
        const completedJob = data.job || activeJob;
        setActiveJob(completedJob);
        setDispatchStatus('completed');
        setShowFeedbackModal(false);
        setFeedbackJob(null);
        setShowPaymentModal(true);
      } else {
        toast.error(data.error || 'Failed to complete job');
      }
    } catch (error) {
      console.error('Failed to complete job:', error);
      toast.error('Failed to complete job');
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackJob) return;

    setSubmittingFeedback(true);
    try {
      const response = await fetch(`${API_URL}/api/jobs/${feedbackJob._id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ rating: feedbackRating, feedback: feedbackText })
      });
      const data = await response.json();
      if (response.ok) {
        toast.success('Feedback submitted successfully!');
        setShowFeedbackModal(false);
        setFeedbackJob(null);
        setActiveJob(prev => prev ? { ...prev, isReviewed: true } : prev);
        setActiveTab('history');
      } else {
        toast.error(data.error || 'Failed to submit feedback');
      }
    } catch (error) {
      console.error('Submit feedback error:', error);
      toast.error('Failed to submit feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Open Stripe payment modal
  const handlePayment = () => {
    setShowPaymentModal(true);
  };

  const handleClosePayment = () => {
    setShowPaymentModal(false);
  };

  // Daily Category Icon mapping helper
  const dailyCategories = [
    { name: 'Plumbing', desc: 'Leaking pipe, tap, toilet repair' },
    { name: 'Electrical', desc: 'Short circuit, light setup, wiring' },
    { name: 'Cleaning', desc: 'Deep house cleaning & wash' },
    { name: 'Appliance Repair', desc: 'Refrigerator, oven, AC wash' },
    { name: 'Pest Control', desc: 'Cockroach, bugs fumigation' }
  ];

  const pageMeta = {
    daily: { title: 'Daily Services', subtitle: 'Book on-demand repairs and track your worker in real time.' },
    construction: { title: 'Construction Projects', subtitle: 'Submit larger projects for admin review and contractor assignment.' },
    history: { title: 'Job History & Escrow', subtitle: 'Review past bookings, payments, and release funds.' },
    complaints: { title: 'Complaints & Disputes', subtitle: 'File and track disputes for completed jobs.' },
  }[activeTab];

  return (
    <DashboardLayout
      sidebar={<CandidateSidebar activeTab={activeTab} onChange={setActiveTab} />}
      title={pageMeta.title}
      subtitle={pageMeta.subtitle}
      userName={user?.name}
    >

      {/* activeTab == 'daily' (Daily on-demand matching flow) */}
      {activeTab === 'daily' && (
        <div className={activeJob ? 'dashboard-main' : 'booking-grid'}>
          
          {/* Booking / Booking state check */}
          {!activeJob ? (
            <>
              {/* Category picker & voice input */}
              <div ref={requestRef} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '22px', marginBottom: '8px' }}>Request On-Demand Service</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Choose a category, attach a voice note explaining the problem, and connect with the nearest worker in minutes.</p>
                </div>

                {/* 1. Category selector */}
                <div ref={categoryRef}>
                  <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Choose Category</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    {dailyCategories.map(cat => (
                      <div 
                        key={cat.name}
                        onClick={() => setSelectedCategory(cat.name)}
                        style={{
                          background: selectedCategory === cat.name ? 'var(--primary-orange-light)' : 'var(--bg-input)',
                          border: selectedCategory === cat.name ? '2px solid var(--primary-orange)' : '1px solid var(--border-grey)',
                          padding: '16px',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'var(--transition)'
                        }}
                      >
                        <strong style={{ display: 'block', color: '#fff', fontSize: '15px' }}>{cat.name}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{cat.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Audio voice option */}
                <div style={{ borderTop: '1px solid var(--border-grey)', paddingTop: '20px' }}>
                  <label className="form-label" style={{ marginBottom: '8px', display: 'block' }}>Explain Issue (Voice Submit Option)</label>
                  
                  <div className="voice-recorder-wrapper">
                    <button 
                      type="button"
                      className={`mic-button ${isRecording ? 'recording' : ''}`}
                      onClick={isRecording ? stopRecording : startRecording}
                    >
                      {isRecording ? <MicOff size={28} /> : <Mic size={28} />}
                    </button>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>
                      {isRecording ? 'Recording audio... Click mic to stop' : 'Tap mic to start recording your issue'}
                    </span>

                    {audioUrl && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%', borderTop: '1px solid var(--border-grey)', paddingTop: '15px' }}>
                        <audio src={audioUrl} controls style={{ width: '100%' }} />
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            onClick={uploadVoice}
                            disabled={uploadingVoice}
                          >
                            {uploadingVoice ? 'Transcribing...' : 'Confirm & Transcribe Audio'}
                          </button>
                        </div>
                      </div>
                    )}

                    {voiceTranscript && (
                      <div style={{ background: 'rgba(255, 107, 0, 0.05)', border: '1px dashed var(--primary-orange)', padding: '12px', borderRadius: '8px', width: '100%', fontSize: '13px' }}>
                        <strong>Simulated Transcript Output:</strong>
                        <p style={{ marginTop: '4px', fontStyle: 'italic', color: '#fff' }}>"{voiceTranscript}"</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Address input & description */}
                <div className="candidate-form-grid" style={{ borderTop: '1px solid var(--border-grey)', paddingTop: '20px' }}>
                  <div className="form-group">
                    <label className="form-label">Written Details (Optional)</label>
                    <textarea 
                      placeholder="Add any extra detail (e.g. house number, landmark)"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="form-input"
                      rows={2}
                      style={{ resize: 'none' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label candidate-form-label-inline">
                      <span>Service Location</span>
                      <button
                        type="button"
                        onClick={fetchLocation}
                        disabled={gpsLoading}
                        style={{
                          background: 'none',
                          border: '1px solid var(--primary-orange)',
                          color: 'var(--primary-orange)',
                          borderRadius: '6px',
                          padding: '3px 10px',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: gpsLoading ? 'wait' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px'
                        }}
                      >
                        <MapPin size={11} />
                        {gpsLoading ? 'Detecting...' : 'Use My Location'}
                      </button>
                    </label>
                    <input
                      type="text"
                      name="serviceAddress"
                      placeholder="Type coordinates or location hint"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="form-input"
                      style={{
                        height: '54px',
                        borderColor: gpsLoading ? 'var(--primary-orange)' : undefined,
                        opacity: gpsLoading ? 0.7 : 1
                      }}
                    />
                    <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                      Use this field for GPS-based location or a nearby landmark. Leave blank if you want to type your full address below.
                    </span>
                    {latitude !== 24.8607 && (
                      <span style={{ fontSize: '11px', color: 'var(--success-color)', marginTop: '4px' }}>
                        ✓ Real GPS coordinates detected — map is centered on your location
                      </span>
                    )}

                    <div style={{ marginTop: '18px' }}>
                      <label className="form-label">Manual Address (Optional)</label>
                      <input
                        type="text"
                        name="manualAddress"
                        placeholder="Enter your full address here"
                        value={manualAddress}
                        onChange={(e) => setManualAddress(e.target.value)}
                        className="form-input"
                        style={{ height: '54px' }}
                      />
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                        Leave this blank if the service location above is enough for the worker.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Send button */}
                <button 
                  onClick={handleSendJob} 
                  disabled={!selectedCategory} 
                  className="btn btn-primary" 
                  style={{ width: '100%', padding: '16px', fontSize: '16px', fontWeight: 'bold' }}
                >
                  Send Job (Find Nearest Worker)
                </button>
              </div>

              {/* Quick info panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="card" style={{ padding: '20px' }}>
                  <h4 style={{ color: 'var(--primary-orange)', marginBottom: '8px' }}>Real-time Booking Rules</h4>
                  <ul style={{ paddingLeft: '16px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li>The system targets workers within <strong>5km</strong> of your address.</li>
                    <li>You will trace their coordinates live on the map.</li>
                    <li>Funds are released only after they solve the issue.</li>
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <>
            {/* Active Job Matching or tracking */}
            <div className="card card--padded">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '20px' }}>Job Request Status</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Category: <strong>{activeJob.category}</strong></p>
                </div>

                {dispatchStatus === 'searching' && <StatusBadge status="searching" label="Searching Workers..." />}
                {dispatchStatus === 'accepted' && <StatusBadge status="accepted" label="Worker Assigned" />}
                {dispatchStatus === 'completed' && <StatusBadge status="completed" label="Job Completed" />}
                {dispatchStatus === 'failed' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <StatusBadge status="cancelled" label="No Workers Found" />
                    <button
                      className="btn btn-primary"
                      style={{ padding: '6px 14px', fontSize: '12px' }}
                      onClick={() => {
                        setDispatchStatus('searching');
                        setupSocket(activeJob._id, true);
                      }}
                    >
                      🔄 Retry
                    </button>
                  </div>
                )}
              </div>

              {/* Location Cards */}
              <div className="candidate-form-grid" style={{ marginBottom: '20px' }}>
                {/* Customer Location */}
                <div style={{ background: 'var(--bg-input)', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-grey)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🏠</div>
                    <span style={{ fontWeight: '700', color: '#fff', fontSize: '14px' }}>Your Location</span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#fff', fontWeight: '600', marginBottom: '6px' }}>
                    {getDisplayAddress(activeJob.location)}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    GPS: {latitude.toFixed(5)}, {longitude.toFixed(5)}
                  </p>
                </div>

                {/* Worker Location */}
                {dispatchStatus === 'searching' && (
                  <div style={{ background: 'var(--bg-input)', padding: '20px', borderRadius: '14px', border: '1px solid var(--border-grey)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
                    <div style={{ width: '50px', height: '50px', border: '2px solid var(--primary-orange)', borderRadius: '50%', animation: 'pulseMic 1.5s infinite', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '10px', color: 'var(--primary-orange)', fontWeight: 700 }}>SCAN</span>
                    </div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Pinging nearest available workers...</span>
                  </div>
                )}

                {dispatchStatus === 'accepted' && workerCoords && (
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(255,107,0,0.08), rgba(255,107,0,0.03))',
                    padding: '16px',
                    borderRadius: '14px',
                    border: '1px solid rgba(255,107,0,0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    {/* Header row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '46px', height: '46px', borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg, rgba(255,107,0,0.25), rgba(255,107,0,0.1))',
                        border: '2px solid rgba(255,107,0,0.5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px'
                      }}>👷</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '700', color: '#fff', fontSize: '15px' }}>
                            {workerDetails?.name || 'Worker'}
                          </span>
                          <span style={{
                            background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)',
                            color: '#10b981', fontSize: '10px', fontWeight: '700',
                            padding: '2px 8px', borderRadius: '20px', letterSpacing: '0.04em'
                          }}>● ON THE WAY</span>
                        </div>
                        {workerDetails?.category && (
                          <span style={{ fontSize: '12px', color: 'var(--primary-orange)', fontWeight: '600' }}>
                            {workerDetails.category}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Star Rating */}
                    <div style={{
                      background: 'rgba(0,0,0,0.2)', borderRadius: '10px',
                      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px'
                    }}>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {[1,2,3,4,5].map(s => {
                          const rating = workerDetails?.averageRating || 0;
                          const filled = s <= Math.floor(rating);
                          const half = !filled && s <= Math.ceil(rating) && rating % 1 >= 0.4;
                          return (
                            <span key={s} style={{
                              fontSize: '18px',
                              color: filled || half ? '#fbbf24' : 'rgba(255,255,255,0.15)',
                              filter: filled || half ? 'drop-shadow(0 0 4px rgba(251,191,36,0.5))' : 'none'
                            }}>★</span>
                          );
                        })}
                      </div>
                      {workerDetails?.averageRating ? (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: '700', color: '#fbbf24', fontSize: '15px', lineHeight: 1 }}>
                            {Number(workerDetails.averageRating).toFixed(1)}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {workerDetails.totalReviews || 0} review{(workerDetails.totalReviews || 0) !== 1 ? 's' : ''}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No ratings yet</span>
                      )}
                    </div>

                    {/* GPS */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        <MapPin size={11} style={{ color: 'var(--primary-orange)', flexShrink: 0 }} />
                        GPS: {Number(workerCoords.latitude).toFixed(5)}, {Number(workerCoords.longitude).toFixed(5)}
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Simple Map */}
              {dispatchStatus === 'accepted' && workerCoords && (
                <div style={{ height: '300px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-grey)', marginBottom: '20px' }}>
                  <MapContainer
                    center={[latitude, longitude]}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; OpenStreetMap contributors'
                    />
                    <Marker position={[latitude, longitude]}>
                      <Popup>Your Location</Popup>
                    </Marker>
                    <Marker position={[workerCoords.latitude, workerCoords.longitude]}>
                      <Popup>{workerDetails?.name || 'Worker'}</Popup>
                    </Marker>
                  </MapContainer>
                </div>
              )}

                {/* Cancel/Complete/Reject options */}
                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <button className="btn btn-secondary" onClick={handleCancelJob}>
                    Cancel Booking / Return
                  </button>
                  {dispatchStatus === 'searching' && (
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Hold tight, matching you...</span>
                  )}
                  {dispatchStatus === 'accepted' && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={handleCompleteJob}
                        className="btn btn-primary"
                        style={{ padding: '8px 16px', fontSize: '13px' }}
                      >
                        <CheckCircle size={14} style={{ marginRight: '6px' }} />
                        Complete Job
                      </button>
                      <button
                        onClick={handleRejectJob}
                        className="btn btn-secondary"
                        style={{ padding: '8px 16px', fontSize: '13px', borderColor: 'var(--error-color)', color: 'var(--error-color)' }}
                      >
                        <X size={14} style={{ marginRight: '6px' }} />
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* activeTab == 'construction' (Newly Construction Flow Form) */}
      {activeTab === 'construction' && (
        <div className="construction-grid">
          
          {/* Construction Submission form */}
          <div className="card">
            <h3 style={{ fontSize: '22px', marginBottom: '10px' }}>Newly Construction Project Details</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
              Submit your architectural, painting, woodwork, or bricklaying projects. The Skillsverse Administration will match you with a certified crew and contact you with a project quote.
            </p>

            <form onSubmit={handleConstructionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="candidate-form-grid">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select 
                    value={conCategory} 
                    onChange={(e) => setConCategory(e.target.value)} 
                    className="form-input"
                    required
                  >
                    <option value="">-- Choose Category --</option>
                    <option value="Structural">Structural (Foundation, Pillars)</option>
                    <option value="Paint">Paint (Interior & Exterior Coating)</option>
                    <option value="Masonry">Masonry (Bricklaying, Tile work)</option>
                    <option value="Woodwork">Woodwork (Cabinets, Doors, Roofs)</option>
                    <option value="Roofing">Roofing (Leak shields, Truss setup)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Project Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Build 2nd Floor Bathroom Cabinets"
                    value={conTitle} 
                    onChange={(e) => setConTitle(e.target.value)} 
                    className="form-input"
                    required
                  />
                </div>
              </div>

              <div className="candidate-form-grid">
                <div className="form-group">
                  <label className="form-label">Estimated Budget (PKR)</label>
                  <input 
                    type="number" 
                    placeholder="e.g. 50000"
                    value={conBudget} 
                    onChange={(e) => setConBudget(e.target.value)} 
                    className="form-input"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <select 
                    value={conCity} 
                    onChange={(e) => setConCity(e.target.value)} 
                    className="form-input"
                    required
                  >
                    <option value="">Select City</option>
                    {pakCities.map(city => <option key={city} value={city}>{city}</option>)}
                  </select>
                </div>
              </div>

              <div className="candidate-form-grid" style={{ marginTop: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Residence Area</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Clifton Block 5"
                    value={conResidenceArea} 
                    onChange={(e) => setConResidenceArea(e.target.value)} 
                    className="form-input"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Exact Location / Address</label>
                  <input 
                    type="text" 
                    value={conExactLocation} 
                    onChange={(e) => setConExactLocation(e.target.value)} 
                    className="form-input"
                  />
                  {conLocationHint ? (
                    <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>{conLocationHint}</div>
                  ) : null}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Detailed Project Scope & Requirements</label>
                <textarea 
                  placeholder="Provide details like measurements, building materials, preferred dates, etc."
                  value={conDescription} 
                  onChange={(e) => setConDescription(e.target.value)} 
                  className="form-input"
                  rows={4}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ padding: '14px', width: '100%', fontSize: '15px' }}>
                Submit to Administration
              </button>
            </form>
          </div>

          {/* Construction sidebar info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card" style={{ padding: '20px', borderLeft: '3px solid #10b981' }}>
              <h4 style={{ color: '#10b981', marginBottom: '10px' }}>How it works</h4>
              <ol style={{ paddingLeft: '16px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '10px', color: 'var(--text-secondary)' }}>
                <li>Your request goes directly to the Skillsverse Admin panel.</li>
                <li>The Admin evaluates requirements, timelines, and budgets.</li>
                <li>Admin assigns a specialized team of verified workers.</li>
                <li>You receive a notification and contract quote directly on your history panel.</li>
              </ol>
            </div>
          </div>

        </div>
      )}

      {/* activeTab == 'history' (Display all jobs and payment release switches) */}
      {activeTab === 'history' && (
        <div className="card">
          <h3 style={{ fontSize: '20px', marginBottom: '20px' }}>Job Booking & Project History</h3>

          {historyLoading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : jobsHistory.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No service requests yet"
              description="Book a daily service or submit a construction project to see your history here."
              action={
                <button type="button" className="btn btn-primary" onClick={() => setActiveTab('daily')}>
                  Book a Service
                </button>
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-grey)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '12px' }}>Service Type</th>
                      <th style={{ padding: '12px' }}>Category</th>
                      <th style={{ padding: '12px' }}>Worker</th>
                      <th style={{ padding: '12px' }}>Status</th>
                      <th style={{ padding: '12px' }}>Payment</th>
                      <th style={{ padding: '12px' }}>Your Review</th>
                      <th style={{ padding: '12px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleHistory.map((job) => (
                      <tr key={job._id} style={{ borderBottom: '1px solid var(--border-grey)' }}>
                        <td style={{ padding: '12px', textTransform: 'capitalize' }}>
                          <span style={{ fontWeight: '700', color: job.type === 'daily' ? 'var(--primary-orange)' : '#10b981' }}>
                            {job.type}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>{job.category}</td>
                        <td style={{ padding: '12px' }}>
                          {job.worker ? (
                            <div>
                              <div>{job.worker.name}</div>
                              {job.worker.averageRating !== undefined && (
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span style={{ color: '#fbbf24' }}>★</span>
                                  <span style={{ fontWeight: 'bold', color: '#fff' }}>{job.worker.averageRating}</span>
                                  <span>({job.worker.totalReviews})</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>Not Assigned</span>
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <StatusBadge status={job.status} />
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {job.type === 'construction' ? (
                              <span style={{ fontWeight: '600', color: 'var(--text-muted)' }}>Budget Hidden</span>
                            ) : (
                              <span style={{ fontWeight: '600' }}>{job.payment.amount} PKR</span>
                            )}
                            <span style={{ fontSize: '11px', color: job.payment.status === 'paid' ? 'var(--success-color)' : 'var(--warning-color)' }}>
                              {job.payment.status === 'paid' ? 'Paid' : 'Pending'}
                            </span>
                            {job.type !== 'construction' && (
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                Hold: {job.payment.holdStatus || 'held'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          {job.review?.rating ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', gap: '2px' }}>
                                {[1,2,3,4,5].map(s => (
                                  <span key={s} style={{ fontSize: '16px', color: s <= job.review.rating ? '#fbbf24' : 'var(--text-muted)' }}>★</span>
                                ))}
                              </div>
                              {job.review.feedback && (
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  "{job.review.feedback}"
                                </span>
                              )}
                            </div>
                          ) : job.status === 'completed' && job.worker ? (
                            <button
                              onClick={() => {
                                setFeedbackJob(job);
                                setFeedbackRating(5);
                                setFeedbackText('');
                                setShowFeedbackModal(true);
                              }}
                              style={{
                                background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.05))',
                                border: '1px solid rgba(251,191,36,0.4)',
                                borderRadius: '8px',
                                padding: '6px 10px',
                                color: '#fbbf24',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(251,191,36,0.25)'; e.currentTarget.style.borderColor = '#fbbf24'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.05))'; e.currentTarget.style.borderColor = 'rgba(251,191,36,0.4)'; }}
                            >
                              ★ Leave Review
                            </button>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>

                            {/* Pay Now – for completed but unpaid jobs */}
                            {job.status === 'completed' && job.payment.status !== 'paid' && (
                              <button
                                onClick={() => {
                                  setActiveJob(job);
                                  setShowPaymentModal(true);
                                }}
                                className="btn btn-primary"
                                style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                              >
                                <CreditCard size={12} /> Pay Now
                              </button>
                            )}

                            {/* Complaint – filed already */}
                            {complaintMap[job._id] ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Complaint</span>
                                <span className={`complaint-status complaint-status--${complaintMap[job._id].status}`}>
                                  {complaintMap[job._id].status}
                                </span>
                              </div>
                            ) : job.status === 'completed' && job.payment.status === 'paid' ? (
                              (() => {
                                const paidAt = job.payment.paidAt ? new Date(job.payment.paidAt) : null;
                                const windowExpired = paidAt && (Date.now() - paidAt.getTime() > 24 * 60 * 60 * 1000);
                                return windowExpired ? (
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={11} /> Complaint window expired
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => openComplaintModal(job)}
                                    className="btn btn-danger"
                                    style={{ padding: '6px 12px', fontSize: '12px' }}
                                  >
                                    🚩 File Complaint
                                  </button>
                                );
                              })()
                            ) : null}

                            {/* Track Live */}
                            {['assigned', 'en_route'].includes(job.status) && (
                              <button
                                onClick={() => {
                                  setActiveJob(job);
                                  setDispatchStatus('accepted');
                                  if (job.worker) {
                                    setWorkerDetails(job.worker);
                                    setWorkerCoords({ latitude: job.worker.latitude, longitude: job.worker.longitude });
                                  }
                                  setActiveTab('daily');
                                  setupSocket(job._id);
                                }}
                                className="btn btn-secondary"
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                              >
                                Track Live
                              </button>
                            )}

                            {/* Resume Match */}
                            {job.status === 'pending' && job.type === 'daily' && (
                              <button
                                onClick={() => {
                                  setActiveJob(job);
                                  setDispatchStatus('searching');
                                  setActiveTab('daily');
                                  setupSocket(job._id);
                                }}
                                className="btn btn-secondary"
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                              >
                                Resume Match
                              </button>
                            )}

                          </div>
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
            </div>
          )}
        </div>
      )}

      {activeTab === 'complaints' && <CustomerComplaintsPanel />}

      {showPaymentModal && activeJob && (
        <StripePaymentModal
          job={activeJob}
          onSuccess={handlePaymentSuccess}
          onClose={handleClosePayment}
        />
      )}
      {showCompletionModal && completionJob && (
        <div className="spm-overlay" onClick={() => { setShowCompletionModal(false); setCompletionJob(null); }}>
          <div className="spm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div style={{ padding: 20 }}>
              <h3>Service completed successfully</h3>
              <p style={{ color: 'var(--text-secondary)' }}>The service was marked complete. Please complete the escrow payment first, then you can leave feedback.</p>
              <div style={{ display: 'flex', gap: '10px', marginTop: 16 }}>
                <button className="btn btn-primary" onClick={() => {
                  setShowCompletionModal(false);
                  setActiveJob(completionJob);
                  setShowPaymentModal(true);
                }}>Pay Now</button>
                <button className="btn btn-secondary" onClick={() => {
                  setShowCompletionModal(false);
                  setCompletionJob(null);
                  setActiveTab('daily');
                }}>Back To Dashboard</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showComplaintModal && complaintModalJob && (
        <ComplaintModal
          job={complaintModalJob}
          token={localStorage.getItem('token')}
          onClose={() => setShowComplaintModal(false)}
          onSuccess={handleComplaintSuccess}
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
            background: 'rgba(0,0,0,0.80)',
            pointerEvents: 'none',
            zIndex: 999
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
            zIndex: 1000,
            pointerEvents: 'none'
          }} />
        </>
      )}
      {showTutorial && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          padding: '30px',
          zIndex: 1001,
          pointerEvents: 'none'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '520px',
            background: 'rgba(14, 17, 28, 0.96)',
            border: '1px solid rgba(255, 107, 0, 0.35)',
            borderRadius: '24px',
            padding: '24px',
            backdropFilter: 'blur(20px)',
            color: '#fff',
            pointerEvents: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--primary-orange)', fontWeight: '700' }}>
                  Step {tutorialStep} of {customerSteps.length}
                </div>
                <h3 style={{ fontSize: '22px', margin: '8px 0' }}>{customerSteps[tutorialStep - 1].title}</h3>
              </div>
              <button onClick={handleTutorialFinish} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                Skip
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '20px' }}>{customerSteps[tutorialStep - 1].description}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <button onClick={handleTutorialFinish} className="btn btn-secondary" style={{ flex: 1, padding: '12px 14px', fontSize: '14px' }}>
                End Tour
              </button>
              <button onClick={handleTutorialNext} className="btn btn-primary" style={{ flex: 1, padding: '12px 14px', fontSize: '14px' }}>
                {tutorialStep === customerSteps.length ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding walkthrough Modal */}

      {/* Feedback Modal */}
      {showFeedbackModal && feedbackJob && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(6px)'
          }}
          onClick={() => { setShowFeedbackModal(false); setFeedbackJob(null); setFeedbackHover(0); }}
        >
          <div
            style={{
              background: 'var(--bg-card)', padding: '32px 28px', borderRadius: '20px',
              width: '100%', maxWidth: '440px',
              border: '1px solid rgba(251,191,36,0.25)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.5)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(251,191,36,0.2), rgba(251,191,36,0.05))',
                border: '2px solid rgba(251,191,36,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '28px', margin: '0 auto 14px'
              }}>👷</div>
              <h3 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', margin: '0 0 6px' }}>Rate Your Experience</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                How was your experience with <strong style={{ color: '#fff' }}>{feedbackJob.worker?.name || 'the worker'}</strong>?
              </p>
            </div>

            <form onSubmit={handleFeedbackSubmit}>
              {/* Star Rating */}
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '8px' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackRating(star)}
                      onMouseEnter={() => setFeedbackHover(star)}
                      onMouseLeave={() => setFeedbackHover(0)}
                      style={{
                        background: 'none', border: 'none', padding: '4px',
                        fontSize: '40px', cursor: 'pointer', outline: 'none',
                        color: star <= (feedbackHover || feedbackRating) ? '#fbbf24' : 'rgba(255,255,255,0.15)',
                        transform: star <= (feedbackHover || feedbackRating) ? 'scale(1.15)' : 'scale(1)',
                        transition: 'all 0.15s ease',
                        display: 'inline-block',
                        filter: star <= (feedbackHover || feedbackRating) ? 'drop-shadow(0 0 8px rgba(251,191,36,0.6))' : 'none'
                      }}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <p style={{
                  fontSize: '13px', fontWeight: '600', margin: 0,
                  color: feedbackRating >= 4 ? '#10b981' : feedbackRating === 3 ? '#fbbf24' : '#ef4444'
                }}>
                  {feedbackRating === 5 ? '🌟 Excellent!' :
                   feedbackRating === 4 ? '😊 Good' :
                   feedbackRating === 3 ? '😐 Average' :
                   feedbackRating === 2 ? '😕 Below Average' : '😞 Poor'}
                </p>
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px solid var(--border-grey)', margin: '20px 0' }} />

              {/* Written Feedback */}
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MessageSquare size={14} style={{ color: 'var(--primary-orange)' }} />
                  Written Feedback <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
                </label>
                <textarea
                  className="form-input"
                  placeholder="Tell others about your experience — quality of work, punctuality, professionalism..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  rows={3}
                  style={{ resize: 'none' }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => { setShowFeedbackModal(false); setFeedbackJob(null); setFeedbackHover(0); }}
                  disabled={submittingFeedback}
                >
                  Skip
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  disabled={submittingFeedback}
                >
                  {submittingFeedback ? (
                    <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Submitting...</>
                  ) : (
                    <> ★ Submit Review</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}
