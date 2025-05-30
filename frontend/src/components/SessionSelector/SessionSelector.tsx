import React, { useState, useEffect } from 'react';
import { Session } from '../../types/f1';
import { f1Api } from '../../services/f1Api';
import './SessionSelector.css';

interface SessionSelectorProps {
  currentSession: Session | null;
  onSessionSelect: (sessionKey: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

interface SessionGroup {
  meeting_name: string;
  location: string;
  sessions: Session[];
}

const SessionSelector: React.FC<SessionSelectorProps> = ({
  currentSession,
  onSessionSelect,
  isOpen,
  onToggle
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Load sessions for the selected year
  useEffect(() => {
    const loadSessions = async () => {
      setLoading(true);
      try {
        const response = await f1Api.getAllSessions(selectedYear);
        setSessions(response.sessions || []);
      } catch (error) {
        console.error('Failed to load sessions:', error);
        setSessions([]);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      loadSessions();
    }
  }, [selectedYear, isOpen]);

  // Group sessions by meeting
  const groupedSessions = sessions.reduce((groups: SessionGroup[], session) => {
    const existingGroup = groups.find(g => g.meeting_name === session.meeting_name);
    
    if (existingGroup) {
      existingGroup.sessions.push(session);
    } else {
      groups.push({
        meeting_name: session.meeting_name || 'Unknown Event',
        location: session.location || '',
        sessions: [session]
      });
    }
    
    return groups;
  }, []);

  // Sort sessions within each group
  groupedSessions.forEach(group => {
    group.sessions.sort((a, b) => {
      const sessionOrder = ['Practice 1', 'Practice 2', 'Practice 3', 'Qualifying', 'Sprint', 'Race'];
      return sessionOrder.indexOf(a.session_name) - sessionOrder.indexOf(b.session_name);
    });
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const isSessionLive = (session: Session) => {
    const now = new Date();
    const start = new Date(session.date_start);
    const end = new Date(session.date_end);
    return now >= start && now <= end;
  };

  const isSessionCompleted = (session: Session) => {
    const now = new Date();
    const end = new Date(session.date_end);
    return now > end;
  };

  if (!isOpen) {
    return (
      <button className="session-selector-toggle" onClick={onToggle}>
        📅 {currentSession ? `${currentSession.session_name} - ${currentSession.circuit_short_name}` : 'Select Session'}
        <span className="toggle-icon">▼</span>
      </button>
    );
  }

  return (
    <div className="session-selector-overlay" onClick={onToggle}>
      <div className="session-selector-panel" onClick={e => e.stopPropagation()}>
        <div className="selector-header">
          <h3>📅 Select F1 Session</h3>
          <button className="close-btn" onClick={onToggle}>✕</button>
        </div>

        <div className="year-selector">
          <label>Year:</label>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            <option value={2024}>2024</option>
            <option value={2023}>2023</option>
          </select>
        </div>

        <div className="sessions-list">
          {loading ? (
            <div className="loading-sessions">Loading sessions...</div>
          ) : groupedSessions.length === 0 ? (
            <div className="no-sessions">No sessions found for {selectedYear}</div>
          ) : (
            groupedSessions.map((group, groupIndex) => (
              <div key={groupIndex} className="session-group">
                <div className="group-header">
                  <h4>{group.meeting_name}</h4>
                  <span className="location">{group.location}</span>
                </div>
                
                <div className="group-sessions">
                  {group.sessions.map((session) => {
                    const isLive = isSessionLive(session);
                    const isCompleted = isSessionCompleted(session);
                    const isCurrent = currentSession?.session_key === session.session_key;
                    
                    return (
                      <button
                        key={session.session_key}
                        className={`session-item ${isCurrent ? 'current' : ''} ${isLive ? 'live' : ''} ${isCompleted ? 'completed' : ''}`}
                        onClick={() => {
                          onSessionSelect(session.session_key.toString());
                          onToggle();
                        }}
                      >
                        <div className="session-info">
                          <span className="session-name">{session.session_name}</span>
                          <span className="session-date">{formatDate(session.date_start)}</span>
                        </div>
                        
                        <div className="session-status">
                          {isLive && <span className="status-badge live">LIVE</span>}
                          {isCompleted && !isLive && <span className="status-badge completed">COMPLETED</span>}
                          {!isCompleted && !isLive && <span className="status-badge upcoming">UPCOMING</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionSelector;