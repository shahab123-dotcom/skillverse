import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import { Mic, MicOff, Send, Phone, MapPin, CheckCircle, CreditCard, Play, MessageSquare, ShieldAlert, Clock, Navigation, Route, X } from 'lucide-react';
import { API_URL } from '../../App';
import LiveTrackingMap from '../../components/shared/LiveTrackingMap';
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

  // Active Job Match & Sockets Tracking
  const [activeJob, setActiveJob] = useState(null);
  const [dispatchStatus, setDispatchStatus] = useState(''); // 'searching', 'accepted', 'declined', 'failed', 'completed'
  const [workerDetails, setWorkerDetails] = useState(null);
  const [workerCoords, setWorkerCoords] = useState(null);
  const [distanceToWorker, setDistanceToWorker] = useState(null);
  const [etaMinutes, setEtaMinutes] = useState(null);
  const [trackingDistance, setTrackingDistance] = useState(null);
  const [trackingEta, setTrackingEta] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [complaintMap, setComplaintMap] = useState({});
  const [complaintModalJob, setComplaintModalJob] = useState(null);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [highlightRect, setHighlightRect] = useState(null);
  
  const categoryRef = useRef(null);
  const requestRef = useRef(null);
  const trackingRef = useRef(null);
  const paymentRef = useRef(null);
  const chatRef = useRef(null);
  
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

  // Newly Construction Form
  const [conCategory, setConCategory] = useState('');
  const [conTitle, setConTitle] = useState('');
  const [conBudget, setConBudget] = useState('');
  const [conDescription, setConDescription] = useState('');
  const [conAddress, setConAddress] = useState('Clifton Block 5, Karachi');

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

  const updateTrackingStats = (coords) => {
    if (!activeJob?.location?.latitude || !activeJob?.location?.longitude || !coords?.latitude || !coords?.longitude) {
      return;
    }

    const toLat = Number(activeJob.location.latitude);
    const toLon = Number(activeJob.location.longitude);
    const fromLat = Number(coords.latitude);
    const fromLon = Number(coords.longitude);
    const R = 6371;
    const dLat = (toLat - fromLat) * Math.PI / 180;
    const dLon = (toLon - fromLon) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(fromLat * Math.PI / 180) * Math.cos(toLat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    setTrackingDistance(distance);
    setTrackingEta(Math.max(1, Math.round(distance * 5)));
    setDistanceToWorker(distance);
    setEtaMinutes(Math.max(1, Math.round(distance * 5)));
  };

  useEffect(() => {
    if (workerCoords) {
      updateTrackingStats(workerCoords);
    }
  }, [workerCoords, activeJob?.location?.latitude, activeJob?.location?.longitude]);

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
    const stepRefs = [categoryRef, requestRef, trackingRef, paymentRef, chatRef];
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
        // Check if there is an active job currently pending or en-route
        const currentActive = data.find(job => ['pending', 'assigned', 'en_route'].includes(job.status));
        if (currentActive) {
          setActiveJob(currentActive);
          setDispatchStatus(currentActive.status === 'pending' ? 'searching' : 'accepted');
          if (currentActive.worker && currentActive.worker.latitude !== undefined && currentActive.worker.longitude !== undefined) {
            setWorkerDetails(currentActive.worker);
            setWorkerCoords({
              latitude: currentActive.worker.latitude,
              longitude: currentActive.worker.longitude
            });
          }
          // Set up socket connection for active job
          setupSocket(currentActive._id);
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
    if (data?.job) {
      setActiveJob(data.job);
    }
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

  // Setup sockets
  const setupSocket = (jobId) => {
    if (socketRef.current) socketRef.current.disconnect();

    const socket = io(API_URL);
    socketRef.current = socket;

    socket.emit('register', user.id);
    socket.emit('join_job', jobId);

    socket.on('connect_error', () => {
      toast.error('Connection lost. Tracking updates may pause until the network reconnects.');
    });

    socket.on('disconnect', () => {
      toast.info('Tracking connection temporarily disconnected.');
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
      updateTrackingStats(coords);
    });

    // Listen for job status change
    socket.on('job_status_updated', ({ status }) => {
      setDispatchStatus(status === 'completed' ? 'completed' : 'accepted');
      setActiveJob(prev => prev ? { ...prev, status } : prev);
      if (status === 'completed') {
        loadHistory();
      }
    });

    // Listen for incoming messages
    socket.on('receive_message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    // Listen for failed matches
    socket.on('dispatch_failed', (data) => {
      setDispatchStatus('failed');
      toast.info(data.message);
    });

    // Listen for job rejection (by worker or customer)
    socket.on('job_rejected', (data) => {
      resetActiveJobState();
      toast.info('Job has been rejected and returned to pending');
      loadHistory();
    });

    // Listen for job cancellation (by customer)
    socket.on('job_cancelled', (data) => {
      resetActiveJobState();
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
    if (!trimmedManualAddress) {
      return toast.warning('Please enter your address in the manual address field.');
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
      const response = await fetch(`${API_URL}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
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
            address: trimmedAddress,
            manualAddress: trimmedManualAddress
          },
          paymentAmount: 1500 // PKR flat rate
        })
      });

      const data = await response.json();
      if (response.ok) {
        setActiveJob(data.job);
        setDispatchStatus('searching');
        setupSocket(data.job._id);

        // Emit request_job_dispatch via socket
        socketRef.current.emit('request_job_dispatch', { jobId: data.job._id });
      } else {
        toast.error(data.error || 'Booking failed.');
      }
    } catch (error) {
      console.error("Booking Error:", error);
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
    if (!conCategory || !conTitle || !conDescription) {
      return toast.warning('Please fill all required fields');
    }

    try {
      const response = await fetch(`${API_URL}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          type: 'construction',
          category: conCategory,
          description: `Title: ${conTitle}. Description: ${conDescription}`,
          location: {
            latitude: latitude || 24.8607,
            longitude: longitude || 67.0011,
            address: conAddress
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
  const resetActiveJobState = () => {
    setActiveJob(null);
    setDispatchStatus('');
    setWorkerDetails(null);
    setWorkerCoords(null);
    setMessages([]);
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
        resetActiveJobState();
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
        setDispatchStatus('completed');
        setActiveJob(data.job);
      } else {
        toast.error(data.error || 'Failed to complete job');
      }
    } catch (error) {
      console.error('Failed to complete job:', error);
      toast.error('Failed to complete job');
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
                <div style={{ borderTop: '1px solid var(--border-grey)', paddingTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                      <label className="form-label">Manual Address *</label>
                      <input
                        type="text"
                        name="manualAddress"
                        placeholder="Enter your full address here"
                        value={manualAddress}
                        onChange={(e) => setManualAddress(e.target.value)}
                        className="form-input"
                        required
                        style={{ height: '54px' }}
                      />
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                        This is the address workers will use to find you.
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
            /* Active Job Matching or tracking */
            <div className="card job-tracking-grid card--padded">
              
              {/* Map Tracker Column */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '20px' }}>Real-Time Worker GPS Tracker</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Category: <strong>{activeJob.category}</strong></p>
                  </div>
                  
                  {dispatchStatus === 'searching' && <StatusBadge status="searching" label="Searching Workers..." />}
                  {dispatchStatus === 'accepted' && <StatusBadge status="accepted" label="Worker Assigned" />}
                  {dispatchStatus === 'completed' && <StatusBadge status="completed" label="Job Completed" />}
                </div>

                {/* Real OpenStreetMap Map via Leaflet */}
                <div style={{ height: '380px', width: '100%', borderRadius: '20px', overflow: 'hidden', border: '1px solid var(--border-grey)', position: 'relative' }}>
                  {dispatchStatus === 'searching' && (
                    <div 
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        background: 'rgba(12, 12, 14, 0.85)',
                        zIndex: 999,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px'
                      }}
                    >
                      <div 
                        style={{
                          width: '80px',
                          height: '80px',
                          border: '2px solid var(--primary-orange)',
                          borderRadius: '50%',
                          animation: 'pulseMic 1.5s infinite',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <span style={{ fontSize: '11px', color: 'var(--primary-orange)', fontWeight: 700 }}>GPS SCAN</span>
                      </div>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Pinging nearest available workers...</span>
                    </div>
                  )}

                  {/* Tracking Info Overlay */}
                  {dispatchStatus === 'accepted' && workerCoords && (
                    <div 
                      style={{
                        position: 'absolute',
                        top: '12px',
                        left: '12px',
                        right: '12px',
                        background: 'rgba(12, 12, 14, 0.9)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        zIndex: 1000,
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: '50%', 
                          background: 'linear-gradient(135deg, var(--primary-orange), #ff6b35)',
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center' 
                        }}>
                          <Navigation size={20} color="#fff" />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>
                            {workerDetails?.name || 'Worker'} is on the way
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {distanceToWorker !== null ? `${distanceToWorker.toFixed(1)} km away` : 'Calculating distance...'}
                          </div>
                        </div>
                      </div>
                      <div style={{ 
                        background: 'rgba(34, 197, 94, 0.15)', 
                        border: '1px solid rgba(34, 197, 94, 0.3)', 
                        borderRadius: '8px', 
                        padding: '8px 12px',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '11px', color: '#86efac', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ETA</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>
                          {etaMinutes !== null ? `${etaMinutes} min` : '--'}
                        </div>
                      </div>
                    </div>
                  )}

                  <LiveTrackingMap
                    role="customer"
                    customerLocation={{ latitude, longitude }}
                    workerLocation={workerCoords}
                    onRouteInfo={({ distanceKm, etaMinutes }) => {
                      if (distanceKm !== null && etaMinutes !== null) {
                        setTrackingDistance(distanceKm);
                        setTrackingEta(etaMinutes);
                        setDistanceToWorker(distanceKm);
                        setEtaMinutes(etaMinutes);
                      }
                    }}
                    height="100%"
                    initialCenter={[latitude, longitude]}
                  />
                </div>

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

              {/* Sidebar Action Column: Details, Live Chat and Payments */}
              <div style={{ borderLeft: '1px solid var(--border-grey)', paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* 1. Service Address Summary */}
                <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-grey)' }}>
                  <h4 style={{ fontSize: '16px', marginBottom: '8px' }}>Your Service Address</h4>
                  <p style={{ fontSize: '13px', color: '#fff', fontWeight: '600', lineHeight: 1.5 }}>
                    {getDisplayAddress(activeJob?.location || { address, manualAddress, latitude, longitude })}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    This is the address the worker will see for your request.
                  </p>
                </div>

                {/* 2. Assigned Worker Profile */}
                <div>
                  <h4 style={{ fontSize: '16px', marginBottom: '12px' }}>Worker Profile</h4>
                  {workerDetails ? (
                    <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-grey)' }}>
                      <h5 style={{ fontSize: '15px', color: '#fff' }}>{workerDetails.name}</h5>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Skillsverse Approved Contractor</span>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '12px', alignItems: 'center' }}>
                        <Phone size={14} color="var(--primary-orange)" />
                        <span style={{ fontSize: '13px' }}>{workerDetails.phone}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                        <StatusBadge status={activeJob.status} className="badge-sm" />
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: 'var(--bg-input)', padding: '16px', borderRadius: '12px', color: 'var(--text-secondary)', fontSize: '13px', fontStyle: 'italic' }}>
                      Waiting for a worker to accept your request...
                    </div>
                  )}
                </div>

                {/* 3. Escrow Payment Action */}
                {workerDetails && (
                  <div style={{ background: 'rgba(255, 107, 0, 0.05)', border: '1px solid rgba(255,107,0,0.3)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px' }}>
                      <CreditCard size={18} color="var(--primary-orange)" />
                      <h5 style={{ fontSize: '14px', color: '#fff' }}>Escrow Payment</h5>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      <strong>PKR {activeJob?.payment?.amount?.toLocaleString() || '1,500'}</strong> is held in Skillsverse Vault. Pay securely via card once the service is complete.
                    </p>
                    <div style={{ marginBottom: '12px', padding: '10px', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border-grey)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>Payment Method</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CreditCard size={14} color="var(--primary-orange)" />
                        <span style={{ fontSize: '13px', color: '#fff' }}>Stripe Card Payment</span>
                      </div>
                    </div>
                    {activeJob?.payment?.status === 'paid' ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--success-color)', fontSize: '13px', fontWeight: 700 }}>
                        <CheckCircle size={15} />
                        Payment Confirmed — Job Completed!
                      </div>
                    ) : activeJob?.status === 'completed' ? (
                      <button
                        onClick={handlePayment}
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '10px', fontSize: '13px' }}
                      >
                        <CreditCard size={14} />
                        Pay Now via Stripe Card
                      </button>
                    ) : (
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Waiting for worker to complete the job.
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Live Chat */}
                {workerDetails && (
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                      <MessageSquare size={16} color="var(--primary-orange)" />
                      <h4 style={{ fontSize: '15px' }}>Job Discussion Chat</h4>
                    </div>

                    <div className="chat-window" style={{ height: '340px' }}>
                      <div className="chat-messages">
                        {messages.length === 0 ? (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}>
                            Start typing below to talk with {workerDetails.name}
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

                      <form ref={chatRef} onSubmit={sendMessage} className="chat-input-area" style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', background: 'var(--bg-input)' }}>
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
                )}
              </div>
            </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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
                  <label className="form-label">Construction Site Address</label>
                  <input 
                    type="text" 
                    value={conAddress} 
                    onChange={(e) => setConAddress(e.target.value)} 
                    className="form-input"
                    required
                  />
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
                        <td style={{ padding: '12px' }}>{job.worker ? job.worker.name : <span style={{ color: 'var(--text-muted)' }}>Not Assigned</span>}</td>
                        <td style={{ padding: '12px' }}>
                          <StatusBadge status={job.status} />
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: '600' }}>{job.payment.amount} PKR</span>
                            <span style={{ fontSize: '11px', color: job.payment.status === 'paid' ? 'var(--success-color)' : 'var(--warning-color)' }}>
                              {job.payment.status === 'paid' ? 'Paid' : 'Pending'}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                              Hold: {job.payment.holdStatus || 'held'}
                            </span>
                          </div>
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

    </DashboardLayout>
  );
}
