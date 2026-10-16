"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLanguage } from '@/context/LanguageContext';

/**
 * Extracts the bracket prefix from project name, e.g. "[SDV]_Degate" -> "SDV", "[ LGPRI ] S/W" -> "LGPRI"
 * If no bracket is found, returns "Khác".
 */
export function getProjectPrefix(name) {
  if (!name || typeof name !== 'string') return 'Khác';
  const match = name.match(/^\s*\[\s*([^\]]+?)\s*\]/);
  return match ? match[1].trim() : 'Khác';
}

/**
 * 2-Level Vertical Drilldown Project Selector:
 * Level 1: Clean vertical list of category cards (LG, LGPRI, SDV, SEVT, TOP, TOPV, PLV, DRI, Khác).
 * Level 2: Clicking a category replaces the list with projects belonging to that category, with a back button (← Quay lại).
 * Fully synchronized with all 4 themes: Classic Light, Classic Dark, Cyber Light, Cyber Dark.
 */
export default function HierarchicalProjectSelect({
  value,
  projects = [],
  onChange,
  placeholder,
  disabled = false
}) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null); // null = Level 1 (group list); string = Level 2 (projects in activeGroup)
  const wrapperRef = useRef(null);

  // Identify currently selected project
  const selectedProject = useMemo(() => {
    return projects.find(p => p.manpower_project_id === value);
  }, [projects, value]);

  // Compute unique groups and map of groupName -> projects
  const { groupNames, groupsMap } = useMemo(() => {
    const map = new Map();
    (projects || []).forEach(p => {
      const grp = getProjectPrefix(p.name);
      if (!map.has(grp)) {
        map.set(grp, []);
      }
      map.get(grp).push(p);
    });

    const sortedGroups = Array.from(map.keys()).sort((a, b) => {
      if (a === 'Khác') return 1;
      if (b === 'Khác') return -1;
      return a.localeCompare(b);
    });

    return {
      groupNames: sortedGroups,
      groupsMap: map
    };
  }, [projects]);

  // Close on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return undefined;
    const onDocMouseDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  // Toggle dropdown
  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      setActiveGroup(null);
    }
    setIsOpen(!isOpen);
  };

  // Choose a category (Level 1 -> Level 2)
  const handleSelectGroup = (grp) => {
    setActiveGroup(grp);
  };

  // Go back to Level 1
  const handleBackToGroups = () => {
    setActiveGroup(null);
  };

  // Select project and close
  const handleSelectProject = (projectId) => {
    onChange?.(projectId);
    setIsOpen(false);
  };

  // Clear current selection
  const handleClear = (e) => {
    e.stopPropagation();
    onChange?.('');
  };

  const defaultPlaceholder = placeholder || t('reports.selectProjectOptional', '-- Chọn dự án (Bắt buộc) --');

  // Projects in currently active group
  const activeProjects = activeGroup ? (groupsMap.get(activeGroup) || []) : [];

  return (
    <div ref={wrapperRef} className="hierarchical-project-select">
      {/* Trigger Control */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
        className={`hierarchical-select-trigger ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1, minWidth: 0 }}>
          {selectedProject ? (
            <span
              style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontWeight: '600'
              }}
              title={selectedProject.name}
            >
              {selectedProject.name}
            </span>
          ) : (
            <span style={{ color: 'var(--neutral-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {defaultPlaceholder}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px', flexShrink: 0 }}>
          {selectedProject && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleClear(e);
              }}
              title={t('common.clear', 'Bỏ chọn')}
              className="hierarchical-clear-btn"
            >
              &times;
            </span>
          )}
          <i
            className="fa-solid fa-chevron-down"
            style={{
              fontSize: '12px',
              color: 'var(--neutral-muted)',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease'
            }}
          ></i>
        </div>
      </div>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="hierarchical-select-dropdown">
          {/* LEVEL 1: Danh sách các thẻ nhóm xếp dọc */}
          {!activeGroup && (
            <div style={{ maxHeight: '270px', overflowY: 'auto', padding: '6px' }}>
              {groupNames.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--neutral-muted)', fontSize: '13px' }}>
                  {t('reports.noProjects', 'Không có dự án nào.')}
                </div>
              ) : (
                groupNames.map(grp => {
                  const isCurrentGroup = selectedProject && getProjectPrefix(selectedProject.name) === grp;
                  return (
                    <div
                      key={grp}
                      onClick={() => handleSelectGroup(grp)}
                      className={`hierarchical-group-item ${isCurrentGroup ? 'is-active-group' : ''}`}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-regular fa-folder group-icon"></i>
                        {grp}
                      </span>
                      <i className="fa-solid fa-chevron-right group-arrow"></i>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* LEVEL 2: Danh sách các dự án thuộc thẻ đã chọn (Thay thế hoàn toàn Level 1) */}
          {activeGroup && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Back button header */}
              <div
                onClick={handleBackToGroups}
                className="hierarchical-back-header"
              >
                <i className="fa-solid fa-arrow-left" style={{ fontSize: '12px' }}></i>
                <span>{t('common.back', 'Quay lại')}</span>
                <span style={{ color: 'var(--neutral-muted)', fontWeight: '400', fontSize: '12px', marginLeft: 'auto' }}>
                  {activeGroup}
                </span>
              </div>

              {/* Projects List */}
              <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '6px' }}>
                {activeProjects.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--neutral-muted)', fontSize: '13px' }}>
                    {t('reports.noProjectsInGroup', 'Không có dự án nào trong nhóm này.')}
                  </div>
                ) : (
                  activeProjects.map(p => {
                    const isSelected = p.manpower_project_id === value;
                    return (
                      <div
                        key={p.manpower_project_id}
                        onClick={() => handleSelectProject(p.manpower_project_id)}
                        className={`hierarchical-project-item ${isSelected ? 'is-selected' : ''}`}
                      >
                        <span
                          style={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            flex: 1,
                            marginRight: '8px'
                          }}
                          title={p.name}
                        >
                          {p.name}
                        </span>

                        {isSelected && (
                          <i className="fa-solid fa-check check-icon"></i>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
