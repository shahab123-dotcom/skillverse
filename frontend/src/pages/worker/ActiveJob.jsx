import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Navigation, Send, MessageSquare, Mic, Check, X, AlertTriangle } from 'lucide-react';
import './ActiveJob.css';
import { API_URL } from '../../App';
import { useToast } from '../../context/ToastContext';
import StatusBadge from '../../components/shared/StatusBadge';
import EmptyState from '../../components/shared/EmptyState';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import io from 'socket.io-client';

// Fix for default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function ActiveJob({
  activeJob,
  jobStatus,
  setJobStatus,
  gpsLocation,
  messages,
  setMessages,
  newMessage,
  setNewMessage,
  socketRef,
  clearJobState,
  handleRejectJob,
  handleCompleteJob,
  getAddressText,
  isAvailable,
  handleToggleAvailability
}) {
  const toast = useToast();
  const chatEndRef = useRef(null);

  // Chat voice recording state
  const [isChatRecording, setIsChatRecording] = useState(false);
  const [chatMediaRecorder, setChatMediaRecorder] = useState(null);
  const [chatRecordingDuration, setChatRecordingDuration] = useState(0);
  const chatRecordingIntervalRef = useRef(null);
  const chatChunksRef = useRef([]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const handleArrive = async () => {
    try {
      const response = await fetch(`${API_URL}/api/jobs/${activeJob._id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: 'en_route' })
      });
      const data = await response.json();
      if (response.ok) {
        toast.success('Status updated to en_route');
        setJobStatus('en_route');
        setActiveJob(prev => prev ? { ...prev, status: 'en_route' } : prev);
      } else {
        toast.error(data.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Failed to update job status:', error);
      toast.error('Failed to update status');
    }
  };

  const navigateToCustomer = () => {
  if (!gpsLocation || !activeJob?.location) {
    alert("Location not available.");
    return;
  }

  const workerLat = gpsLocation.latitude;
  const workerLng = gpsLocation.longitude;

  const customerLat = activeJob.location.latitude;
  const customerLng = activeJob.location.longitude;

  const url =
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${workerLat},${workerLng}` +
    `&destination=${customerLat},${customerLng}` +
    `&travelmode=driving`;

  window.open(url, "_blank");
};

  if (!activeJob) {
    return (
      <EmptyState
        icon={AlertTriangle}
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
    );
  }

  return (
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
        <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
          {jobStatus === 'assigned' && (
            <button onClick={handleArrive} className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Navigation size={16} /> Mark as En Route
            </button>
          )}
          {jobStatus === 'en_route' && (
            <>
              <button onClick={navigateToCustomer} className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Navigation size={16} /> Navigate to Customer
              </button>
              <button onClick={handleCompleteJob} className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Check size={16} /> Mark as Arrived
              </button>
            </>
          )}
          <button onClick={handleRejectJob} className="btn btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <X size={16} /> Reject Job
          </button>
        </div>

        {/* Chat Box */}
        <div style={{ marginTop: '20px', border: '1px solid var(--border-grey)', borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '12px 16px',
            background: 'linear-gradient(135deg, rgba(255,107,0,0.12), rgba(255,107,0,0.04))',
            borderBottom: '1px solid var(--border-grey)'
          }}>
            <MessageSquare size={16} style={{ color: 'var(--primary-orange)' }} />
            <span style={{ fontWeight: '700', fontSize: '14px', color: '#fff' }}>
              Chat with {activeJob.customer?.name || 'Customer'}
            </span>
          </div>

          <div style={{
            height: '260px', overflowY: 'auto', padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: '10px',
            background: 'var(--bg-input)'
          }}>
            {messages.length === 0 ? (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-secondary)', fontSize: '13px', gap: '8px'
              }}>
                <MessageSquare size={28} style={{ opacity: 0.3 }} />
                <span>No messages yet. Say hello! 👋</span>
              </div>
            ) : (
              messages.map((msg, i) => {
                const isMe = msg.sender === 'worker';
                return (
                  <div key={i} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start'
                  }}>
                    <div style={{
                      maxWidth: '78%',
                      background: isMe
                        ? 'linear-gradient(135deg, rgba(255,107,0,0.3), rgba(255,107,0,0.15))'
                        : 'rgba(255,255,255,0.06)',
                      border: isMe ? '1px solid rgba(255,107,0,0.35)' : '1px solid var(--border-grey)',
                      borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      padding: '9px 13px',
                      color: '#fff',
                      fontSize: '13px',
                      lineHeight: 1.5
                    }}>
                      {msg.voiceUrl ? (
                        <audio
                          src={msg.voiceUrl.startsWith('http') ? msg.voiceUrl : `${API_URL}${msg.voiceUrl}`}
                          controls
                          style={{ width: '180px', height: '32px' }}
                        />
                      ) : (
                        msg.text
                      )}
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px', paddingLeft: '4px', paddingRight: '4px' }}>
                      {isMe ? 'You' : (activeJob.customer?.name || 'Customer')}
                      {msg.createdAt && ` · ${new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          <form
            onSubmit={sendMessage}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 12px',
              borderTop: '1px solid var(--border-grey)',
              background: 'var(--bg-card)'
            }}
          >
            {isChatRecording ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: '700' }}>{chatRecordingDuration}s</span>
                <button
                  type="button"
                  onClick={() => stopChatRecording(true)}
                  className="btn btn-primary"
                  style={{ padding: '4px 8px', fontSize: '12px' }}
                >
                  Send
                </button>
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
  );
}
