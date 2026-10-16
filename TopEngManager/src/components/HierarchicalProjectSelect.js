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
 * Normalize string for accent-insensitive and case-insensitive search
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Unified Searchable Hierarchical Project Select:
 * - Direct Typing in Trigger Box: No duplicate search input. Click to type and filter immediately.
 * - When not typing / empty search: 2-Level Vertical Drilldown
 *   - Level 1: Category cards (LG, LGPRI, SDV, SEVT, TOP, TOPV, PLV, DRI, Khác) without project counts.
 *   - Level 2: Projects in selected category with '← Quay lại' header.
 * - When typing: Instant accent-insensitive search across all projects with category badges.
 * - Full 4-Theme Synchronization: Classic Light, Classic Dark, Cyber Light, Cyber Dark.
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
  const [inputValue, setInputValue] = useState('');
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Identify currently selected project
  const selectedProject = useMemo(() => {
    return projects.find(p => p.manpower_project_id === value);
  }, [projects, value]);

  // Sync inputValue with selectedProject when dropdown is closed or selection changes
  useEffect(() => {
    if (!isOpen) {
      setInputValue(selectedProject ? selectedProject.name : '');
    }
  }, [selectedProject, isOpen]);

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

  // Determine if user is currently searching by typing in the input
  const isSearching = useMemo(() => {
    if (!isOpen) return false;
    const trimmed = inputValue.trim();
    if (!trimmed) return false;
    // If the input matches the currently selected project name and hasn't been edited, don't trigger search
    if (selectedProject && trimmed === selectedProject.name) return false;
    return true;
  }, [isOpen, inputValue, selectedProject]);

  // Filtered projects during search mode
  const searchFilteredProjects = useMemo(() => {
    if (!isSearching) return [];
    const queryNorm = normalizeText(inputValue);
    return (projects || []).filter(p => {
      const nameNorm = normalizeText(p.name);
      const groupNorm = normalizeText(getProjectPrefix(p.name));
      return nameNorm.includes(queryNorm) || groupNorm.includes(queryNorm);
    });
  }, [projects, inputValue, isSearching]);

  // Close on outside click or Escape key
  useEffect(() => {
    if (!isOpen) return undefined;
    const onDocMouseDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
        setActiveGroup(null);
        setInputValue(selectedProject ? selectedProject.name : '');
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setActiveGroup(null);
        setInputValue(selectedProject ? selectedProject.name : '');
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, selectedProject]);

  // Handle clicking the input directly
  const handleInputClick = () => {
    if (disabled) return;
    if (!isOpen) {
      setIsOpen(true);
      setActiveGroup(null);
      setTimeout(() => {
        inputRef.current?.select();
      }, 10);
    }
  };

  // Handle typing inside the input
  const handleInputChange = (e) => {
    if (disabled) return;
    setInputValue(e.target.value);
    if (!isOpen) {
      setIsOpen(true);
      setActiveGroup(null);
    }
    // If user clears text, reset activeGroup to show Level 1
    if (!e.target.value.trim()) {
      setActiveGroup(null);
    }
  };

  // Keyboard navigation on input
  const handleInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      if (!isOpen) {
        setIsOpen(true);
        setActiveGroup(null);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isSearching && searchFilteredProjects.length > 0) {
        // Select first match
        handleSelectProject(searchFilteredProjects[0].manpower_project_id);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveGroup(null);
      setInputValue(selectedProject ? selectedProject.name : '');
      inputRef.current?.blur();
    }
  };

  // Handle clicking chevron button to toggle dropdown
  const handleToggleClick = (e) => {
    e.stopPropagation();
    if (disabled) return;
    if (isOpen) {
      setIsOpen(false);
      setActiveGroup(null);
      setInputValue(selectedProject ? selectedProject.name : '');
    } else {
      setIsOpen(true);
      setActiveGroup(null);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 10);
    }
  };

  // Choose a category (Level 1 -> Level 2)
  const handleSelectGroup = (grp) => {
    setActiveGroup(grp);
    inputRef.current?.focus();
  };

  // Go back to Level 1
  const handleBackToGroups = () => {
    setActiveGroup(null);
    inputRef.current?.focus();
  };

  // Select project and close
  const handleSelectProject = (projectId) => {
    onChange?.(projectId);
    const proj = projects.find(p => p.manpower_project_id === projectId);
    if (proj) {
      setInputValue(proj.name);
    }
    setIsOpen(false);
    setActiveGroup(null);
  };

  // Clear current selection
  const handleClear = (e) => {
    e.stopPropagation();
    onChange?.('');
    setInputValue('');
    setActiveGroup(null);
    inputRef.current?.focus();
  };

  const defaultPlaceholder = placeholder || t('reports.selectProjectOptional', '-- Chọn dự án (Bắt buộc) --');

  // Projects in currently active group (Level 2)
  const activeProjects = activeGroup ? (groupsMap.get(activeGroup) || []) : [];

  return (
    <div ref={wrapperRef} className="hierarchical-project-select">
      {/* Unified Trigger Input Box */}
      <div
        className={`hierarchical-select-trigger ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`}
        onClick={handleInputClick}
      >
        <input
          ref={inputRef}
          type="text"
          className="hierarchical-trigger-input"
          value={inputValue}
          placeholder={defaultPlaceholder}
          disabled={disabled}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          style={{
            fontWeight: selectedProject && !isSearching ? '600' : '400',
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            background: 'transparent',
            backgroundColor: 'transparent'
          }}
        />

        <div className="hierarchical-trigger-actions">
          {inputValue && !disabled && (
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
          <span
            role="button"
            tabIndex={-1}
            onClick={handleToggleClick}
            className="hierarchical-chevron-btn"
          >
            <i
              className="fa-solid fa-chevron-down"
              style={{
                fontSize: '12px',
                color: 'var(--neutral-muted)',
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease'
              }}
            ></i>
          </span>
        </div>
      </div>

      {/* Popover Dropdown (Contains only content, NO duplicate search box) */}
      {isOpen && (
        <div className="hierarchical-select-dropdown">
          {isSearching ? (
            /* SEARCH RESULTS */
            <div style={{ maxHeight: '270px', overflowY: 'auto', padding: '6px' }}>
              {searchFilteredProjects.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--neutral-muted)', fontSize: '13px' }}>
                  <i className="fa-solid fa-magnifying-glass" style={{ fontSize: '18px', display: 'block', marginBottom: '8px', opacity: 0.5 }}></i>
                  {t('reports.noMatchingProjects', 'Không tìm thấy dự án phù hợp.')}
                </div>
              ) : (
                searchFilteredProjects.map(p => {
                  const isSelected = p.manpower_project_id === value;
                  const prefix = getProjectPrefix(p.name);
                  return (
                    <div
                      key={p.manpower_project_id}
                      onClick={() => handleSelectProject(p.manpower_project_id)}
                      className={`hierarchical-project-item ${isSelected ? 'is-selected' : ''}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, marginRight: '8px' }}>
                        <span className="hierarchical-group-badge">
                          {prefix}
                        </span>
                        <span
                          style={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={p.name}
                        >
                          {p.name}
                        </span>
                      </div>
                      {isSelected && (
                        <i className="fa-solid fa-check check-icon"></i>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* 2-LEVEL DRILLDOWN */
            <>
              {/* LEVEL 1: Danh sách các thẻ nhóm xếp dọc (không kèm chữ số lượng dự án) */}
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
