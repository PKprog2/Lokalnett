import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

// Fix for default marker icons in React Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Component to handle map animations
function FlyToLocation({ target, onComplete }) {
    const map = useMap();

    useEffect(() => {
        if (target) {
            const duration = 4.0; // Animation duration in seconds
            map.flyTo([target.lat, target.lng], 13, {
                duration: duration,
                easeLinearity: 0.25
            });

            // Wait for animation to finish before triggering onComplete
            const timer = setTimeout(() => {
                onComplete?.();
            }, duration * 1000 + 300); 

            return () => clearTimeout(timer);
        }
    }, [target, map, onComplete]);

    return null;
}

FlyToLocation.propTypes = {
    target: PropTypes.shape({
        lat: PropTypes.number,
        lng: PropTypes.number
    }),
    onComplete: PropTypes.func
};

export default function BygdMap({ bygder, onSelectBygd, targetBygd, onAnimationComplete }) {
    // Default center of Norway
    const center = [65.0, 13.0];
    const zoom = 5;
    
    // Internal state for when the map is used interactively (clicking markers)
    const [internalFlyTarget, setInternalFlyTarget] = useState(null);
    const [internalSelectedBygd, setInternalSelectedBygd] = useState(null);
    const [showEnterButton, setShowEnterButton] = useState(false);

    // Determine if we are in "transition mode" (targetBygd provided) or "interactive mode"
    const activeTarget = targetBygd 
        ? { lat: targetBygd.latitude, lng: targetBygd.longitude } 
        : internalFlyTarget;

    const handleMarkerClick = (bygd) => {
        // If we are already transitioning, ignore clicks
        if (targetBygd) return;

        setInternalSelectedBygd(bygd);
        setInternalFlyTarget({ lat: bygd.latitude, lng: bygd.longitude });
    };

    const handleAnimationComplete = () => {
        if (targetBygd) {
            setShowEnterButton(true);
        } else if (internalSelectedBygd) {
            onSelectBygd?.(internalSelectedBygd);
        }
    };

    return (
        <div style={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden', zIndex: 0 }}>
            <MapContainer 
                center={center} 
                zoom={zoom} 
                scrollWheelZoom={true} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                <FlyToLocation target={activeTarget} onComplete={handleAnimationComplete} />

                {bygder.map((bygd) => {
                    // Only render markers for bygder that have coordinates
                    if (!bygd.latitude || !bygd.longitude) return null;

                    return (
                        <Marker 
                            key={bygd.id} 
                            position={[bygd.latitude, bygd.longitude]}
                            eventHandlers={{
                                click: () => handleMarkerClick(bygd),
                            }}
                        >
                            <Popup>
                                <strong>{bygd.name}</strong>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>

            {showEnterButton && (
                <div style={{
                    position: 'absolute',
                    bottom: '15%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1000,
                    animation: 'fadeIn 0.5s ease-out'
                }}>
                    <style>
                        {`
                            @keyframes fadeIn {
                                from { opacity: 0; transform: translate(-50%, 20px); }
                                to { opacity: 1; transform: translate(-50%, 0); }
                            }
                        `}
                    </style>
                    <button 
                        onClick={onAnimationComplete}
                        style={{
                            padding: '16px 32px',
                            fontSize: '18px',
                            fontWeight: '600',
                            backgroundColor: '#204336',
                            color: 'white',
                            border: '2px solid rgba(255,255,255,0.2)',
                            borderRadius: '50px',
                            cursor: 'pointer',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                            backdropFilter: 'blur(8px)',
                            transition: 'transform 0.2s ease, background-color 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.transform = 'scale(1.05)';
                            e.target.style.backgroundColor = '#2a5544';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.transform = 'scale(1)';
                            e.target.style.backgroundColor = '#204336';
                        }}
                    >
                        Gå til bygdi →
                    </button>
                </div>
            )}
        </div>
    );
}

BygdMap.propTypes = {
    bygder: PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        latitude: PropTypes.number,
        longitude: PropTypes.number,
        description: PropTypes.string
    })).isRequired,
    onSelectBygd: PropTypes.func,
    targetBygd: PropTypes.object,
    onAnimationComplete: PropTypes.func
};
