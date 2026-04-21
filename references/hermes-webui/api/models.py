"""
Hermes Web UI -- Session model and in-memory session store.
"""
import datetime as _dt
import json
import os
import time
import uuid
from pathlib import Path

import api.config as _cfg
from api.config import (
    SESSION_DIR, SESSION_INDEX_FILE, SESSIONS, SESSIONS_MAX,
    LOCK, DEFAULT_WORKSPACE, DEFAULT_MODEL, PROJECTS_FILE, HOME
)
from api.workspace import get_last_workspace


_CLI_GENERATED_PROMPT_PREFIXES = (
    'review the conversation above and consider saving or updating a skill',
    '[your active task list was preserved across context compression]',
)

_CLI_AUXILIARY_TITLE_PREFIXES = (
    'inspect ',
    'review ',
    'implement ',
    'analyze ',
    'investigate ',
    'audit ',
    'summarize ',
    'prepare ',
    'compare ',
    'explore ',
    'extract ',
    'identify ',
    'find ',
    'fix ',
    'draft ',
)


def _write_session_index():
    """Rebuild the session index file for O(1) future reads."""
    entries = []
    for p in SESSION_DIR.glob('*.json'):
        if p.name.startswith('_'): continue
        try:
            s = Session.load(p.stem)
            if s: entries.append(s.compact())
        except Exception:
            pass
    with LOCK:
        for s in SESSIONS.values():
            if not any(e['session_id'] == s.session_id for e in entries):
                entries.append(s.compact())
    entries.sort(key=lambda s: s['updated_at'], reverse=True)
    SESSION_INDEX_FILE.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding='utf-8')


class Session:
    def __init__(self, session_id: str=None, title: str='Untitled',
                 workspace=str(DEFAULT_WORKSPACE), model=DEFAULT_MODEL,
                 messages=None, created_at=None, updated_at=None,
                 tool_calls=None, pinned: bool=False, archived: bool=False,
                 project_id: str=None, profile=None,
                 input_tokens: int=0, output_tokens: int=0, estimated_cost=None,
                 personality=None,
                 **kwargs):
        self.session_id = session_id or uuid.uuid4().hex[:12]
        self.title = title
        self.workspace = str(Path(workspace).expanduser().resolve())
        self.model = model
        self.messages = messages or []
        self.tool_calls = tool_calls or []
        self.created_at = created_at or time.time()
        self.updated_at = updated_at or time.time()
        self.pinned = bool(pinned)
        self.archived = bool(archived)
        self.project_id = project_id or None
        self.profile = profile
        self.input_tokens = input_tokens or 0
        self.output_tokens = output_tokens or 0
        self.estimated_cost = estimated_cost
        self.personality = personality

    @property
    def path(self):
        return SESSION_DIR / f'{self.session_id}.json'

    def save(self) -> None:
        self.updated_at = time.time()
        self.path.write_text(
            json.dumps(self.__dict__, ensure_ascii=False, indent=2),
            encoding='utf-8',
        )
        _write_session_index()

    @classmethod
    def load(cls, sid):
        p = SESSION_DIR / f'{sid}.json'
        if not p.exists():
            return None
        return cls(**json.loads(p.read_text(encoding='utf-8')))

    def compact(self) -> dict:
        out = {
            'session_id': self.session_id,
            'title': self.title,
            'workspace': self.workspace,
            'model': self.model,
            'message_count': len(self.messages),
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'pinned': self.pinned,
            'archived': self.archived,
            'project_id': self.project_id,
            'profile': self.profile,
            'input_tokens': self.input_tokens,
            'output_tokens': self.output_tokens,
            'estimated_cost': self.estimated_cost,
            'personality': self.personality,
        }
        if getattr(self, 'is_cli_session', False) or getattr(self, '_cli_origin', None):
            out['is_cli_session'] = True
        return out

def get_session(sid):
    with LOCK:
        if sid in SESSIONS:
            SESSIONS.move_to_end(sid)  # LRU: mark as recently used
            return SESSIONS[sid]
    s = Session.load(sid)
    if s:
        with LOCK:
            SESSIONS[sid] = s
            SESSIONS.move_to_end(sid)
            while len(SESSIONS) > SESSIONS_MAX:
                SESSIONS.popitem(last=False)  # evict least recently used
        return s
    raise KeyError(sid)

def new_session(workspace=None, model=None):
    # Use _cfg.DEFAULT_MODEL (not the import-time snapshot) so save_settings() changes take effect
    try:
        from api.profiles import get_active_profile_name
        _profile = get_active_profile_name()
    except ImportError:
        _profile = None
    s = Session(workspace=workspace or get_last_workspace(), model=model or _cfg.DEFAULT_MODEL, profile=_profile)
    with LOCK:
        SESSIONS[s.session_id] = s
        SESSIONS.move_to_end(s.session_id)
        while len(SESSIONS) > SESSIONS_MAX:
            SESSIONS.popitem(last=False)
    s.save()
    return s

def all_sessions():
    # Phase C: try index first for O(1) read; fall back to full scan
    if SESSION_INDEX_FILE.exists():
        try:
            index = json.loads(SESSION_INDEX_FILE.read_text(encoding='utf-8'))
            # Overlay any in-memory sessions that may be newer than the index
            index_map = {s['session_id']: s for s in index}
            with LOCK:
                for s in SESSIONS.values():
                    index_map[s.session_id] = s.compact()
            result = sorted(index_map.values(), key=lambda s: (s.get('pinned', False), s['updated_at']), reverse=True)
            # Hide empty Untitled sessions from the UI (created by tests, page refreshes, etc.)
            result = [s for s in result if not (s.get('title','Untitled')=='Untitled' and s.get('message_count',0)==0)]
            # Backfill: sessions created before Sprint 22 have no profile tag.
            # Attribute them to 'default' so the client profile filter works correctly.
            for s in result:
                if not s.get('profile'):
                    s['profile'] = 'default'
            return result
        except Exception:
            pass  # fall through to full scan
    # Full scan fallback
    out = []
    for p in SESSION_DIR.glob('*.json'):
        if p.name.startswith('_'): continue
        try:
            s = Session.load(p.stem)
            if s: out.append(s)
        except Exception:
            pass
    for s in SESSIONS.values():
        if all(s.session_id != x.session_id for x in out): out.append(s)
    out.sort(key=lambda s: (getattr(s, 'pinned', False), s.updated_at), reverse=True)
    result = [s.compact() for s in out if not (s.title=='Untitled' and len(s.messages)==0)]
    for s in result:
        if not s.get('profile'):
            s['profile'] = 'default'
    return result


def title_from(messages, fallback: str='Untitled'):
    """Derive a session title from the first user message."""
    for m in messages:
        if m.get('role') == 'user':
            c = m.get('content', '')
            if isinstance(c, list):
                c = ' '.join(p.get('text', '') for p in c if isinstance(p, dict) and p.get('type') == 'text')
            text = str(c).strip()
            if text:
                return text[:64]
    return fallback


# ── Project helpers ──────────────────────────────────────────────────────────

def load_projects() -> list:
    """Load project list from disk. Returns list of project dicts."""
    if not PROJECTS_FILE.exists():
        return []
    try:
        return json.loads(PROJECTS_FILE.read_text(encoding='utf-8'))
    except Exception:
        return []

def save_projects(projects) -> None:
    """Write project list to disk."""
    PROJECTS_FILE.write_text(json.dumps(projects, ensure_ascii=False, indent=2), encoding='utf-8')


def import_cli_session(
    session_id: str,
    title: str,
    messages,
    model: str='unknown',
    profile=None,
    workspace=None,
    created_at=None,
    updated_at=None,
):
    """Create a new WebUI session populated with CLI messages.
    Returns the Session object.
    """
    s = Session(
        session_id=session_id,
        title=title,
        workspace=workspace or get_last_workspace(),
        model=model,
        messages=messages,
        profile=profile,
        created_at=created_at,
        updated_at=updated_at,
    )
    s.save()
    return s


# ── CLI session bridge ──────────────────────────────────────────────────────

def _get_active_cli_home() -> Path:
    """Return the active Hermes home for CLI session bridge operations."""
    try:
        from api.profiles import get_active_hermes_home
        return Path(get_active_hermes_home()).expanduser().resolve()
    except Exception:
        return Path(os.getenv('HERMES_HOME', str(HOME / '.hermes'))).expanduser().resolve()


def _get_active_cli_profile():
    try:
        from api.profiles import get_active_profile_name
        return get_active_profile_name()
    except ImportError:
        return None


def _parse_cli_timestamp(value, fallback: float=0) -> float:
    """Normalize CLI timestamp values from SQLite or JSON session files."""
    if value is None or value == '':
        return fallback
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return fallback
        try:
            return float(raw)
        except ValueError:
            try:
                return _dt.datetime.fromisoformat(raw.replace('Z', '+00:00')).timestamp()
            except ValueError:
                return fallback
    return fallback


def _get_cli_json_session_path(hermes_home: Path, sid: str) -> Path:
    return hermes_home / 'sessions' / f'session_{sid}.json'


def _normalize_cli_text(value) -> str:
    if isinstance(value, list):
        parts = []
        for part in value:
            if isinstance(part, dict) and part.get('type') == 'text':
                parts.append(str(part.get('text') or ''))
        value = ' '.join(parts)
    return ' '.join(str(value or '').split()).strip()


def _is_cli_generated_prompt(text: str) -> bool:
    normalized = _normalize_cli_text(text).lower()
    return any(normalized.startswith(prefix) for prefix in _CLI_GENERATED_PROMPT_PREFIXES)


def _extract_cli_clone_metadata(messages) -> dict:
    user_messages = []
    generated_count = 0
    for msg in messages or []:
        if not isinstance(msg, dict) or msg.get('role') != 'user':
            continue
        normalized = _normalize_cli_text(msg.get('content', ''))
        if normalized:
            user_messages.append(normalized)
            if _is_cli_generated_prompt(normalized):
                generated_count += 1
    if not user_messages:
        return {}

    non_generated_users = [msg for msg in user_messages if not _is_cli_generated_prompt(msg)]
    clone_sequence = non_generated_users or user_messages
    first_user = clone_sequence[0]
    is_auxiliary = (
        len(non_generated_users) == 1
        and len(first_user) >= 24
        and first_user[:1].isascii()
        and first_user[:1].isalpha()
        and any(first_user.lower().startswith(prefix) for prefix in _CLI_AUXILIARY_TITLE_PREFIXES)
    )
    return {
        '_cli_first_user': first_user,
        '_cli_last_user': user_messages[-1],
        '_cli_generated_tail': _is_cli_generated_prompt(user_messages[-1]),
        '_cli_has_generated_markers': generated_count > 0,
        '_cli_generated_user_count': generated_count,
        '_cli_non_service_user_count': len(non_generated_users),
        '_cli_non_service_users': clone_sequence,
        'is_auxiliary_cli_session': is_auxiliary,
    }


def _read_cli_json_session(path: Path):
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return None
    return data if isinstance(data, dict) else None


def _session_title_from_cli_json(data: dict) -> str:
    title = str(data.get('title') or '').strip()
    if title:
        return title
    return title_from(data.get('messages') or [], 'CLI Session')


def _get_cli_sessions_from_state_db(hermes_home: Path, profile=None) -> list:
    try:
        import sqlite3
    except ImportError:
        return []

    db_path = hermes_home / 'state.db'
    if not db_path.exists():
        return []

    cli_sessions = []
    try:
        with sqlite3.connect(str(db_path)) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute("""
                SELECT s.id, s.title, s.model, s.message_count,
                       s.started_at, s.source,
                       MAX(m.timestamp) AS last_activity
                FROM sessions s
                LEFT JOIN messages m ON m.session_id = s.id
                GROUP BY s.id
                ORDER BY COALESCE(MAX(m.timestamp), s.started_at) DESC
                LIMIT 200
            """)
            for row in cur.fetchall():
                sid = row['id']
                raw_ts = row['last_activity'] or row['started_at']
                cli_sessions.append({
                    'session_id': sid,
                    'title': row['title'] or 'CLI Session',
                    'workspace': str(get_last_workspace()),
                    'model': row['model'] or 'unknown',
                    'message_count': row['message_count'] or 0,
                    'created_at': row['started_at'],
                    'updated_at': raw_ts,
                    'pinned': False,
                    'archived': False,
                    'project_id': None,
                    'profile': profile,
                    'source_tag': row['source'] or 'cli',
                    'is_cli_session': True,
                })
    except Exception:
        return []
    return cli_sessions


def _get_cli_sessions_from_json_files(hermes_home: Path, profile=None) -> list:
    sessions_dir = hermes_home / 'sessions'
    if not sessions_dir.exists():
        return []

    cli_sessions = []
    for path in sessions_dir.glob('session_*.json'):
        data = _read_cli_json_session(path)
        if not data:
            continue

        sid = str(data.get('session_id') or path.stem.removeprefix('session_'))
        messages = data.get('messages') or []
        created_at = _parse_cli_timestamp(data.get('session_start'))
        updated_at = _parse_cli_timestamp(data.get('last_updated'), created_at)
        cli_sessions.append({
            'session_id': sid,
            'title': _session_title_from_cli_json(data),
            'workspace': str(get_last_workspace()),
            'model': data.get('model') or 'unknown',
            'message_count': data.get('message_count') or len(messages),
            'created_at': created_at,
            'updated_at': updated_at,
            'pinned': False,
            'archived': False,
            'project_id': None,
            'profile': profile,
            'source_tag': data.get('platform') or data.get('source') or 'cli',
            'is_cli_session': True,
        } | _extract_cli_clone_metadata(messages))

    cli_sessions.sort(key=lambda s: s.get('updated_at', 0) or 0, reverse=True)
    return cli_sessions

def get_cli_sessions() -> list:
    """Read CLI sessions from state.db or JSON transcripts and return sidebar-ready dicts."""
    hermes_home = _get_active_cli_home()
    cli_profile = _get_active_cli_profile()

    combined_map = {}
    for source in (_get_cli_sessions_from_state_db(hermes_home, cli_profile),
                   _get_cli_sessions_from_json_files(hermes_home, cli_profile)):
        for sess in source:
            sid = sess.get('session_id')
            if not sid:
                continue
            if sid not in combined_map:
                combined_map[sid] = dict(sess)
                continue

            existing = combined_map[sid]
            if existing.get('title') in ('', 'CLI Session') and sess.get('title') not in ('', 'CLI Session'):
                existing['title'] = sess['title']
            if existing.get('model') in ('', 'unknown', None) and sess.get('model') not in ('', 'unknown', None):
                existing['model'] = sess['model']
            if (sess.get('message_count') or 0) > (existing.get('message_count') or 0):
                existing['message_count'] = sess['message_count']
            if (sess.get('created_at') or 0) and not existing.get('created_at'):
                existing['created_at'] = sess['created_at']
            if (sess.get('updated_at') or 0) > (existing.get('updated_at') or 0):
                existing['updated_at'] = sess['updated_at']
            if not existing.get('source_tag') and sess.get('source_tag'):
                existing['source_tag'] = sess['source_tag']
            for key in (
                '_cli_first_user',
                '_cli_last_user',
                '_cli_generated_tail',
                '_cli_has_generated_markers',
                '_cli_generated_user_count',
                '_cli_non_service_user_count',
                '_cli_non_service_users',
                'is_auxiliary_cli_session',
            ):
                if key in sess and key not in existing:
                    existing[key] = sess[key]

    combined = list(combined_map.values())
    combined.sort(key=lambda s: s.get('updated_at', 0) or 0, reverse=True)
    return combined


def _cli_clone_rank(sess: dict):
    return (
        0 if sess.get('_cli_generated_tail') else 1,
        sess.get('_cli_non_service_user_count', 0) or 0,
        sess.get('updated_at', 0) or 0,
        sess.get('message_count', 0) or 0,
        sess.get('created_at', 0) or 0,
    )


def _is_cli_prefix_clone(candidate: dict, anchor: dict) -> bool:
    candidate_seq = candidate.get('_cli_non_service_users') or []
    anchor_seq = anchor.get('_cli_non_service_users') or []
    if not candidate_seq or len(anchor_seq) < len(candidate_seq):
        return False
    return anchor_seq[:len(candidate_seq)] == candidate_seq


def collapse_cli_session_clones(sessions) -> tuple[list, int, dict]:
    """Hide CLI transcript clones and resolve hidden family members to a canonical session."""
    cli_candidates = [
        sess for sess in sessions
        if sess.get('is_cli_session') and sess.get('_cli_non_service_users')
    ]
    if len(cli_candidates) < 2:
        visible = [dict(sess) for sess in sessions]
        for sess in visible:
            for key in (
                '_cli_first_user',
                '_cli_last_user',
                '_cli_generated_tail',
                '_cli_has_generated_markers',
                '_cli_generated_user_count',
                '_cli_non_service_user_count',
                '_cli_non_service_users',
            ):
                sess.pop(key, None)
        return visible, 0, {}

    hidden_ids = set()
    alias_map = {}

    grouped = {}
    for sess in cli_candidates:
        if sess.get('session_id') in hidden_ids:
            continue
        first_user = sess.get('_cli_first_user')
        if not first_user:
            continue
        grouped.setdefault(first_user, []).append(sess)

    for first_user, group in grouped.items():
        if len(group) < 2:
            continue
        if not any(sess.get('_cli_has_generated_markers') for sess in group):
            continue
        canonical = max(
            group,
            key=lambda sess: (
                0 if sess.get('_cli_generated_tail') else 1,
                sess.get('updated_at', 0) or 0,
                sess.get('_cli_non_service_user_count', 0) or 0,
                sess.get('message_count', 0) or 0,
                sess.get('created_at', 0) or 0,
            ),
        )
        for sess in group:
            if sess.get('session_id') != canonical.get('session_id'):
                hidden_ids.add(sess['session_id'])
                alias_map[sess['session_id']] = canonical['session_id']

    visible = [dict(sess) for sess in sessions if sess.get('session_id') not in hidden_ids]
    for sess in visible:
        for key in (
            '_cli_first_user',
            '_cli_last_user',
            '_cli_generated_tail',
            '_cli_has_generated_markers',
            '_cli_generated_user_count',
            '_cli_non_service_user_count',
            '_cli_non_service_users',
        ):
            sess.pop(key, None)
    return visible, len(hidden_ids), alias_map


def resolve_cli_canonical_session_id(sid: str, sessions=None) -> str:
    cli_sessions = sessions if sessions is not None else get_cli_sessions()
    _, _, alias_map = collapse_cli_session_clones(cli_sessions)
    return alias_map.get(sid, sid)


def get_cli_session_messages(sid) -> list:
    """Read messages for a single CLI session from SQLite or JSON transcripts."""
    hermes_home = _get_active_cli_home()

    json_path = _get_cli_json_session_path(hermes_home, sid)
    data = _read_cli_json_session(json_path) if json_path.exists() else None
    if data:
        out = []
        for msg in data.get('messages') or []:
            if not isinstance(msg, dict) or not msg.get('role'):
                continue
            normalized = {
                'role': msg.get('role'),
                'content': msg.get('content', ''),
            }
            if msg.get('timestamp') is not None:
                normalized['timestamp'] = msg.get('timestamp')
            elif msg.get('_ts') is not None:
                normalized['timestamp'] = msg.get('_ts')
            out.append(normalized)
        if out:
            return out

    try:
        import sqlite3
    except ImportError:
        sqlite3 = None

    db_path = hermes_home / 'state.db'
    if sqlite3 is not None and db_path.exists():
        try:
            with sqlite3.connect(str(db_path)) as conn:
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                cur.execute("""
                    SELECT role, content, timestamp
                    FROM messages
                    WHERE session_id = ?
                    ORDER BY timestamp ASC
                """, (sid,))
                msgs = []
                for row in cur.fetchall():
                    msgs.append({
                        'role': row['role'],
                        'content': row['content'],
                        'timestamp': row['timestamp'],
                    })
                if msgs:
                    return msgs
        except Exception:
            pass

    return []


def delete_cli_session(sid) -> bool:
    """Delete a CLI session from state.db and/or JSON transcripts."""
    hermes_home = _get_active_cli_home()
    deleted = False

    try:
        import sqlite3
    except ImportError:
        sqlite3 = None

    db_path = hermes_home / 'state.db'
    if sqlite3 is not None and db_path.exists():
        try:
            with sqlite3.connect(str(db_path)) as conn:
                cur = conn.cursor()
                cur.execute("DELETE FROM messages WHERE session_id = ?", (sid,))
                cur.execute("DELETE FROM sessions WHERE id = ?", (sid,))
                conn.commit()
                deleted = deleted or (cur.rowcount > 0)
        except Exception:
            pass

    json_path = _get_cli_json_session_path(hermes_home, sid)
    if json_path.exists():
        try:
            json_path.unlink()
            deleted = True
        except Exception:
            pass

    return deleted
