"use client";

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { DocumentModal } from '@/components/Modals';
import Swal from 'sweetalert2';

export default function Documents() {
  const { currentUser, projects, projectMembers, users, documents, documentVersions, documentCategories, reloadAll } = useApp();

  const [activeDocCategory, setActiveDocCategory] = useState('cat-general');
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [docProjectFilter, setDocProjectFilter] = useState('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeDocId, setActiveDocId] = useState(null);

  if (!currentUser) return null;

  const isAdmin = currentUser.system_role.includes("Admin");
  const isMemberOfProject = (projId) => {
    if (isAdmin) return true;
    return projectMembers.some(m => m.project_id === projId && m.user_id === currentUser.id);
  };

  const myProjects = projects.filter(p => isMemberOfProject(p.id));
  const accessibleDocs = documents.filter(d => d.project_id === null || isMemberOfProject(d.project_id));

  const handleDownloadDoc = (att) => {
    Swal.fire({
      icon: 'info',
      title: 'Đang tải file',
      html: `Đang mô phỏng tải về tệp tin: <code>${att.file_url}</code><br>Dung lượng: <b>${att.file_size || 'N/A'}</b>`
    });
  };

  const openDocVersion = (id) => {
    setActiveDocId(id);
    setIsModalOpen(true);
  };

  const selectedCategoryObj = documentCategories.find(c => c.id === activeDocCategory);

  return (
    <div className="scrollable-view">
      <div className="doc-layout">
        <div className="doc-categories-panel">
        {documentCategories.map(c => {
          let icon = "fa-folder";
          if (c.type === "training") icon = "fa-graduation-cap";
          if (c.type === "general") icon = "fa-cabinet-filing";
          if (c.type === "project_lifecycle") icon = "fa-folder-tree";

          return (
            <button key={c.id} className={`doc-cat-btn ${activeDocCategory === c.id ? 'active' : ''}`} onClick={() => setActiveDocCategory(c.id)}>
              <i className={`fa-solid ${icon}`}></i> <span>{c.name}</span>
            </button>
          );
        })}
      </div>

      <div className="doc-main-panel">
        <div className="doc-filters">
          <div className="doc-search-input">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input type="text" value={docSearchQuery} onChange={(e) => setDocSearchQuery(e.target.value)} placeholder="Tìm tài liệu..." />
          </div>
          
          {selectedCategoryObj?.type === "project_lifecycle" && (
            <select value={docProjectFilter} onChange={(e) => setDocProjectFilter(e.target.value)} className="doc-select-filter">
              <option value="all">Mọi dự án</option>
              {myProjects.map(p => (
                <option value={p.id} key={p.id}>{p.name}</option>
              ))}
            </select>
          )}

          <button className="btn btn-primary" onClick={() => { setActiveDocId(null); setIsModalOpen(true); }}>
            <i className="fa-solid fa-cloud-arrow-up"></i> Tải lên
          </button>
        </div>

        <div className="doc-main-panel" style={{ gap: '12px' }}>
          {accessibleDocs
            .filter(d => d.category_id === activeDocCategory)
            .filter(d => docProjectFilter === 'all' || d.project_id === docProjectFilter)
            .filter(d => !docSearchQuery || d.title.toLowerCase().includes(docSearchQuery.toLowerCase()))
            .map(d => {
              const u = users.find(usr => usr.id === d.uploaded_by);
              const date = new Date(d.created_at);
              const dateStr = `${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()}`;
              const docVers = documentVersions.filter(v => v.document_id === d.id);
              docVers.sort((a,b) => b.version_number - a.version_number);
              const latest = docVers[0] || { version_number: 1, file_url: 'N/A', file_size: '0 KB' };

              return (
                <div className="document-item-card" key={d.id}>
                  <div className="doc-card-left">
                    <div className="doc-icon-box"><i className="fa-solid fa-file-pdf"></i></div>
                    <div className="doc-info-box">
                      <h3>{d.title}</h3>
                      <p>Tải lên bởi: <strong>{u ? u.name : 'N/A'}</strong> | Ngày: {dateStr}</p>
                      <div className="version-badge-container">
                        <span className="version-pill">Phiên bản v{latest.version_number}</span>
                        <span className="text-muted">{latest.file_url} ({latest.file_size})</span>
                      </div>
                    </div>
                  </div>
                  <div className="doc-card-right">
                    <button className="btn btn-secondary btn-sm" onClick={() => handleDownloadDoc(latest)}><i className="fa-solid fa-download"></i> Tải về</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => openDocVersion(d.id)}><i className="fa-solid fa-code-fork"></i> Bản mới</button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <DocumentModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        docId={activeDocId}
        projId={selectedCategoryObj?.type === "project_lifecycle" ? (docProjectFilter !== 'all' ? docProjectFilter : null) : null}
        currentUser={currentUser}
        currentCategoryId={activeDocCategory}
        onSaved={reloadAll}
      />
    </div>
    </div>
  );
}
