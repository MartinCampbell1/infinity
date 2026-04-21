// ── Session action icons (SVG, monochrome, inherit currentColor) ──
const ICONS={
  pin:'<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" stroke="none"><polygon points="8,1.5 9.8,5.8 14.5,6.2 11,9.4 12,14 8,11.5 4,14 5,9.4 1.5,6.2 6.2,5.8"/></svg>',
  unpin:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><polygon points="8,2 9.8,6.2 14.2,6.2 10.7,9.2 12,13.8 8,11 4,13.8 5.3,9.2 1.8,6.2 6.2,6.2"/></svg>',
  folder:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2 4.5h4l1.5 1.5H14v7H2z"/></svg>',
  archive:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1.5" y="2" width="13" height="3" rx="1"/><path d="M2.5 5v8h11V5"/><line x1="6" y1="8.5" x2="10" y2="8.5"/></svg>',
  unarchive:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1.5" y="2" width="13" height="3" rx="1"/><path d="M2.5 5v8h11V5"/><polyline points="6.5,7 8,5.5 9.5,7"/></svg>',
  dup:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="4.5" y="4.5" width="8.5" height="8.5" rx="1.5"/><path d="M3 11.5V3h8.5"/></svg>',
  trash:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M3.5 4.5h9M6.5 4.5V3h3v1.5M4.5 4.5v8.5h7v-8.5"/><line x1="7" y1="7" x2="7" y2="11"/><line x1="9" y1="7" x2="9" y2="11"/></svg>',
};

function _formatSessionRelative(ts){
  const unix = Number(ts || 0);
  if(!unix) return '';
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - unix);
  if(diff < 45) return 'now';
  if(diff < 3600) return Math.floor(diff / 60) + 'm';
  if(diff < 86400) return Math.floor(diff / 3600) + 'h';
  if(diff < 604800) return Math.floor(diff / 86400) + 'd';
  return new Date(unix * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function _workspaceFolderInfo(session){
  const path = String(session.workspace || '').trim();
  if(session.project_id){
    const proj = _allProjects.find(p => p.project_id === session.project_id);
    if(proj){
      return { key:`project:${proj.project_id}`, label:proj.name, sublabel:path, icon:'project' };
    }
  }
  if(!path){
    return { key:'workspace:none', label:'No workspace', sublabel:'', icon:'folder' };
  }
  const parts = path.split('/').filter(Boolean);
  let label = parts[parts.length - 1] || path;
  if(label === 'workspace' && parts.length >= 2){
    label = parts[parts.length - 2] + ' workspace';
  } else if(label.startsWith('.') && parts.length >= 2){
    label = parts[parts.length - 2];
  }
  return { key:`workspace:${path}`, label, sublabel:path, icon:'folder' };
}

function _isServiceLikeSession(session){
  if(session.is_auxiliary_cli_session) return true;
  const title=String(session.title||'').trim().toLowerCase();
  return /^(diagnose|inspect|review|implement|analyze|analyse|investigate|audit|summarize|summarise|prepare|compare|explore|extract|identify|find|fix|draft)\b/.test(title);
}

function _sessionKindLabel(session){
  if(session.archived) return 'Archived';
  if(session.is_auxiliary_cli_session) return 'Helper';
  if(session.is_cli_session) return 'CLI';
  if(_isServiceLikeSession(session)) return 'Task';
  return 'Chat';
}

async function newSession(flash){
  if(typeof stopCliSessionAutoRefresh==='function') stopCliSessionAutoRefresh();
  MSG_QUEUE.length=0;updateQueueBadge();
  S.toolCalls=[];
  clearLiveToolCards();
  // Use profile default workspace for new sessions after a profile switch (one-shot),
  // otherwise inherit from the current session (or let server pick the default)
  const inheritWs=S._profileDefaultWorkspace||(S.session?S.session.workspace:null);
  S._profileDefaultWorkspace=null; // consume — only applies to the first new session after switch
  const data=await api('/api/session/new',{method:'POST',body:JSON.stringify({model:$('modelSelect').value,workspace:inheritWs})});
  S.session=data.session;S.messages=data.session.messages||[];
  if(flash)S.session._flash=true;
  localStorage.setItem('hermes-webui-session',S.session.session_id);
  syncTopbar();await loadDir('.');renderMessages({forceBottom:true});
  // don't call renderSessionList here - callers do it when needed
}

async function loadSession(sid){
  stopApprovalPolling();hideApprovalCard();
  const data=await api(`/api/session?session_id=${encodeURIComponent(sid)}`);
  S.session=data.session;
  if(S.session && S.session.is_cli_session && typeof startCliSessionAutoRefresh==='function') startCliSessionAutoRefresh();
  else if(typeof stopCliSessionAutoRefresh==='function') stopCliSessionAutoRefresh();
  localStorage.setItem('hermes-webui-session',S.session.session_id);
  // B9: sanitize empty assistant messages that can appear when agent only ran tool calls
  data.session.messages=(data.session.messages||[]).filter(m=>{
    if(!m||!m.role)return false;
    if(m.role==='tool')return false;
    if(m.role==='assistant'){let c=m.content||'';if(Array.isArray(c))c=c.filter(p=>p&&p.type==='text').map(p=>p.text||'').join('');return String(c).trim().length>0;}
    return true;
  });
  if(INFLIGHT[sid]){
    S.messages=INFLIGHT[sid].messages;
    // Restore live tool cards for this in-flight session
    clearLiveToolCards();
    for(const tc of (S.toolCalls||[])){
      if(tc&&tc.name) appendLiveToolCard(tc);
    }
    syncTopbar();await loadDir('.');renderMessages({forceBottom:true});appendThinking();
    setBusy(true);setStatus((window._botName||'Hermes')+' is thinking\u2026');
    startApprovalPolling(sid);
  }else{
    MSG_QUEUE.length=0;updateQueueBadge();  // clear queue for the viewed session
    S.messages=data.session.messages||[];
    S.toolCalls=(data.session.tool_calls||[]).map(tc=>({...tc,done:true}));
    // Reset per-session visual state: the viewed session is idle even if another
    // session's stream is still running in the background.
    // We directly update the DOM instead of calling setBusy(false), because
    // setBusy(false) drains MSG_QUEUE which we don't want here.
    S.busy=false;
    S.activeStreamId=null;
    $('btnSend').disabled=false;
    $('btnSend').style.opacity='1';
    const _dots=$('activityDots');if(_dots)_dots.style.display='none';
    const _cb=$('btnCancel');if(_cb)_cb.style.display='none';
    setStatus('');
    clearLiveToolCards();
    syncTopbar();await loadDir('.');renderMessages({forceBottom:true});highlightCode();
  }
}

let _allSessions = [];  // cached for search filter
let _renamingSid = null;  // session_id currently being renamed (blocks list re-renders)
let _showArchived = false;  // legacy toggle retained for backwards compatibility with archive quick toggle
let _allProjects = [];  // cached project list
let _activeProject = null;  // project_id filter (null = show all)
let _showAllProfiles = false;  // false = filter to active profile only
let _showAuxiliaryCli = false;  // false = hide auxiliary CLI task sessions by default
const _storedSessionVisibilityMode = localStorage.getItem('hermes-session-visibility-mode');
let _sessionVisibilityMode = _storedSessionVisibilityMode || 'all';
if(!_storedSessionVisibilityMode || _storedSessionVisibilityMode === 'active'){
  _sessionVisibilityMode = 'all';
  localStorage.setItem('hermes-session-visibility-mode', 'all');
}

async function renderSessionList(){
  try{
    if(!($('sessionSearch').value||'').trim()) _contentSearchResults = [];
    const [sessData, projData] = await Promise.all([
      api('/api/sessions?include_hidden_cli_clones=1'),
      api('/api/projects'),
    ]);
    _allSessions = sessData.sessions||[];
    _allProjects = projData.projects||[];
    renderSessionListFromCache();  // no-ops if rename is in progress
  }catch(e){console.warn('renderSessionList',e);}
}

let _searchDebounceTimer = null;
let _contentSearchResults = [];  // results from /api/sessions/search content scan

function filterSessions(){
  // Immediate client-side title filter (no flicker)
  renderSessionListFromCache();
  // Debounced content search via API for message text
  const q = ($('sessionSearch').value || '').trim();
  clearTimeout(_searchDebounceTimer);
  if (!q) { _contentSearchResults = []; return; }
  _searchDebounceTimer = setTimeout(async () => {
    try {
      const data = await api(`/api/sessions/search?q=${encodeURIComponent(q)}&content=1&depth=5`);
      const titleIds = new Set(_allSessions.filter(s => (s.title||'Untitled').toLowerCase().includes(q.toLowerCase())).map(s=>s.session_id));
      _contentSearchResults = (data.sessions||[]).filter(s => s.match_type === 'content' && !titleIds.has(s.session_id));
      renderSessionListFromCache();
    } catch(e) { /* ignore */ }
  }, 350);
}

function _isLegacySession(s){
  return Boolean(s.is_cli_session || s._cli_origin || s.is_auxiliary_cli_session);
}

function _applyVisibilityMode(sessions){
  switch(_sessionVisibilityMode){
    case 'archive':
      return sessions.filter(s=>s.archived);
    case 'legacy':
      return sessions.filter(s=>_isLegacySession(s));
    case 'all':
      return sessions;
    case 'active':
    default:
      return sessions.filter(s=>!s.archived && !_isLegacySession(s));
  }
}

function _renderSessionVisibilityControls(container, counts){
  const bar=$('sessionVisibilityBar');
  if(!bar) return;
  const modes=[
    {id:'active', label:`Active ${counts.active?`(${counts.active})`:''}`},
    {id:'archive', label:`Archive ${counts.archive?`(${counts.archive})`:''}`},
    {id:'legacy', label:`Legacy ${counts.legacy?`(${counts.legacy})`:''}`},
    {id:'all', label:`All ${counts.all?`(${counts.all})`:''}`},
  ];
  bar.innerHTML='';
  for(const mode of modes){
    const btn=document.createElement('button');
    btn.className='session-visibility-chip'+(_sessionVisibilityMode===mode.id?' active':'');
    btn.type='button';
    btn.textContent=mode.label;
    btn.onclick=()=>{
      _sessionVisibilityMode=mode.id;
      localStorage.setItem('hermes-session-visibility-mode', mode.id);
      renderSessionListFromCache();
    };
    bar.appendChild(btn);
  }
}

function renderSessionListFromCache(){
  // Don't re-render while user is actively renaming a session (would destroy the input)
  if(_renamingSid) return;
  const q=($('sessionSearch').value||'').toLowerCase();
  const titleMatches=q?_allSessions.filter(s=>(s.title||'Untitled').toLowerCase().includes(q)):_allSessions;
  // Merge content matches (deduped): content matches appended after title matches
  const titleIds=new Set(titleMatches.map(s=>s.session_id));
  const allMatched=q?[...titleMatches,..._contentSearchResults.filter(s=>!titleIds.has(s.session_id))]:titleMatches;
  // Filter by active profile (unless "All profiles" is toggled on)
  // Server backfills profile='default' for legacy sessions, so every session has a profile.
  // Show only sessions tagged to the active profile; 'All profiles' toggle overrides.
  const profileFiltered=_showAllProfiles?allMatched:allMatched.filter(s=>s.is_cli_session||s.profile===S.activeProfile);
  // Filter by active project
  const projectFiltered=_activeProject?profileFiltered.filter(s=>s.project_id===_activeProject):profileFiltered;
  const auxCount=projectFiltered.filter(s=>s.is_auxiliary_cli_session).length;
  const archivedCount=projectFiltered.filter(s=>s.archived).length;
  const legacyCount=projectFiltered.filter(s=>_isLegacySession(s)).length;
  const activeCount=projectFiltered.filter(s=>!s.archived && !_isLegacySession(s)).length;
  const visibilityBase=(_sessionVisibilityMode==='legacy' || _sessionVisibilityMode==='all')
    ? (_showAuxiliaryCli ? projectFiltered : projectFiltered.filter(s=>!s.is_auxiliary_cli_session || !_isLegacySession(s) || _sessionVisibilityMode==='all'))
    : (_showAuxiliaryCli ? projectFiltered : projectFiltered.filter(s=>!s.is_auxiliary_cli_session));
  const sessions=_applyVisibilityMode(visibilityBase);
  const list=$('sessionList');list.innerHTML='';
  _renderSessionVisibilityControls(list, {active:activeCount, archive:archivedCount, legacy:legacyCount, all:projectFiltered.length});
  // Project filter bar (only when projects exist)
  if(_allProjects.length>0){
    const bar=document.createElement('div');
    bar.className='project-bar';
    // "All" chip
    const allChip=document.createElement('span');
    allChip.className='project-chip'+(!_activeProject?' active':'');
    allChip.textContent='All';
    allChip.onclick=()=>{_activeProject=null;renderSessionListFromCache();};
    bar.appendChild(allChip);
    // Project chips
    for(const p of _allProjects){
      const chip=document.createElement('span');
      chip.className='project-chip'+(p.project_id===_activeProject?' active':'');
      if(p.color){
        const dot=document.createElement('span');
        dot.className='color-dot';
        dot.style.background=p.color;
        chip.appendChild(dot);
      }
      const nameSpan=document.createElement('span');
      nameSpan.textContent=p.name;
      chip.appendChild(nameSpan);
      chip.onclick=()=>{_activeProject=p.project_id;renderSessionListFromCache();};
      chip.ondblclick=(e)=>{e.stopPropagation();_startProjectRename(p,chip);};
      chip.oncontextmenu=(e)=>{e.preventDefault();_confirmDeleteProject(p);};
      bar.appendChild(chip);
    }
    // Create button
    const addBtn=document.createElement('button');
    addBtn.className='project-create-btn';
    addBtn.textContent='+';
    addBtn.title='New project';
    addBtn.onclick=(e)=>{e.stopPropagation();_startProjectCreate(bar,addBtn);};
    bar.appendChild(addBtn);
    list.appendChild(bar);
  }
  // Profile filter toggle (show sessions from other profiles)
  const otherProfileCount=allMatched.filter(s=>s.profile&&s.profile!==S.activeProfile).length;
  if(otherProfileCount>0&&!_showAllProfiles){
    const pfToggle=document.createElement('div');
    pfToggle.className='session-inline-toggle';
    pfToggle.textContent='Show '+otherProfileCount+' from other profiles';
    pfToggle.onclick=()=>{_showAllProfiles=true;renderSessionListFromCache();};
    list.appendChild(pfToggle);
  } else if(_showAllProfiles&&otherProfileCount>0){
    const pfToggle=document.createElement('div');
    pfToggle.className='session-inline-toggle';
    pfToggle.textContent='Show active profile only';
    pfToggle.onclick=()=>{_showAllProfiles=false;renderSessionListFromCache();};
    list.appendChild(pfToggle);
  }
  if(auxCount>0 && (_sessionVisibilityMode==='legacy' || _sessionVisibilityMode==='all')){
    const toggle=document.createElement('div');
    toggle.className='session-inline-toggle';
    toggle.textContent=_showAuxiliaryCli?'Hide auxiliary helpers':'Show '+auxCount+' auxiliary helpers';
    toggle.onclick=()=>{_showAuxiliaryCli=!_showAuxiliaryCli;renderSessionListFromCache();};
    list.appendChild(toggle);
  }
  // Empty state for active project filter
  if(_activeProject&&sessions.length===0){
    const empty=document.createElement('div');
    empty.style.cssText='padding:20px 14px;color:var(--muted);font-size:12px;text-align:center;opacity:.7;';
    empty.textContent='No sessions in this project yet.';
    list.appendChild(empty);
  }
  const pinned=sessions.filter(s=>s.pinned);
  const unpinned=sessions.filter(s=>!s.pinned);
  const now=Date.now();
  const ONE_DAY=86400000;
  let _groupCollapsed={};
  try{_groupCollapsed=JSON.parse(localStorage.getItem('hermes-date-groups-collapsed')||'{}');}catch(e){}
  const _saveCollapsed=()=>{try{localStorage.setItem('hermes-date-groups-collapsed',JSON.stringify(_groupCollapsed));}catch(e){}};
  const groups=[];
  let curLabel=null,curItems=[];
  if(pinned.length) groups.push({label:'★ Pinned',items:pinned,isPinned:true});
  for(const s of unpinned){
    const ts=(s.updated_at||s.created_at||0)*1000;
    const label=ts>now-ONE_DAY?'Today':ts>now-2*ONE_DAY?'Yesterday':'Earlier';
    if(label!==curLabel){
      if(curItems.length) groups.push({label:curLabel,items:curItems});
      curLabel=label;curItems=[s];
    } else {
      curItems.push(s);
    }
  }
  if(curItems.length) groups.push({label:curLabel,items:curItems});
  for(const g of groups){
    const wrapper=document.createElement('div');
    wrapper.className='session-date-group';
    const hdr=document.createElement('div');
    hdr.className='session-date-header'+(g.isPinned?' pinned':'');
    const caret=document.createElement('span');
    caret.className='session-date-caret';
    caret.textContent='▸';
    const label=document.createElement('span');
    label.textContent=g.label;
    const count=document.createElement('span');
    count.className='session-group-count';
    count.textContent=String(g.items.length);
    hdr.appendChild(caret);
    hdr.appendChild(label);
    hdr.appendChild(count);
    const body=document.createElement('div');
    body.className='session-date-body';
    if(_groupCollapsed[g.label]){
      body.style.display='none';
      caret.classList.add('collapsed');
    }
    hdr.onclick=()=>{
      const isCollapsed=body.style.display==='none';
      body.style.display=isCollapsed?'':'none';
      caret.classList.toggle('collapsed',!isCollapsed);
      _groupCollapsed[g.label]=!isCollapsed;
      _saveCollapsed();
    };
    wrapper.appendChild(hdr);
    for(const s of g.items) body.appendChild(_renderOneSession(s));
    wrapper.appendChild(body);
    list.appendChild(wrapper);
  }
  // ── Render session items (extracted for group body use) ──
  // Note: declared after the groups loop but available via function hoisting.
  function _renderOneSession(s){
    const el=document.createElement('div');
    const isActive=S.session&&s.session_id===S.session.session_id;
    el.className='session-item'+(isActive?' active':'')+(isActive&&S.session&&S.session._flash?' new-flash':'')+(s.archived?' archived':'')+(s.is_cli_session?' cli-session':'');
    if(isActive&&S.session&&S.session._flash)delete S.session._flash;
    const rawTitle=s.title||'Untitled';
    const tags=(rawTitle.match(/#[\w-]+/g)||[]);
    const cleanTitle=tags.length?rawTitle.replace(/#[\w-]+/g,'').trim():rawTitle;
    const outline=document.createElement('div');
    outline.className='session-outline';
    const titleRow=document.createElement('div');
    titleRow.className='session-title-row';
    const title=document.createElement('span');
    title.className='session-title';
    title.textContent=cleanTitle||'Untitled';
    title.title='Double-click to rename';
    // Append tag chips after the title text
    for(const tag of tags){
      const chip=document.createElement('span');
      chip.className='session-tag';
      chip.textContent=tag;
      chip.title='Click to filter by '+tag;
      chip.onclick=(e)=>{
        e.stopPropagation();
        const searchBox=$('sessionSearch');
        if(searchBox){searchBox.value=tag;filterSessions();}
      };
      title.appendChild(chip);
    }

    // Rename: called directly when we confirm it's a double-click
    const startRename=()=>{
      _renamingSid = s.session_id;
      const inp=document.createElement('input');
      inp.className='session-title-input';
      inp.value=s.title||'Untitled';
      ['click','mousedown','dblclick','pointerdown'].forEach(ev=>
        inp.addEventListener(ev, e2=>e2.stopPropagation())
      );
      const finish=async(save)=>{
        _renamingSid = null;
        if(save){
          const newTitle=inp.value.trim()||'Untitled';
          title.textContent=newTitle;
          s.title=newTitle;
          if(S.session&&S.session.session_id===s.session_id){S.session.title=newTitle;syncTopbar();}
          try{await api('/api/session/rename',{method:'POST',body:JSON.stringify({session_id:s.session_id,title:newTitle})});}
          catch(err){setStatus('Rename failed: '+err.message);}
        }
        inp.replaceWith(outline);
        // Allow list re-renders again after a short delay
        setTimeout(()=>{ if(_renamingSid===null) renderSessionListFromCache(); },50);
      };
      inp.onkeydown=e2=>{
        if(e2.key==='Enter'){e2.preventDefault();e2.stopPropagation();finish(true);}
        if(e2.key==='Escape'){e2.preventDefault();e2.stopPropagation();finish(false);}
      };
      // onblur: cancel only -- no accidental saves
      inp.onblur=()=>{ if(_renamingSid===s.session_id) finish(false); };
      outline.replaceWith(inp);
      setTimeout(()=>{inp.focus();inp.select();},10);
    };

    if(s.pinned){
      const pinInd=document.createElement('span');
      pinInd.className='session-pin-indicator';
      pinInd.innerHTML=ICONS.pin;
      titleRow.appendChild(pinInd);
    }
    if(s.project_id){
      const proj=_allProjects.find(p=>p.project_id===s.project_id);
      if(proj && !isActive) el.style.borderLeftColor=proj.color||'var(--blue)';
    }
    titleRow.appendChild(title);
    outline.appendChild(titleRow);
    const meta=document.createElement('div');
    meta.className='session-meta';
    const kind=document.createElement('span');
    kind.className='session-meta-chip kind';
    kind.textContent=_sessionKindLabel(s);
    meta.appendChild(kind);
    const rel=_formatSessionRelative(s.updated_at||s.created_at||0);
    if(rel){
      const updated=document.createElement('span');
      updated.className='session-meta-chip time';
      updated.textContent=rel;
      meta.appendChild(updated);
    }
    const wsInfo=_workspaceFolderInfo(s);
    if(wsInfo.label){
      const ws=document.createElement('span');
      ws.className='session-meta-chip workspace';
      if(wsInfo.icon==='project') ws.classList.add('project');
      ws.textContent=wsInfo.label;
      ws.title=wsInfo.sublabel||wsInfo.label;
      meta.appendChild(ws);
    }
    if(s.profile && _showAllProfiles){
      const profile=document.createElement('span');
      profile.className='session-meta-chip profile';
      profile.textContent=s.profile;
      meta.appendChild(profile);
    }
    if(meta.childNodes.length) outline.appendChild(meta);
    el.appendChild(outline);
    // Action buttons overlay (appears on hover with gradient fade)
    const actions=document.createElement('div');
    actions.className='session-actions';
    // Pin toggle
    const pinBtn=document.createElement('button');
    pinBtn.className='act-pin'+(s.pinned?' pinned':'');
    pinBtn.innerHTML=s.pinned?ICONS.pin:ICONS.unpin;
    pinBtn.title=s.pinned?'Unpin':'Pin to top';
    pinBtn.onclick=async(e)=>{
      e.stopPropagation();e.preventDefault();
      const newPinned=!s.pinned;
      try{
        await api('/api/session/pin',{method:'POST',body:JSON.stringify({session_id:s.session_id,pinned:newPinned})});
        s.pinned=newPinned;
        if(S.session&&S.session.session_id===s.session_id) S.session.pinned=newPinned;
        renderSessionList();
      }catch(err){showToast('Pin failed: '+err.message);}
    };
    actions.appendChild(pinBtn);
    // Move to project
    const move=document.createElement('button');
    move.className='act-move';move.innerHTML=ICONS.folder;move.title='Move to project';
    move.onclick=async(e)=>{e.stopPropagation();e.preventDefault();_showProjectPicker(s,move);};
    actions.appendChild(move);
    // Archive
    const archive=document.createElement('button');
    archive.className='act-archive';archive.innerHTML=s.archived?ICONS.unarchive:ICONS.archive;
    archive.title=s.archived?'Unarchive':'Archive';
    archive.onclick=async(e)=>{
      e.stopPropagation();e.preventDefault();
      try{
        await api('/api/session/archive',{method:'POST',body:JSON.stringify({session_id:s.session_id,archived:!s.archived})});
        s.archived=!s.archived;
        if(S.session&&S.session.session_id===s.session_id) S.session.archived=s.archived;
        await renderSessionList();
        showToast(s.archived?'Session archived':'Session restored');
      }catch(err){showToast('Archive failed: '+err.message);}
    };
    actions.appendChild(archive);
    // Duplicate
    const dup=document.createElement('button');
    dup.className='act-dup';dup.innerHTML=ICONS.dup;dup.title='Duplicate';
    dup.onclick=async(e)=>{
      e.stopPropagation();e.preventDefault();
      try{
        const res=await api('/api/session/new',{method:'POST',body:JSON.stringify({workspace:s.workspace,model:s.model})});
        if(res.session){
          await api('/api/session/rename',{method:'POST',body:JSON.stringify({session_id:res.session.session_id,title:(s.title||'Untitled')+' (copy)'})});
          await loadSession(res.session.session_id);await renderSessionList();
          showToast('Session duplicated');
        }
      }catch(err){showToast('Duplicate failed: '+err.message);}
    };
    actions.appendChild(dup);
    // Trash
    const trash=document.createElement('button');
    trash.className='act-trash';trash.innerHTML=ICONS.trash;trash.title='Delete';
    trash.onclick=async(e)=>{e.stopPropagation();e.preventDefault();await deleteSession(s.session_id);};
    actions.appendChild(trash);
    el.appendChild(actions);

    // Use a click timer to distinguish single-click (navigate) from double-click (rename).
    // This prevents loadSession from firing on the first click of a double-click,
    // which would re-render the list and destroy the dblclick target before it fires.
    let _clickTimer=null;
    el.onclick=async(e)=>{
      if(_renamingSid) return; // ignore while any rename is active
      if(actions.contains(e.target)) return;
      clearTimeout(_clickTimer);
      _clickTimer=setTimeout(async()=>{
        _clickTimer=null;
        if(_renamingSid) return;
        // For CLI sessions, import into WebUI store first (idempotent)
        if(s.is_cli_session){
          try{
            await api('/api/session/import_cli',{method:'POST',body:JSON.stringify({session_id:s.session_id})});
          }catch(e){ /* import failed -- fall through to read-only view */ }
        }
        await loadSession(s.session_id);renderSessionListFromCache();
        if(typeof closeMobileSidebar==='function')closeMobileSidebar();
      }, 220);
    };
    el.ondblclick=async(e)=>{
      e.stopPropagation();
      e.preventDefault();
      clearTimeout(_clickTimer); // cancel the pending single-click navigation
      _clickTimer=null;
      startRename();
    };
    return el;
  }
}

async function deleteSession(sid){
  if(!confirm('Delete this conversation?'))return;
  try{
    await api('/api/session/delete',{method:'POST',body:JSON.stringify({session_id:sid})});
  }catch(e){setStatus(`Delete failed: ${e.message}`);return;}
  if(S.session&&S.session.session_id===sid){
    if(typeof stopCliSessionAutoRefresh==='function') stopCliSessionAutoRefresh();
    S.session=null;S.messages=[];S.entries=[];
    localStorage.removeItem('hermes-webui-session');
    // load the most recent remaining session, or show blank if none left
    const remaining=await api('/api/sessions');
    if(remaining.sessions&&remaining.sessions.length){
      await loadSession(remaining.sessions[0].session_id);
    }else{
      $('topbarTitle').textContent=window._botName||'Hermes';
      $('topbarMeta').textContent='Start a new conversation';
      $('msgInner').innerHTML='';
      $('emptyState').style.display='';
      $('fileTree').innerHTML='';
    }
  }
  showToast('Conversation deleted');
  await renderSessionList();
}

// ── Project helpers ─────────────────────────────────────────────────────

const PROJECT_COLORS=['#7cb9ff','#f5c542','#e94560','#50c878','#c084fc','#fb923c','#67e8f9','#f472b6'];

function _showProjectPicker(session, anchorEl){
  // Close any existing picker
  document.querySelectorAll('.project-picker').forEach(p=>p.remove());
  const picker=document.createElement('div');
  picker.className='project-picker';
  // "No project" option
  const none=document.createElement('div');
  none.className='project-picker-item'+(!session.project_id?' active':'');
  none.textContent='No project';
  none.onclick=async()=>{
    picker.remove();
    document.removeEventListener('click',close);
    await api('/api/session/move',{method:'POST',body:JSON.stringify({session_id:session.session_id,project_id:null})});
    session.project_id=null;
    renderSessionListFromCache();
    showToast('Removed from project');
  };
  picker.appendChild(none);
  // Project options
  for(const p of _allProjects){
    const item=document.createElement('div');
    item.className='project-picker-item'+(session.project_id===p.project_id?' active':'');
    if(p.color){
      const dot=document.createElement('span');
      dot.className='color-dot';
      dot.style.cssText='width:6px;height:6px;border-radius:50%;background:'+p.color+';flex-shrink:0;';
      item.appendChild(dot);
    }
    const name=document.createElement('span');
    name.textContent=p.name;
    item.appendChild(name);
    item.onclick=async()=>{
      picker.remove();
      document.removeEventListener('click',close);
      await api('/api/session/move',{method:'POST',body:JSON.stringify({session_id:session.session_id,project_id:p.project_id})});
      session.project_id=p.project_id;
      renderSessionListFromCache();
      showToast('Moved to '+p.name);
    };
    picker.appendChild(item);
  }
  // "+ New project" shortcut at the bottom
  const createItem=document.createElement('div');
  createItem.className='project-picker-item project-picker-create';
  createItem.textContent='+ New project';
  createItem.onclick=async()=>{
    picker.remove();
    document.removeEventListener('click',close);
    // Prompt for name inline
    const name=prompt('Project name:');
    if(!name||!name.trim()) return;
    const color=PROJECT_COLORS[_allProjects.length%PROJECT_COLORS.length];
    const res=await api('/api/projects/create',{method:'POST',body:JSON.stringify({name:name.trim(),color})});
    if(res.project){
      _allProjects.push(res.project);
      // Now move session into it
      await api('/api/session/move',{method:'POST',body:JSON.stringify({session_id:session.session_id,project_id:res.project.project_id})});
      session.project_id=res.project.project_id;
      await renderSessionList();
      showToast('Created "'+res.project.name+'" and moved session');
    }
  };
  picker.appendChild(createItem);
  // Append to body and position using getBoundingClientRect so it isn't clipped
  // by overflow:hidden on .session-item ancestors
  document.body.appendChild(picker);
  const rect=anchorEl.getBoundingClientRect();
  picker.style.position='fixed';
  picker.style.zIndex='999';
  // Prefer opening below; flip above if too close to bottom of viewport
  const spaceBelow=window.innerHeight-rect.bottom;
  if(spaceBelow<160&&rect.top>160){
    picker.style.bottom=(window.innerHeight-rect.top+4)+'px';
    picker.style.top='auto';
  }else{
    picker.style.top=(rect.bottom+4)+'px';
    picker.style.bottom='auto';
  }
  // Align right edge of picker with right edge of button; keep within viewport
  const pickerW=Math.min(220,Math.max(160,picker.scrollWidth||160));
  let left=rect.right-pickerW;
  if(left<8) left=8;
  picker.style.left=left+'px';
  // Close on outside click
  const close=(e)=>{if(!picker.contains(e.target)&&e.target!==anchorEl){picker.remove();document.removeEventListener('click',close);}};
  setTimeout(()=>document.addEventListener('click',close),0);
}

function _startProjectCreate(bar, addBtn){
  const inp=document.createElement('input');
  inp.className='project-create-input';
  inp.placeholder='Project name';
  const finish=async(save)=>{
    if(save&&inp.value.trim()){
      const color=PROJECT_COLORS[_allProjects.length%PROJECT_COLORS.length];
      await api('/api/projects/create',{method:'POST',body:JSON.stringify({name:inp.value.trim(),color})});
      await renderSessionList();
      showToast('Project created');
    }else{
      inp.replaceWith(addBtn);
    }
  };
  inp.onkeydown=(e)=>{
    if(e.key==='Enter'){e.preventDefault();finish(true);}
    if(e.key==='Escape'){e.preventDefault();finish(false);}
  };
  inp.onblur=()=>finish(false);
  addBtn.replaceWith(inp);
  setTimeout(()=>inp.focus(),10);
}

function _startProjectRename(proj, chip){
  const inp=document.createElement('input');
  inp.className='project-create-input';
  inp.value=proj.name;
  const finish=async(save)=>{
    if(save&&inp.value.trim()&&inp.value.trim()!==proj.name){
      await api('/api/projects/rename',{method:'POST',body:JSON.stringify({project_id:proj.project_id,name:inp.value.trim()})});
      await renderSessionList();
      showToast('Project renamed');
    }else{
      renderSessionListFromCache();
    }
  };
  inp.onkeydown=(e)=>{
    if(e.key==='Enter'){e.preventDefault();finish(true);}
    if(e.key==='Escape'){e.preventDefault();finish(false);}
  };
  inp.onblur=()=>finish(false);
  inp.onclick=(e)=>e.stopPropagation();
  chip.replaceWith(inp);
  setTimeout(()=>{inp.focus();inp.select();},10);
}

async function _confirmDeleteProject(proj){
  if(!confirm('Delete project "'+proj.name+'"? Sessions will be unassigned but not deleted.')){return;}
  await api('/api/projects/delete',{method:'POST',body:JSON.stringify({project_id:proj.project_id})});
  if(_activeProject===proj.project_id) _activeProject=null;
  await renderSessionList();
  showToast('Project deleted');
}
