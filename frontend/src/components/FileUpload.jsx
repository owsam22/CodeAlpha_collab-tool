import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import { HiOutlineCloudUpload, HiOutlineDocumentDownload, HiOutlineTrash, HiOutlineDocument } from 'react-icons/hi';

const FileUpload = ({ roomId, meetingId }) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (meetingId) fetchFiles();
  }, [meetingId]);

  useEffect(() => {
    if (!socket) return;

    socket.on('file:new', ({ file }) => {
      setFiles((prev) => [file, ...prev]);
    });

    return () => socket.off('file:new');
  }, [socket]);

  const fetchFiles = async () => {
    try {
      const res = await API.get(`/files/${meetingId}`);
      setFiles(res.data.files);
    } catch (err) {
      console.error('Failed to fetch files:', err);
    }
  };

  const uploadFile = async (file) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('meetingId', meetingId);

      const res = await API.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setFiles((prev) => [res.data.file, ...prev]);

      if (socket) {
        socket.emit('file:uploaded', {
          roomId,
          file: res.data.file,
          userName: user?.name,
        });
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) uploadFile(droppedFile);
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) uploadFile(selectedFile);
  };

  const deleteFile = async (fileId) => {
    try {
      await API.delete(`/files/${fileId}`);
      setFiles((prev) => prev.filter((f) => f._id !== fileId));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType) => {
    if (mimeType?.startsWith('image/')) return '🖼️';
    if (mimeType?.includes('pdf')) return '📄';
    if (mimeType?.includes('video')) return '🎬';
    if (mimeType?.includes('audio')) return '🎵';
    if (mimeType?.includes('zip') || mimeType?.includes('rar')) return '📦';
    return '📄';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--glass-border)',
        fontWeight: 600, fontSize: '0.95rem',
      }}>
        Files
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          margin: 12, padding: 20, borderRadius: 12, cursor: 'pointer',
          border: `2px dashed ${dragOver ? 'var(--color-primary)' : 'var(--glass-border)'}`,
          background: dragOver ? 'rgba(99,102,241,0.08)' : 'transparent',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          transition: 'all 0.2s ease',
        }}
      >
        <HiOutlineCloudUpload size={28} style={{ color: dragOver ? 'var(--color-primary)' : 'var(--color-text-muted)' }} />
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
          {uploading ? 'Uploading...' : 'Drop a file or click to upload'}
        </span>
        <input ref={fileInputRef} type="file" onChange={handleFileSelect} style={{ display: 'none' }} />
      </div>

      {/* File list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
        {files.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 16 }}>
            No files shared yet
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {files.map((file) => (
              <div key={file._id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', background: 'var(--color-surface)',
                borderRadius: 10, transition: 'background 0.15s',
              }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-lighter)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-surface)'}
              >
                <span style={{ fontSize: '1.3rem' }}>{getFileIcon(file.mimeType)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.originalName}
                  </p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                    {formatSize(file.size)} • {file.uploadedBy?.name || 'Unknown'}
                  </p>
                </div>
                <a href={`/api/files/download/${file._id}`} target="_blank" rel="noopener noreferrer"
                  className="btn-icon" style={{ width: 30, height: 30, textDecoration: 'none' }}
                  onClick={(e) => e.stopPropagation()}>
                  <HiOutlineDocumentDownload size={14} />
                </a>
                {(file.uploadedBy?._id === user?.id || file.uploadedBy === user?.id || user?.role === 'admin') && (
                  <button className="btn-icon" onClick={() => deleteFile(file._id)}
                    style={{ width: 30, height: 30, color: 'var(--color-danger)' }}>
                    <HiOutlineTrash size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
