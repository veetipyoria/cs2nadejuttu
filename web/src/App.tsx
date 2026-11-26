import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { mapTileBackground } from './mapImages'
import type { CsMap, Lineup, Side, ThrowType, User, UtilityType } from './types'
import { THROWS, UTILITY_META } from './types'
import { AuthModal } from './components/AuthModal'
import { LineupCard } from './components/LineupCard'
import { LineupModal } from './components/LineupModal'
import { Radar } from './components/Radar'
import { Logo, UtilityIcon } from './components/UtilityIcon'
import './App.css'

const SAVED_KEY = 'nadedeck:saved'

function loadLocalSaved(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

function withToggled(set: Set<string>, id: string, on: boolean): Set<string> {
  const next = new Set(set)
  if (on) next.add(id)
  else next.delete(id)
  return next
}

function App() {
  // Data from the API
  const [maps, setMaps] = useState<CsMap[]>([])
  const [lineups, setLineups] = useState<Lineup[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')

  // Account + deck
  const [user, setUser] = useState<User | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [saved, setSaved] = useState<Set<string>>(loadLocalSaved)
  const [toast, setToast] = useState<string | null>(null)

  // Filters + UI
  const [mapId, setMapId] = useState<string>('mirage')
  const [types, setTypes] = useState<Set<UtilityType>>(new Set())
  const [side, setSide] = useState<Side | 'all'>('all')
  const [throwType, setThrowType] = useState<ThrowType | 'all'>('all')
  const [query, setQuery] = useState('')
  const [savedOnly, setSavedOnly] = useState(false)
  const [open, setOpen] = useState<Lineup | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [m, l] = await Promise.all([api.maps(), api.lineups()])
      setMaps(m)
      setLineups(l)
      setLoadState('ready')
    } catch {
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Restore an existing session
  useEffect(() => {
    api
      .me()
      .then(async (u) => {
        if (!u) return
        const ids = await api.saved()
        setUser(u)
        setSaved(new Set(ids))
      })
      .catch(() => {
        /* API offline — stay anonymous */
      })
  }, [])

  // Anonymous decks live in localStorage; signed-in decks live on the server.
  useEffect(() => {
    if (user) return
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify([...saved]))
    } catch {
      /* storage unavailable */
    }
  }, [saved, user])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  // Deep links: #lineup-id opens that lineup
  useEffect(() => {
    const fromHash = () => {
      const id = decodeURIComponent(location.hash.slice(1))
      const found = lineups.find((l) => l.id === id)
      if (found) {
        setMapId(found.map)
        setOpen(found)
      }
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [lineups])

  const openLineup = (l: Lineup) => {
    setOpen(l)
    history.replaceState(null, '', `#${l.id}`)
  }
  const closeLineup = useCallback(() => {
    setOpen(null)
    history.replaceState(null, '', location.pathname + location.search)
  }, [])

  const toggleSave = (id: string) => {
    const on = !saved.has(id)
    setSaved((prev) => withToggled(prev, id, on))
    if (user) {
      ;(on ? api.save(id) : api.unsave(id)).catch(() => {
        setSaved((prev) => withToggled(prev, id, !on))
        setToast('Could not update your deck — try again.')
      })
    }
  }

  const onAuthed = async (u: User) => {
    // Move whatever was saved anonymously into the account.
    const ids = await api.mergeSaved([...saved])
    try {
      localStorage.removeItem(SAVED_KEY)
    } catch {
      /* ignore */
    }
    setUser(u)
    setSaved(new Set(ids))
    setAuthOpen(false)
    setToast(`Signed in as ${u.username}`)
  }

  const signOut = async () => {
    try {
      await api.logout()
    } finally {
      setUser(null)
      setSaved(new Set())
      setToast('Signed out')
    }
  }

  const toggleType = (t: UtilityType) =>
    setTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return lineups.filter(
      (l) =>
        (mapId === 'all' || l.map === mapId) &&
        (types.size === 0 || types.has(l.type)) &&
        (side === 'all' || l.side === side) &&
        (throwType === 'all' || l.throw === throwType) &&
        (!savedOnly || saved.has(l.id)) &&
        (!q || `${l.title} ${l.from} ${l.to} ${l.map}`.toLowerCase().includes(q)),
    )
  }, [lineups, mapId, types, side, throwType, query, savedOnly, saved])

  const mapById = useMemo(() => new Map(maps.map((m) => [m.id, m])), [maps])
  const activeMap = mapById.get(mapId)
  const filtersActive = types.size > 0 || side !== 'all' || throwType !== 'all' || savedOnly || query !== ''
  const resetFilters = () => {
    setTypes(new Set())
    setSide('all')
    setThrowType('all')
    setSavedOnly(false)
    setQuery('')
  }

  return (
    <>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <a href="#" className="brand" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            <Logo />
            <span>Nade<b>Deck</b></span>
          </a>
          <nav className="nav">
            <a href="#maps-section">Maps</a>
            <a href="#browse">Lineups</a>
            <button
              className={`nav-saved${savedOnly ? ' on' : ''}`}
              onClick={() => {
                setSavedOnly((v) => !v)
                document.getElementById('browse')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              My deck <span className="badge">{saved.size}</span>
            </button>
            {user ? (
              <div className="account">
                <span className="avatar" aria-hidden="true">{user.username[0]!.toUpperCase()}</span>
                <span className="account-name">{user.username}</span>
                <button className="link-btn" onClick={signOut}>Sign out</button>
              </div>
            ) : (
              <button className="btn btn-small" onClick={() => setAuthOpen(true)}>Sign in</button>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="wrap hero-inner">
            <p className="eyebrow">CS2 utility, organised</p>
            <h1>
              Every lineup.<br />
              <span className="accent">One deck.</span>
            </h1>
            <p className="lede">
              Smokes, flashes, molotovs and HEs for every map in the Active Duty pool. Find a lineup,
              see exactly where to stand and aim, and save it to your deck for later.
            </p>
            <div className="hero-cta">
              <a className="btn btn-primary" href="#browse">Browse lineups</a>
              <a className="btn btn-ghost" href="#maps-section">Pick a map</a>
            </div>
            <dl className="hero-stats">
              <div><dt>{loadState === 'ready' ? lineups.length : '–'}</dt><dd>Lineups</dd></div>
              <div><dt>{loadState === 'ready' ? maps.length : '–'}</dt><dd>Maps</dd></div>
              <div><dt>4</dt><dd>Utility types</dd></div>
            </dl>
          </div>
          <div className="hero-grenades" aria-hidden="true">
            {(Object.keys(UTILITY_META) as UtilityType[]).map((t) => (
              <span key={t} className={`hg hg-${t}`}><UtilityIcon type={t} size={30} /></span>
            ))}
          </div>
        </section>

        <section id="maps-section" className="wrap section">
          <div className="section-head">
            <h2>Maps</h2>
            <p>Pick a map to see its radar and lineups.</p>
          </div>
          <div className="maps">
            {loadState === 'loading' && maps.length === 0
              ? Array.from({ length: 7 }, (_, i) => <div key={i} className="map-tile skeleton" />)
              : maps.map((m) => (
                  <button
                    key={m.id}
                    className={`map-tile${mapId === m.id ? ' active' : ''}`}
                    style={{ background: mapTileBackground(m.id, m.bg), ['--map-accent' as string]: m.accent }}
                    onClick={() => {
                      setMapId(m.id)
                      document.getElementById('browse')?.scrollIntoView({ behavior: 'smooth' })
                    }}
                  >
                    <span className="map-code">{m.code}</span>
                    <span className="map-name">{m.name}</span>
                    <span className="map-count">{m.lineupCount} lineups</span>
                  </button>
                ))}
            {loadState === 'ready' && (
              <button className={`map-tile all${mapId === 'all' ? ' active' : ''}`} onClick={() => setMapId('all')}>
                <span className="map-code">all maps</span>
                <span className="map-name">Everything</span>
                <span className="map-count">{lineups.length} lineups</span>
              </button>
            )}
          </div>
        </section>

        <section id="browse" className="wrap section browse">
          <aside className="filters">
            <div className="search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                placeholder="Search spot, e.g. window"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search lineups"
              />
            </div>

            <fieldset>
              <legend>Utility</legend>
              <div className="util-grid">
                {(Object.keys(UTILITY_META) as UtilityType[]).map((t) => (
                  <button
                    key={t}
                    className={`util-btn${types.has(t) ? ' on' : ''}`}
                    style={{ ['--util' as string]: UTILITY_META[t].color }}
                    onClick={() => toggleType(t)}
                    aria-pressed={types.has(t)}
                  >
                    <UtilityIcon type={t} size={18} />
                    {UTILITY_META[t].label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>Side</legend>
              <div className="segmented">
                {(['all', 'T', 'CT'] as const).map((s) => (
                  <button key={s} className={side === s ? 'on' : ''} onClick={() => setSide(s)}>
                    {s === 'all' ? 'Both' : s}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>Throw</legend>
              <div className="chips">
                {(['all', ...THROWS] as const).map((t) => (
                  <button key={t} className={`chip${throwType === t ? ' on' : ''}`} onClick={() => setThrowType(t)}>
                    {t === 'all' ? 'Any' : t}
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <label className="toggle">
                <input type="checkbox" checked={savedOnly} onChange={(e) => setSavedOnly(e.target.checked)} />
                <span className="toggle-track"><span /></span>
                Only my deck
              </label>
              {!user && (
                <p className="hint">
                  Saved in this browser.{' '}
                  <button className="link-btn" onClick={() => setAuthOpen(true)}>Sign in</button> to sync.
                </p>
              )}
            </div>

            {filtersActive && (
              <button className="reset" onClick={resetFilters}>Reset filters</button>
            )}
          </aside>

          <div className="results">
            <div className="results-head">
              <h2>
                {activeMap ? activeMap.name : 'All maps'}
                {loadState === 'ready' && <span>{results.length} lineups</span>}
              </h2>
              <select value={mapId} onChange={(e) => setMapId(e.target.value)} aria-label="Map">
                <option value="all">All maps</option>
                {maps.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            {loadState === 'error' ? (
              <div className="empty">
                <p>Couldn't reach the NadeDeck server.</p>
                <p className="muted">Make sure the API is running (<code>cd server &amp;&amp; npm run dev</code>).</p>
                <button className="btn btn-ghost" onClick={() => { setLoadState('loading'); void loadData() }}>
                  Try again
                </button>
              </div>
            ) : loadState === 'loading' ? (
              <div className="grid">
                {Array.from({ length: 6 }, (_, i) => <div key={i} className="card skeleton" />)}
              </div>
            ) : (
              <>
                {activeMap && (
                  <Radar map={activeMap} lineups={results} hovered={hovered} onHover={setHovered} onSelect={openLineup} />
                )}

                {results.length > 0 ? (
                  <div className="grid">
                    {results.map((l) => (
                      <LineupCard
                        key={l.id}
                        lineup={l}
                        map={mapById.get(l.map)}
                        saved={saved.has(l.id)}
                        highlighted={hovered === l.id}
                        onOpen={() => openLineup(l)}
                        onToggleSave={() => toggleSave(l.id)}
                        onHover={setHovered}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty">
                    <p>No lineups match these filters.</p>
                    {savedOnly && saved.size === 0 && (
                      <p className="muted">Your deck is empty — save lineups with the bookmark icon.</p>
                    )}
                    <button className="btn btn-ghost" onClick={resetFilters}>Reset filters</button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap footer-inner">
          <span className="brand small"><Logo size={32} /><span>Nade<b>Deck</b></span></span>
          <p>Fan-made utility reference. Not affiliated with Valve. Counter-Strike is a trademark of Valve Corporation.</p>
        </div>
      </footer>

      {open && (
        <LineupModal
          lineup={open}
          map={mapById.get(open.map)}
          saved={saved.has(open.id)}
          onClose={closeLineup}
          onToggleSave={() => toggleSave(open.id)}
        />
      )}

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onAuthed={onAuthed} />}

      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  )
}

export default App
