import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { MapPin, Send, Mic } from 'lucide-react';
import { useState } from 'react';

export default function DailyService({
  selectedCategory,
  onCategoryChange,
  description,
  onDescriptionChange,
  address,
  onAddressChange,
  gpsLoading,
  onFetchLocation,
  categories,
  onSubmitJob,
  activeJob,
  dispatchStatus,
  workerDetails,
  workerCoords,
  messages,
  newMessage,
  onNewMessageChange,
  onSendMessage,
  isChatRecording,
  onStartChatRecording,
  isRecording,
  onStartVoiceRecording,
  onStopVoiceRecording,
  audioUrl,
  onUploadVoice,
  onOpenComplaintModal,
  onReleasePayment,
  complaintMap,
  showPaymentModal,
  onClosePayment,
  onOpenPayment,
  showComplaintModal,
  onCloseComplaint,
  PaymentModal,
  ComplaintModal,
  token
}) {
  return (
    <div className="daily-service-layout">
      <div className="card">
        <h3>Daily Routine Service</h3>
        <p className="section-subtitle">Select a service category, add details, and request a nearby technician.</p>

        <form onSubmit={onSubmitJob} className="service-form">
          <div className="form-row">
            <label>Category</label>
            <select value={selectedCategory} onChange={(e) => onCategoryChange(e.target.value)} className="form-input" required>
              <option value="">Choose category</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Issue Description</label>
            <textarea value={description} onChange={(e) => onDescriptionChange(e.target.value)} className="form-input" rows={4} placeholder="Describe the issue or ask for an expert recommendation." required />
          </div>

          <div className="form-row">
            <label>Service Location</label>
            <div className="location-field">
              <input type="text" value={address} onChange={(e) => onAddressChange(e.target.value)} className="form-input" required />
              <button type="button" className="btn btn-secondary" onClick={onFetchLocation} disabled={gpsLoading}>
                {gpsLoading ? 'Locating…' : 'Use GPS'}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary">Request Technician</button>
        </form>
      </div>

      <div className="card map-card">
        <div className="section-header">
          <MapPin size={18} />
          <h3>Live Job Map</h3>
        </div>
        <MapContainer center={[24.8607, 67.0011]} zoom={13} scrollWheelZoom={false} className="map-frame">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={[24.8607, 67.0011]}>
            <Popup>Your current selection</Popup>
          </Marker>
          {workerCoords && (
            <Marker position={[workerCoords.latitude, workerCoords.longitude]}>
              <Popup>Worker location</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
