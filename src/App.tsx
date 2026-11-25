import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Lineup, Side, ThrowType, UtilityType } from './data/lineups'
import { LINEUPS, MAPS, UTILITY_META } from './data/lineups'
import { LineupCard } from './components/LineupCard'
import { LineupModal } from './components/LineupModal'
import { Radar } from './components/Radar'
import { Logo, UtilityIcon } from './components/UtilityIcon'
import './App.css'

const THROWS: ThrowType[] = ['Standing', 'Jump throw', 'Running', 'Walking', 'Crouch']
const SAVED_KEY = 'nadedeck:saved'

function loadSaved(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

function App() {
  const [mapId, setMapId] = useState<string>('mirage')
  const [types, setTypes] = useState<Set<UtilityType>>(new Set())
  const [side, setSide] = useState<Side | 'all'>('all')
  const [throwType, setThrowType] = useState<ThrowType | 'all'>('all')
  const [query, setQuery] = useState('')
  const [savedOnly, setSavedOnly] = useState(false)
  const [saved, setSaved] = useState<Set<string>>(loadSaved)
  const [open, setOpen] = useState<Lineup | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify([...saved]))
    } catch {
      /* storage unavailable */
    }
  }, [saved])

  // Deep links: #lineup-id opens that lineup
  useEffect(() => {
    const fromHash = () => {
      const id = decodeURIComponent(location.hash.slice(1))
      const found = LINEUPS.find((l) => l.id === id)
      if (found) {
        setMapId(found.map)
        setOpen(found)
      }
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [])

  const openLineup = (l: Lineup) => {
    setOpen(l)
    history.replaceState(null, '', `#${l.id}`)
  }
  const closeLineup = useCallback(() => {
    setOpen(null)
    history.replaceState(null, '', location.pathname + location.search)
  }, [])

  const toggleSave = (id: string) =>
    setSaved((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleType = (t: UtilityType) =>
    setTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return LINEUPS.filter(
      (l) =>
        (mapId === 'all' || l.map === mapId) &&
        (types.size === 0 || types.has(l.type)) &&
        (side === 'all' || l.side === side) &&
        (throwType === 'all' || l.throw === throwType) &&
        (!savedOnly || saved.has(l.id)) &&
        (!q || `${l.title} ${l.from} ${l.to} ${l.map}`.toLowerCase().includes(q)),
    )
  }, [mapId, types, side, throwType, query, savedOnly, saved])

  const activeMap = MAPS.find((m) => m.id === mapId)
  const filtersActive = types.size > 0 || side !== 'all' || throwType !== 'all' || savedOnly || query !== ''
  const resetFilters = () => {
    setTypes(new Set())
    setSide('all')
    setThrowType('all')
    setSavedOnly(false)
    setQuery('')
  }

  const countFor = (id: string) => LINEUPS.filter((l) => l.map === id).length

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
              <div><dt>{LINEUPS.length}</dt><dd>Lineups</dd></div>
              <div><dt>{MAPS.length}</dt><dd>Maps</dd></div>
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
            {MAPS.map((m) => (
              <button
                key={m.id}
                className={`map-tile${mapId === m.id ? ' active' : ''}`}
                style={{ background: m.bg, ['--map-accent' as string]: m.accent }}
                onClick={() => {
                  setMapId(m.id)
                  document.getElementById('browse')?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                <span className="map-code">{m.code}</span>
                <span className="map-name">{m.name}</span>
                <span className="map-count">{countFor(m.id)} lineups</span>
              </button>
            ))}
            <button
              className={`map-tile all${mapId === 'all' ? ' active' : ''}`}
              onClick={() => setMapId('all')}
            >
              <span className="map-code">all maps</span>
              <span className="map-name">Everything</span>
              <span className="map-count">{LINEUPS.length} lineups</span>
            </button>
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

            <label className="toggle">
              <input type="checkbox" checked={savedOnly} onChange={(e) => setSavedOnly(e.target.checked)} />
              <span className="toggle-track"><span /></span>
              Only my deck
            </label>

            {filtersActive && (
              <button className="reset" onClick={resetFilters}>Reset filters</button>
            )}
          </aside>

          <div className="results">
            <div className="results-head">
              <h2>{activeMap ? activeMap.name : 'All maps'} <span>{results.length} lineups</span></h2>
              <select value={mapId} onChange={(e) => setMapId(e.target.value)} aria-label="Map">
                <option value="all">All maps</option>
                {MAPS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            {activeMap && (
              <Radar
                map={activeMap}
                lineups={results}
                hovered={hovered}
                onHover={setHovered}
                onSelect={openLineup}
              />
            )}

            {results.length > 0 ? (
              <div className="grid">
                {results.map((l) => (
                  <LineupCard
                    key={l.id}
                    lineup={l}
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
                {savedOnly && saved.size === 0 && <p className="muted">Your deck is empty — save lineups with the bookmark icon.</p>}
                <button className="btn btn-ghost" onClick={resetFilters}>Reset filters</button>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap footer-inner">
          <span className="brand small"><Logo /> Nade<b>Deck</b></span>
          <p>Fan-made utility reference. Not affiliated with Valve. Counter-Strike is a trademark of Valve Corporation.</p>
        </div>
      </footer>

      {open && (
        <LineupModal
          lineup={open}
          saved={saved.has(open.id)}
          onClose={closeLineup}
          onToggleSave={() => toggleSave(open.id)}
        />
      )}
    </>
  )
}

export default App
